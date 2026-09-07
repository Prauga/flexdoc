package com.prauga.flexdoc.spring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

class SpringRuntimeIntelligenceTest {
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void buildsPresenceDriftFromLiveSpringMappings() {
    List<RequestMappingInfo> mappings = List.of(
        RequestMappingInfo.paths("/orders/{orderId:\\d+}").methods(RequestMethod.GET).build(),
        RequestMappingInfo.paths("/internal").methods(RequestMethod.POST).build(),
        RequestMappingInfo.paths("/v3/api-docs").methods(RequestMethod.GET).build(),
        RequestMappingInfo.paths("/docs").methods(RequestMethod.GET).build(),
        RequestMappingInfo.paths("/docs/__flexdoc/runtime").methods(RequestMethod.GET).build());
    JsonNode spec = objectMapper.valueToTree(Map.of(
        "paths", Map.of(
            "/orders/{orderId}", Map.of("get", Map.of()),
            "/missing", Map.of("post", Map.of()))));
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.setScheme("https");
    request.addHeader("Host", "api.example.test");

    Map<String, Object> snapshot = SpringRuntimeIntelligence.buildSnapshot(
        mappings, spec, request, "/docs", "/v3/api-docs");
    JsonNode json = objectMapper.valueToTree(snapshot);

    assertThat(json.get("framework").asText()).isEqualTo("spring");
    assertThat(json.get("runtime").get("name").asText()).isEqualTo("java");
    assertThat(json.get("serverOrigin").asText()).isEqualTo("https://api.example.test");
    assertThat(json.get("discoveryComplete").asBoolean()).isTrue();
    assertThat(json.get("summary")).isEqualTo(objectMapper.valueToTree(Map.of(
        "documented", 2,
        "runtime", 2,
        "matched", 1L,
        "runtimeOnly", 1,
        "documentedOnly", 1)));
    assertThat(json.get("runtimeOnly").get(0).get("method").asText()).isEqualTo("POST");
    assertThat(json.get("runtimeOnly").get(0).get("path").asText()).isEqualTo("/internal");
    assertThat(json.get("documentedOnly").get(0).get("path").asText()).isEqualTo("/missing");
    assertThat(json.get("routes").toString()).contains("/orders/{orderId}");
    assertThat(json.get("routes").toString()).doesNotContain("/v3/api-docs", "/docs");
  }

  @Test
  @SuppressWarnings("unchecked")
  void runtimeControllerReturnsNoStoreSnapshot() throws Exception {
    RequestMappingInfo orders = RequestMappingInfo.paths("/orders/{orderId}").methods(RequestMethod.GET).build();
    RequestMappingInfo internal = RequestMappingInfo.paths("/internal").methods(RequestMethod.POST).build();
    Map<RequestMappingInfo, HandlerMethod> liveMappings = new LinkedHashMap<>();
    liveMappings.put(orders, null);
    liveMappings.put(internal, null);

    RequestMappingHandlerMapping handlerMapping = mock(RequestMappingHandlerMapping.class);
    when(handlerMapping.getHandlerMethods()).thenReturn(liveMappings);
    ObjectProvider<RequestMappingHandlerMapping> mappingProvider = mock(ObjectProvider.class);
    when(mappingProvider.getIfAvailable()).thenReturn(handlerMapping);

    FlexDocProperties properties = new FlexDocProperties();
    properties.setRuntimeIntelligence(true);
    FlexDocSpecProvider specProvider = () -> Map.of("paths", Map.of("/orders/{orderId}", Map.of("get", Map.of())));
    SpringRuntimeIntelligence runtime = new SpringRuntimeIntelligence(properties, specProvider, mappingProvider, objectMapper);
    FlexDocRuntimeController controller = new FlexDocRuntimeController(runtime, objectMapper);
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.setScheme("http");
    request.addHeader("Host", "localhost:8080");

    var response = controller.runtime(request);
    JsonNode json = objectMapper.readTree(response.getBody());

    assertThat(response.getStatusCode().value()).isEqualTo(200);
    assertThat(response.getHeaders().getFirst(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store");
    assertThat(json.get("summary").get("runtime").asInt()).isEqualTo(2);
    assertThat(json.get("runtimeOnly").get(0).get("path").asText()).isEqualTo("/internal");
  }

  @Test
  void marksMethodlessAndWildcardMappingsPartialInsteadOfGuessing() {
    List<RequestMappingInfo> mappings = List.of(
        RequestMappingInfo.paths("/any-method").build(),
        RequestMappingInfo.paths("/wild/**").methods(RequestMethod.GET).build());

    SpringRuntimeIntelligence.Discovery discovery = SpringRuntimeIntelligence.discoverRoutes(
        mappings, "/docs", "/v3/api-docs");

    assertThat(discovery.complete()).isFalse();
    assertThat(discovery.routes()).isEmpty();
  }

  @Test
  void normalizesSpringParameterSyntax() {
    assertThat(SpringRuntimeIntelligence.normalizeRuntimePath("/orders/{orderId:\\d+}/"))
        .isEqualTo("/orders/{orderId}");
    assertThat(SpringRuntimeIntelligence.normalizeRuntimePath("/codes/{code:[0-9]{2,4}}"))
        .isEqualTo("/codes/{code}");
    assertThat(SpringRuntimeIntelligence.normalizeRuntimePath("/files/{*filePath}"))
        .isEqualTo("/files/{filePath}");
  }
}
