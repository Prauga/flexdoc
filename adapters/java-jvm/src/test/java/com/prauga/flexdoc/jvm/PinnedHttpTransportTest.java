package com.prauga.flexdoc.jvm;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PinnedHttpTransportTest {
  private HttpServer alpha;
  private HttpServer beta;

  @BeforeEach
  void startServers() throws IOException {
    alpha = server("alpha");
    beta = server("beta");
  }

  @AfterEach
  void stopServers() {
    if (alpha != null) alpha.stop(0);
    if (beta != null) beta.stop(0);
  }

  @Test
  void keepsValidatedPinsRequestScopedAcrossConcurrentSharedClientCalls() throws Exception {
    InetAddress[] loopback = {InetAddress.getByName("127.0.0.1")};
    ExecutorService callers = Executors.newFixedThreadPool(12);
    try {
      List<Future<String>> futures = new ArrayList<>();
      for (int index = 0; index < 48; index++) {
        boolean useAlpha = index % 2 == 0;
        String expected = useAlpha ? "alpha" : "beta";
        int port = (useAlpha ? alpha : beta).getAddress().getPort();
        String host = useAlpha ? "alpha.invalid" : "beta.invalid";
        futures.add(callers.submit(() -> {
          PinnedHttpTransport.Response response = PinnedHttpTransport.execute(
              "GET",
              URI.create("http://" + host + ":" + port + "/marker"),
              List.of(),
              null,
              loopback,
              5_000,
              1024);
          assertEquals(200, response.status());
          return new String(response.body(), StandardCharsets.UTF_8) + ":" + expected;
        }));
      }

      for (Future<String> future : futures) {
        String[] value = future.get().split(":", 2);
        assertEquals(value[1], value[0]);
      }
    } finally {
      callers.shutdownNow();
    }
  }

  @Test
  void changedValidatedPinSetCannotReuseEarlierSocket() throws Exception {
    InetAddress firstAddress = InetAddress.getByName("127.0.0.1");
    InetAddress secondAddress = InetAddress.getByName("127.0.0.2");
    int port;
    try (ServerSocket reservation = new ServerSocket(0, 1, firstAddress)) {
      port = reservation.getLocalPort();
    }

    HttpServer first = server(firstAddress, port, "first");
    HttpServer second = null;
    try {
      second = server(secondAddress, port, "second");
      URI target = URI.create("http://switch.invalid:" + port + "/marker");

      PinnedHttpTransport.Response initial = PinnedHttpTransport.execute(
          "GET", target, List.of(), null, new InetAddress[] {firstAddress}, 5_000, 1024);
      assertEquals("first", new String(initial.body(), StandardCharsets.UTF_8));

      PinnedHttpTransport.Response rebound = PinnedHttpTransport.execute(
          "GET", target, List.of(), null, new InetAddress[] {secondAddress}, 5_000, 1024);
      assertEquals("second", new String(rebound.body(), StandardCharsets.UTF_8));
    } finally {
      first.stop(0);
      if (second != null) second.stop(0);
    }
  }

  private static HttpServer server(String marker) throws IOException {
    return server(InetAddress.getByName("127.0.0.1"), 0, marker);
  }

  private static HttpServer server(InetAddress address, int port, String marker) throws IOException {
    HttpServer server = HttpServer.create(new InetSocketAddress(address, port), 0);
    server.createContext("/marker", exchange -> {
      byte[] body = marker.getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(200, body.length);
      exchange.getResponseBody().write(body);
      exchange.close();
    });
    server.start();
    return server;
  }
}
