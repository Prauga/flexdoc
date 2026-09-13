package com.prauga.flexdoc.spring;

import static org.assertj.core.api.Assertions.assertThat;

import com.prauga.flexdoc.jvm.FlexDocHost;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prauga.flexdoc.jvm.FlexDocHostExecution;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockMultipartHttpServletRequest;

class FlexDocHostExecutionControllerTest {
  @Test
  void advertisesNativeExecutionOnlyWhenRealExecutorIsAttached() throws Exception {
    FlexDocProperties properties = enabledProperties();
    FlexDocHost host = new FlexDocHost(
        properties.toConfig(),
        null,
        new FlexDocHostExecution(properties.getTryItHostExecutionAllowedOrigins()));

    String html = host.documentation().bodyUtf8();

    assertThat(html).contains("\"hostExecution\":{\"available\":true,\"endpoint\":\"/docs/__flexdoc/execute\",\"capabilities\":[]}");
    assertThat(host.hasHostExecution()).isTrue();
  }

  @Test
  void keepsProtocolAdvertisementUnavailableWithoutExecutor() throws Exception {
    FlexDocProperties properties = enabledProperties();
    FlexDocHost host = new FlexDocHost(properties.toConfig());

    assertThat(host.documentation().bodyUtf8())
        .contains("\"hostExecution\":{\"available\":false,\"endpoint\":\"/docs/__flexdoc/execute\",\"capabilities\":[]}");
    assertThat(host.hasHostExecution()).isFalse();
  }

  @Test
  void mapsExecutionMarkerAndPolicyFailuresThroughSpringResponse() throws Exception {
    FlexDocProperties properties = enabledProperties();
    FlexDocHost host = new FlexDocHost(
        properties.toConfig(),
        null,
        new FlexDocHostExecution(properties.getTryItHostExecutionAllowedOrigins()));
    ObjectMapper mapper = new ObjectMapper();
    FlexDocHostExecutionController controller = new FlexDocHostExecutionController(host, mapper);
    Map<String, Object> envelope = Map.of("request", Map.of("url", "https://blocked.example/path"));
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.setContentType(MediaType.APPLICATION_JSON_VALUE);
    request.setContent(mapper.writeValueAsBytes(envelope));

    ResponseEntity<Map<String, Object>> missingMarker = controller.execute(null, request);
    ResponseEntity<Map<String, Object>> blocked = controller.execute("1", request);

    assertThat(missingMarker.getStatusCode().value()).isEqualTo(403);
    assertThat(missingMarker.getBody()).containsEntry("error", "Missing X-FlexDoc-Execute header.");
    assertThat(blocked.getStatusCode().value()).isEqualTo(403);
    assertThat(String.valueOf(blocked.getBody().get("error"))).contains("not allowed");
    assertThat(blocked.getHeaders().getCacheControl()).isEqualTo("no-store");
  }

  @Test
  void parsesCanonicalMultipartDescriptorAndIndexedFileParts() throws Exception {
    var server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/upload", exchange -> {
      byte[] requestBody = exchange.getRequestBody().readAllBytes();
      String response = exchange.getRequestHeaders().getFirst("Content-Type") + "\n"
          + new String(requestBody, StandardCharsets.UTF_8);
      byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(200, bytes.length);
      exchange.getResponseBody().write(bytes);
      exchange.close();
    });
    server.start();
    try {
      String targetOrigin = "http://127.0.0.1:" + server.getAddress().getPort();
      FlexDocProperties properties = new FlexDocProperties();
      properties.setTryItHostExecution(true);
      properties.setTryItHostExecutionAllowedOrigins(List.of(targetOrigin));
      FlexDocHost host = new FlexDocHost(
          properties.toConfig(), null, new FlexDocHostExecution(properties.getTryItHostExecutionAllowedOrigins()));
      ObjectMapper mapper = new ObjectMapper();
      FlexDocHostExecutionController controller = new FlexDocHostExecutionController(host, mapper);
      String descriptor = mapper.writeValueAsString(Map.of("request", Map.of(
          "method", "POST",
          "url", targetOrigin + "/upload",
          "bodyMode", "formdata",
          "formData", List.of(Map.of("key", "upload", "type", "file", "fileName", "client.txt")))));
      MockMultipartHttpServletRequest request = new MockMultipartHttpServletRequest();
      request.addFile(new MockMultipartFile("formData[0]", "actual.txt", "text/plain", "SPRING-FILE".getBytes(StandardCharsets.UTF_8)));

      ResponseEntity<Map<String, Object>> result = controller.executeMultipart("1", descriptor, request);

      assertThat(result.getStatusCode().value()).isEqualTo(200);
      String responseBody = String.valueOf(result.getBody().get("body"));
      assertThat(responseBody).contains("multipart/form-data; boundary=----flexdoc-");
      assertThat(responseBody).contains("filename=\"actual.txt\"");
      assertThat(responseBody).contains("SPRING-FILE");
    } finally {
      server.stop(0);
    }
  }

  @Test
  void rejectsMultipartWithoutDescriptorUsingCanonicalResponse() {
    FlexDocProperties properties = enabledProperties();
    FlexDocHost host = new FlexDocHost(
        properties.toConfig(),
        null,
        new FlexDocHostExecution(properties.getTryItHostExecutionAllowedOrigins()));
    FlexDocHostExecutionController controller = new FlexDocHostExecutionController(host, new ObjectMapper());
    MockMultipartHttpServletRequest request = new MockMultipartHttpServletRequest();

    ResponseEntity<Map<String, Object>> result = controller.executeMultipart("1", null, request);

    assertThat(result.getStatusCode().value()).isEqualTo(400);
    assertThat(result.getBody()).containsEntry("error", "Host execution multipart request requires a descriptor.");
    assertThat(result.getHeaders().getCacheControl()).isEqualTo("no-store");
  }

  @Test
  void springPropertiesRequireExplicitNativeExecutionConfiguration() {
    FlexDocProperties defaults = new FlexDocProperties();
    assertThat(defaults.isTryItHostExecution()).isFalse();
    assertThat(defaults.getTryItHostExecutionAllowedOrigins()).isEmpty();
    assertThat(defaults.toConfig().tryItHostExecution()).isFalse();

    FlexDocProperties configured = enabledProperties();
    assertThat(configured.toConfig().tryItHostExecution()).isTrue();
    assertThat(configured.getTryItHostExecutionAllowedOrigins()).containsExactly("https://api.example.test");
  }

  private FlexDocProperties enabledProperties() {
    FlexDocProperties properties = new FlexDocProperties();
    properties.setTryItHostExecution(true);
    properties.setTryItHostExecutionAllowedOrigins(List.of("https://api.example.test"));
    return properties;
  }
}
