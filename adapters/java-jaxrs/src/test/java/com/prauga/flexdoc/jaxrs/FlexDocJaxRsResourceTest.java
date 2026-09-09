package com.prauga.flexdoc.jaxrs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.prauga.flexdoc.jvm.FlexDocConfig;
import com.prauga.flexdoc.jvm.FlexDocHost;
import com.prauga.flexdoc.jvm.FlexDocHostExecution;
import com.sun.net.httpserver.HttpServer;
import jakarta.ws.rs.core.EntityPart;
import jakarta.ws.rs.core.GenericType;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

final class FlexDocJaxRsResourceTest {
  private HttpServer server;
  private String origin;

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/echo", exchange -> {
      byte[] request = exchange.getRequestBody().readAllBytes();
      byte[] body = request.length == 0 ? "ok".getBytes(StandardCharsets.UTF_8) : request;
      exchange.getResponseHeaders().add("Content-Type", "text/plain; charset=utf-8");
      exchange.sendResponseHeaders(200, body.length);
      exchange.getResponseBody().write(body);
      exchange.close();
    });
    server.start();
    origin = "http://127.0.0.1:" + server.getAddress().getPort();
  }

  @AfterEach
  void stopServer() {
    if (server != null) server.stop(0);
  }

  @Test
  void executesCanonicalJsonEnvelopeAndReturnsNoStoreJson() {
    FlexDocJaxRsResource resource = resource();
    byte[] body = ("{\"request\":{\"method\":\"GET\",\"url\":\"" + origin + "/echo\"}}")
        .getBytes(StandardCharsets.UTF_8);

    Response response = resource.execute("1", Integer.toString(body.length), new ByteArrayInputStream(body));

    assertEquals(200, response.getStatus());
    assertEquals("no-store", response.getHeaderString("Cache-Control"));
    assertEquals(MediaType.APPLICATION_JSON_TYPE, response.getMediaType());
    String json = (String) response.getEntity();
    assertTrue(json.contains("\"status\":200"));
    assertTrue(json.contains("\"body\":\"ok\""));
  }

  @Test
  void executesCanonicalMultipartEnvelopeWithIndexedFilePart() {
    FlexDocJaxRsResource resource = resource();
    String descriptor = "{\"request\":{\"method\":\"POST\",\"url\":\"" + origin
        + "/echo\",\"bodyMode\":\"formdata\",\"formData\":["
        + "{\"key\":\"note\",\"type\":\"text\",\"value\":\"hello\"},"
        + "{\"key\":\"upload\",\"type\":\"file\",\"fileName\":\"payload.txt\"}]}}";

    Response response = resource.executeMultipart(
        "1",
        null,
        List.of(
            new TestEntityPart("descriptor", null, MediaType.APPLICATION_JSON_TYPE, descriptor.getBytes(StandardCharsets.UTF_8)),
            new TestEntityPart("formData[1]", "payload.txt", MediaType.TEXT_PLAIN_TYPE, "file-body".getBytes(StandardCharsets.UTF_8))));

    assertEquals(200, response.getStatus());
    String json = (String) response.getEntity();
    assertTrue(json.contains("payload.txt"));
    assertTrue(json.contains("file-body"));
  }

  @Test
  void requiresExecutionMarkerBeforeReadingBody() {
    Response response = resource().execute(null, null, null);
    assertEquals(403, response.getStatus());
    assertEquals("no-store", response.getHeaderString("Cache-Control"));
    assertTrue(((String) response.getEntity()).contains("Missing X-FlexDoc-Execute header"));
  }

  @Test
  void rejectsOversizedDeclaredEnvelope() {
    Response response = resource().execute("1", Integer.toString(32 * 1024 * 1024 + 1), new ByteArrayInputStream(new byte[0]));
    assertEquals(400, response.getStatus());
    assertTrue(((String) response.getEntity()).contains("32 MiB safety limit"));
  }

  @Test
  void advertisesHostExecutionOnlyWhenExecutorIsAttached() throws Exception {
    Response response = resource().documentation();
    String html = new String((byte[]) response.getEntity(), StandardCharsets.UTF_8);
    assertTrue(html.contains("\"hostExecution\":{\"available\":true"));
    assertTrue(html.contains("\"capabilities\":[]"));
  }

  private FlexDocJaxRsResource resource() {
    FlexDocConfig config = new FlexDocConfig(
        "/docs", "/openapi.json", "Test API", "light", true,
        null, null, null, null, true);
    FlexDocHost host = new FlexDocHost(config, null, new FlexDocHostExecution(List.of(origin)));
    return new FlexDocJaxRsResource(host);
  }

  private static final class TestEntityPart implements EntityPart {
    private final String name;
    private final String fileName;
    private final MediaType mediaType;
    private final byte[] bytes;

    TestEntityPart(String name, String fileName, MediaType mediaType, byte[] bytes) {
      this.name = name;
      this.fileName = fileName;
      this.mediaType = mediaType;
      this.bytes = bytes;
    }

    @Override public String getName() { return name; }
    @Override public Optional<String> getFileName() { return Optional.ofNullable(fileName); }
    @Override public InputStream getContent() { return new ByteArrayInputStream(bytes); }
    @Override public MediaType getMediaType() { return mediaType; }
    @Override public MultivaluedMap<String, String> getHeaders() {
      MultivaluedMap<String, String> headers = new MultivaluedHashMap<>();
      if (mediaType != null) headers.putSingle(HttpHeaders.CONTENT_TYPE, mediaType.toString());
      return headers;
    }
    @Override public <T> T getContent(Class<T> type) throws IOException {
      if (type == InputStream.class) return type.cast(getContent());
      if (type == String.class) return type.cast(new String(bytes, StandardCharsets.UTF_8));
      throw new IOException("Unsupported test conversion: " + type.getName());
    }
    @Override public <T> T getContent(GenericType<T> type) throws IOException {
      throw new IOException("Generic conversion is not used by this test part.");
    }
  }
}
