package com.prauga.flexdoc.jvm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FlexDocHostExecutionTest {
  private HttpServer server;
  private String origin;

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    origin = "http://127.0.0.1:" + server.getAddress().getPort();
    server.createContext("/echo", this::echo);
    server.createContext("/redirect", exchange -> {
      exchange.getResponseHeaders().set("Location", "http://169.254.169.254/latest/meta-data");
      exchange.sendResponseHeaders(302, -1);
      exchange.close();
    });
    server.createContext("/redirect-local", exchange -> {
      exchange.getResponseHeaders().set("Location", "/echo?redirected=1");
      exchange.sendResponseHeaders(302, -1);
      exchange.close();
    });
    server.start();
  }

  @AfterEach
  void stopServer() {
    if (server != null) server.stop(0);
  }

  @Test
  void executesCanonicalResolvedRequestShape() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
    Map<String, Object> envelope = Map.of("request", Map.of(
        "method", "POST",
        "url", origin + "/echo",
        "query", List.of(Map.of("key", "page", "value", "2")),
        "headers", List.of(
            Map.of("key", "X-Test", "value", "java"),
            Map.of("key", "Origin", "value", "https://evil.example")),
        "bodyMode", "json",
        "body", "{\"ok\":true}",
        "auth", Map.of("type", "bearer", "token", "secret")));

    FlexDocHostExecutionResult route = executor.handle("1", envelope);

    assertEquals(200, route.status());
    assertEquals(200, route.body().get("status"));
    String body = String.valueOf(route.body().get("body"));
    assertTrue(body.contains("POST /echo?page=2"));
    assertTrue(body.contains("authorization=Bearer secret"));
    assertTrue(body.contains("x-test=java"));
    assertTrue(body.contains("body={\"ok\":true}"));
    assertTrue(body.contains("origin=null"));
    assertTrue(!body.contains("https://evil.example"));
  }

  @Test
  void preservesExistingPercentEncodedUrlComponentsWhenAppendingQuery() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
    FlexDocHostExecutionResult route = executor.handle("1", Map.of("request", Map.of(
        "method", "GET",
        "url", origin + "/echo/a%2Fb?existing=a%20b",
        "query", List.of(Map.of("key", "extra", "value", "x y")))));

    assertEquals(200, route.status());
    assertTrue(String.valueOf(route.body().get("body"))
        .contains("GET /echo/a%2Fb?existing=a%20b&extra=x%20y"));
  }

  @Test
  void reappliesQueryApiKeyAfterSameOriginRedirect() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
    FlexDocHostExecutionResult route = executor.handle("1", Map.of("request", Map.of(
        "method", "GET",
        "url", origin + "/redirect-local",
        "auth", Map.of("type", "apiKey", "key", "token", "value", "secret", "in", "query"))));

    assertEquals(200, route.status());
    assertTrue(String.valueOf(route.body().get("body"))
        .contains("GET /echo?redirected=1&token=secret"));
  }

  @Test
  void usesCanonicalBinaryContentTypeMetadata() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
    FlexDocHostExecutionResult route = executor.handle("1", Map.of(
        "bodyBase64", "UEFZTE9BRA==",
        "request", Map.of(
            "method", "POST",
            "url", origin + "/echo",
            "bodyMode", "binary",
            "binary", Map.of("fileName", "payload.bin", "contentType", "application/vnd.flexdoc-test"))));

    assertEquals(200, route.status());
    String body = String.valueOf(route.body().get("body"));
    assertTrue(body.contains("content-type=application/vnd.flexdoc-test"));
    assertTrue(body.contains("body=PAYLOAD"));
  }

  @Test
  void executesCanonicalMultipartFileEnvelopeAndReplacesDraftBoundary() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
    Map<String, Object> envelope = Map.of("request", Map.of(
        "method", "POST",
        "url", origin + "/echo",
        "headers", List.of(Map.of("key", "Content-Type", "value", "multipart/form-data; boundary=stale")),
        "bodyMode", "formdata",
        "formData", List.of(
            Map.of("key", "note", "value", "hello", "type", "text"),
            Map.of("key", "upload", "type", "file", "fileName", "draft.txt", "contentType", "text/plain"))));

    FlexDocHostExecutionResult route = executor.handle(
        "1", envelope, Map.of(1, new FlexDocHostExecutionFile("actual.txt", "text/plain", "FILE-BYTES".getBytes(StandardCharsets.UTF_8))));

    assertEquals(200, route.status());
    String body = String.valueOf(route.body().get("body"));
    assertTrue(body.contains("content-type=multipart/form-data; boundary=----flexdoc-"));
    assertTrue(!body.contains("boundary=stale"));
    assertTrue(body.contains("name=\"note\""));
    assertTrue(body.contains("hello"));
    assertTrue(body.contains("name=\"upload\"; filename=\"actual.txt\""));
    assertTrue(body.contains("FILE-BYTES"));
  }

  @Test
  void rejectsMissingMultipartFilePart() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
    Map<String, Object> envelope = Map.of("request", Map.of(
        "method", "POST",
        "url", origin + "/echo",
        "bodyMode", "formdata",
        "formData", List.of(Map.of("key", "upload", "type", "file"))));

    FlexDocHostExecutionResult route = executor.handle("1", envelope, Map.of());

    assertEquals(400, route.status());
    assertTrue(String.valueOf(route.body().get("error")).contains("needs an uploaded file part"));
  }

  @Test
  void requiresExecutionMarkerBeforeTransport() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
    FlexDocHostExecutionResult route = executor.handle(null, Map.of("request", Map.of("url", origin + "/echo")));
    assertEquals(403, route.status());
    assertEquals("Missing X-FlexDoc-Execute header.", route.body().get("error"));
  }

  @Test
  void blocksOriginsOutsideExplicitAllowlist() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
    FlexDocHostExecutionResult route = executor.handle("1", Map.of("request", Map.of("url", "https://example.com/private")));
    assertEquals(403, route.status());
    assertTrue(String.valueOf(route.body().get("error")).contains("not allowed"));
  }

  @Test
  void revalidatesRedirectTargetsBeforeFollowingThem() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
    FlexDocHostExecutionResult route = executor.handle("1", Map.of("request", Map.of("url", origin + "/redirect")));
    assertEquals(403, route.status());
    assertTrue(String.valueOf(route.body().get("error")).contains("cross-origin"));
  }

  @Test
  void blocksMetadataTargetsEvenWhenExplicitlyAllowlisted() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of("http://169.254.169.254"));
    FlexDocHostExecutionResult route = executor.handle("1", Map.of("request", Map.of("url", "http://169.254.169.254/latest")));
    assertEquals(403, route.status());
    assertTrue(String.valueOf(route.body().get("error")).contains("metadata"));
  }

  @Test
  void rejectsUnadvertisedHostOnlyAuthentication() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
    FlexDocHostExecutionResult route = executor.handle("1", Map.of("request", Map.of(
        "url", origin + "/echo",
        "auth", Map.of("type", "digest", "username", "alice", "password", "secret"))));
    assertEquals(400, route.status());
    assertTrue(String.valueOf(route.body().get("error")).contains("not implemented"));
  }

  private void echo(HttpExchange exchange) throws IOException {
    String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    String response = exchange.getRequestMethod() + " " + exchange.getRequestURI()
        + "\nauthorization=" + exchange.getRequestHeaders().getFirst("Authorization")
        + "\nx-test=" + exchange.getRequestHeaders().getFirst("X-Test")
        + "\norigin=" + exchange.getRequestHeaders().getFirst("Origin")
        + "\ncontent-type=" + exchange.getRequestHeaders().getFirst("Content-Type")
        + "\nbody=" + requestBody;
    byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "text/plain");
    exchange.sendResponseHeaders(200, bytes.length);
    exchange.getResponseBody().write(bytes);
    exchange.close();
  }
}
