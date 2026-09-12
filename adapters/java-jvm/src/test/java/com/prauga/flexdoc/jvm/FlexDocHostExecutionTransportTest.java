package com.prauga.flexdoc.jvm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class FlexDocHostExecutionTransportTest {
  @Test
  void pinnedTransportConnectsToValidatedAddressAndPreservesOriginalAuthority() throws Exception {
    AtomicReference<String> capturedHost = new AtomicReference<>();
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/pinned", exchange -> {
      capturedHost.set(exchange.getRequestHeaders().getFirst("Host"));
      send(exchange, "pinned");
    });
    server.start();

    try {
      int port = server.getAddress().getPort();
      String hostname = "flexdoc-pinned.invalid";
      URI target = URI.create("http://" + hostname + ":" + port + "/pinned");

      PinnedHttpTransport.Response response = PinnedHttpTransport.execute(
          "GET",
          target,
          List.of(),
          null,
          new InetAddress[] {InetAddress.getByName("127.0.0.1")},
          2_000,
          10 * 1024 * 1024);

      assertEquals(200, response.status());
      assertEquals("pinned", new String(response.body(), StandardCharsets.UTF_8));
      assertEquals(hostname + ":" + port, capturedHost.get());
    } finally {
      server.stop(0);
    }
  }

  @Test
  void emptyStructuredBodyContainersDoNotSuppressRawJsonBody() throws Exception {
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/body", exchange -> {
      byte[] body = exchange.getRequestBody().readAllBytes();
      exchange.sendResponseHeaders(200, body.length);
      exchange.getResponseBody().write(body);
      exchange.close();
    });
    server.start();

    try {
      String origin = "http://127.0.0.1:" + server.getAddress().getPort();
      FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
      FlexDocHostExecutionResult result = executor.handle("1", Map.of(
          "request", Map.of(
              "method", "POST",
              "url", origin + "/body",
              "contentType", "application/json",
              "body", "{\"ok\":true}",
              "binary", Map.of(),
              "formData", List.of(),
              "urlencoded", List.of(),
              "graphql", Map.of())));

      assertEquals(200, result.status());
      assertEquals(200, result.body().get("status"));
      assertEquals("{\"ok\":true}", result.body().get("body"));
    } finally {
      server.stop(0);
    }
  }

  private static void send(HttpExchange exchange, String value) throws IOException {
    byte[] body = value.getBytes(StandardCharsets.UTF_8);
    exchange.sendResponseHeaders(200, body.length);
    exchange.getResponseBody().write(body);
    exchange.close();
  }
}
