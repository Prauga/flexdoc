package com.prauga.example.guice;

import com.google.inject.AbstractModule;
import com.google.inject.Guice;
import com.prauga.flexdoc.jvm.FlexDocConfig;
import com.prauga.flexdoc.jvm.FlexDocHost;
import com.prauga.flexdoc.jvm.FlexDocHttpResponse;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

public final class Application {
  public static void main(String[] args) throws Exception {
    var injector = Guice.createInjector(new AbstractModule() {
      @Override protected void configure() {
        bind(FlexDocHost.class).toInstance(new FlexDocHost(FlexDocConfig.builder().path("/docs").specUrl("/openapi.json").title("Guice FlexDoc Example").build()));
      }
    });
    FlexDocHost host = injector.getInstance(FlexDocHost.class);
    int port = Integer.parseInt(System.getProperty("port", "5091"));
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
    server.createContext("/health", exchange -> text(exchange, 200, "ok", "text/plain; charset=utf-8"));
    server.createContext("/openapi.json", exchange -> text(exchange, 200, "{\"openapi\":\"3.1.0\",\"info\":{\"title\":\"Guice Example\",\"version\":\"1.0.0\"},\"paths\":{}}", "application/json"));
    server.createContext("/docs", exchange -> docs(exchange, host));
    server.start();
  }

  private static void docs(HttpExchange exchange, FlexDocHost host) throws IOException {
    try {
      String path = exchange.getRequestURI().getPath();
      FlexDocHttpResponse response = switch (path) {
        case "/docs", "/docs/" -> host.documentation();
        case "/docs/__flexdoc/renderer.js" -> host.rendererJavaScript();
        case "/docs/__flexdoc/renderer.css" -> host.rendererCss();
        default -> new FlexDocHttpResponse(404, "text/plain; charset=utf-8", "no-cache", "not found".getBytes(StandardCharsets.UTF_8));
      };
      write(exchange, response);
    } catch (Exception error) {
      text(exchange, 500, error.getMessage() == null ? error.toString() : error.getMessage(), "text/plain; charset=utf-8");
    }
  }

  private static void write(HttpExchange exchange, FlexDocHttpResponse response) throws IOException {
    byte[] body = response.body();
    exchange.getResponseHeaders().set("Content-Type", response.contentType());
    exchange.getResponseHeaders().set("Cache-Control", response.cacheControl());
    exchange.sendResponseHeaders(response.status(), body.length);
    try (var output = exchange.getResponseBody()) { output.write(body); }
  }

  private static void text(HttpExchange exchange, int status, String body, String contentType) throws IOException {
    write(exchange, new FlexDocHttpResponse(status, contentType, "no-cache", body.getBytes(StandardCharsets.UTF_8)));
  }
}
