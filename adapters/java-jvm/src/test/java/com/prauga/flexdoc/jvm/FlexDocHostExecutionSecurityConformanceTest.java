package com.prauga.flexdoc.jvm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class FlexDocHostExecutionSecurityConformanceTest {
  private HttpServer server;

  @AfterEach
  void stopServer() {
    if (server != null) server.stop(0);
  }

  @Test
  void metadataTargetFailsClosedEvenWhenAllowlisted() {
    FlexDocHostExecution executor = new FlexDocHostExecution(List.of("http://169.254.169.254"));

    FlexDocHostExecutionResult result = executor.handle("1", Map.of(
        "request", Map.of("method", "GET", "url", "http://169.254.169.254/latest/meta-data/")));

    assertEquals(403, result.status());
    assertTrue(String.valueOf(result.body().get("error")).contains("metadata"));
  }

  @Test
  void crossOriginRedirectFailsClosedBeforeSecondHop() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    String origin = "http://127.0.0.1:" + server.getAddress().getPort();
    server.createContext("/redirect", exchange -> {
      exchange.getResponseHeaders().set("Location", "http://169.254.169.254/latest/meta-data/");
      exchange.sendResponseHeaders(302, -1);
      exchange.close();
    });
    server.start();

    FlexDocHostExecution executor = new FlexDocHostExecution(List.of(origin));
    FlexDocHostExecutionResult result = executor.handle("1", Map.of(
        "request", Map.of("method", "GET", "url", origin + "/redirect")));

    assertEquals(403, result.status());
    assertTrue(String.valueOf(result.body().get("error")).contains("cross-origin"));
  }

  @Test
  void sessionCookieJarFailsClosedInSharedPolicy() {
    String error = FlexDocHostExecutionPolicy.validate(Map.of(
        "cookieJar", "session",
        "request", Map.of("method", "GET", "url", "https://api.example.test/pets")));

    assertEquals("Session cookie jars are not implemented by the JVM host executor.", error);
  }

  @Test
  void clientCertificateFailsClosedInSharedPolicy() {
    String error = FlexDocHostExecutionPolicy.validate(Map.of(
        "certificateId", "client-cert-1",
        "request", Map.of("method", "GET", "url", "https://api.example.test/pets")));

    assertEquals("Client certificates are not implemented by the JVM host executor.", error);
  }
}
