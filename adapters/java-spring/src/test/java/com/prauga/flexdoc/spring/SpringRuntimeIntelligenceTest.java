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
import org.springframework.mock.env.MockEnvironment;
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
    request.setLocalPort(8443);

    Map<String, Object> snapshot = SpringRuntimeIntelligence.buildSnapshot(
        mappings, spec, request, "/docs", "/v3/api-docs", "staging");
    JsonNode json = objectMapper.valueToTree(snapshot);

    assertThat(json.get("framework").asText()).isEqualTo("spring");
    assertThat(json.get("runtime").get("name").asText()).isEqualTo("java");
    assertThat(json.get("serverOrigin").asText()).isEqualTo("https://api.example.test");
    assertThat(json.get("server").get("localPort").asInt()).isEqualTo(8443);
    assertThat(json.get("environment").get("name").asText()).isEqualTo("staging");
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
    assertThat(json.get("validation").get("status").asText()).isEqualTo("fail");
    assertThat(json.get("validation").get("summary").get("errors").asInt()).isEqualTo(2);
  }

  @Test
  @SuppressWarnings("unchecked")
  void disagreementLoopKeepsAcknowledgedRoutesAndFailsTheUnacknowledgedOne() throws Exception {
    Map<RequestMappingInfo, HandlerMethod> liveMappings = new LinkedHashMap<>();
    liveMappings.put(RequestMappingInfo.paths("/pets").methods(RequestMethod.GET).build(), null);
    liveMappings.put(RequestMappingInfo.paths("/internal/health").methods(RequestMethod.GET).build(), null);
    liveMappings.put(RequestMappingInfo.paths("/internal/reindex").methods(RequestMethod.POST).build(), null);
    RequestMappingHandlerMapping handlerMapping = mock(RequestMappingHandlerMapping.class);
    when(handlerMapping.getHandlerMethods()).thenReturn(liveMappings);
    ObjectProvider<RequestMappingHandlerMapping> mappingProvider = mock(ObjectProvider.class);
    when(mappingProvider.getIfAvailable()).thenReturn(handlerMapping);

    FlexDocProperties.AcknowledgedRoute health = new FlexDocProperties.AcknowledgedRoute();
    health.setMethod("get");
    health.setPath("/internal/health");
    FlexDocProperties properties = new FlexDocProperties();
    properties.setAcknowledgedUndocumented(List.of(health));
    FlexDocSpecProvider specProvider = () -> Map.of("paths", Map.of("/pets", Map.of("get", Map.of())));
    SpringRuntimeIntelligence runtime = new SpringRuntimeIntelligence(
        properties, specProvider, mappingProvider, objectMapper, new MockEnvironment());
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.setScheme("https");
    request.addHeader("Host", "staging.internal");

    JsonNode json = objectMapper.valueToTree(runtime.snapshot(request));
    JsonNode findings = json.get("validation").get("findings");

    assertThat(json.get("serverOrigin").asText()).isEqualTo("https://staging.internal");
    assertThat(json.get("summary").get("runtime").asInt()).isEqualTo(3);
    assertThat(json.get("runtimeOnly")).hasSize(2);
    assertThat(json.get("validation").get("status").asText()).isEqualTo("fail");
    assertThat(json.get("validation").get("summary")).isEqualTo(objectMapper.valueToTree(Map.of(
        "total", 2, "errors", 1, "warnings", 0, "info", 1)));
    assertThat(findings.get(0).get("code").asText()).isEqualTo("runtime.operation-undocumented");
    assertThat(findings.get(0).get("severity").asText()).isEqualTo("error");
    assertThat(findings.get(0).get("location").get("method").asText()).isEqualTo("POST");
    assertThat(findings.get(0).get("location").get("path").asText()).isEqualTo("/internal/reindex");
    assertThat(findings.get(0).has("disposition")).isFalse();
    assertThat(findings.get(1).get("severity").asText()).isEqualTo("info");
    assertThat(findings.get(1).get("disposition").asText()).isEqualTo("acknowledged");
    assertThat(findings.get(1).get("location").get("path").asText()).isEqualTo("/internal/health");
    assertThat(json.get("runtimeOnly").toString()).contains("/internal/health");
  }

  @Test
  void partialDiscoveryKeepsAnUndocumentedRouteAWarning() {
    List<RequestMappingInfo> mappings = List.of(
        RequestMappingInfo.paths("/internal/reindex").methods(RequestMethod.POST).build(),
        RequestMappingInfo.paths("/any-method").build());
    JsonNode spec = objectMapper.valueToTree(Map.of("paths", Map.of()));

    Map<String, Object> snapshot = SpringRuntimeIntelligence.buildSnapshot(
        mappings, spec, null, "/docs", "/v3/api-docs", null);
    JsonNode finding = objectMapper.valueToTree(snapshot).get("validation");

    assertThat(finding.get("complete").asBoolean()).isFalse();
    assertThat(finding.get("status").asText()).isEqualTo("warn");
    assertThat(finding.get("findings").get(0).get("severity").asText()).isEqualTo("warning");
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
    MockEnvironment environment = new MockEnvironment();
    environment.setActiveProfiles("test");
    SpringRuntimeIntelligence runtime = new SpringRuntimeIntelligence(properties, specProvider, mappingProvider, objectMapper, environment);
    FlexDocRuntimeController controller = new FlexDocRuntimeController(runtime, objectMapper);
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.setScheme("http");
    request.addHeader("Host", "localhost:8080");
    request.setLocalPort(8080);

    var response = controller.runtime(request);
    JsonNode json = objectMapper.readTree(response.getBody());

    assertThat(response.getStatusCode().value()).isEqualTo(200);
    assertThat(response.getHeaders().getFirst(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store");
    assertThat(json.get("summary").get("runtime").asInt()).isEqualTo(2);
    assertThat(json.get("runtimeOnly").get(0).get("path").asText()).isEqualTo("/internal");
    assertThat(json.get("server").get("localPort").asInt()).isEqualTo(8080);
    assertThat(json.get("environment").get("name").asText()).isEqualTo("test");
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
  void parameterNamesDoNotSplitOneWireOperation() {
    List<RequestMappingInfo> mappings = List.of(
        RequestMappingInfo.paths("/pets/{id}").methods(RequestMethod.GET).build());
    JsonNode spec = objectMapper.valueToTree(Map.of("paths", Map.of("/pets/{petId}", Map.of("get", Map.of()))));

    JsonNode json = objectMapper.valueToTree(SpringRuntimeIntelligence.buildSnapshot(
        mappings, spec, null, "/docs", "/v3/api-docs", null));

    assertThat(json.get("summary").get("matched").asInt()).isEqualTo(1);
    assertThat(json.get("runtimeOnly")).isEmpty();
    assertThat(json.get("documentedOnly")).isEmpty();
    assertThat(json.get("validation").get("status").asText()).isEqualTo("pass");
    assertThat(json.get("validation").get("findings")).isEmpty();
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
