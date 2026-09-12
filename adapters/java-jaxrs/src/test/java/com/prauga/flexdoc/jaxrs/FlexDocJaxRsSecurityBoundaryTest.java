package com.prauga.flexdoc.jaxrs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.prauga.flexdoc.jvm.FlexDocConfig;
import com.prauga.flexdoc.jvm.FlexDocHost;
import com.prauga.flexdoc.jvm.FlexDocHostExecution;
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
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

final class FlexDocJaxRsSecurityBoundaryTest {
  @Test
  void executeRouteIsExternallyAbsentWithoutNativeExecutor() {
    FlexDocJaxRsResource resource = new FlexDocJaxRsResource(host(null));

    Response json = resource.execute("1", null, new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8)));
    Response multipart = resource.executeMultipart("1", null, List.of());

    assertEquals(404, json.getStatus());
    assertEquals(404, multipart.getStatus());
    assertEquals("no-store", json.getHeaderString("Cache-Control"));
    assertEquals("no-store", multipart.getHeaderString("Cache-Control"));
  }

  @Test
  void invalidMultipartContentLengthIsCanonicalBadRequest() {
    FlexDocJaxRsResource resource = new FlexDocJaxRsResource(host(new FlexDocHostExecution(List.of("https://api.example.test"))));

    Response response = resource.executeMultipart("1", "not-a-number", List.of());

    assertEquals(400, response.getStatus());
    assertTrue(((String) response.getEntity()).contains("Content-Length is invalid"));
  }

  @Test
  void overflowingMultipartFileIndexIsCanonicalBadRequest() {
    FlexDocJaxRsResource resource = new FlexDocJaxRsResource(host(new FlexDocHostExecution(List.of("https://api.example.test"))));
    byte[] descriptor = "{\"request\":{\"method\":\"POST\",\"url\":\"https://api.example.test/upload\",\"bodyMode\":\"formdata\",\"formData\":[]}}"
        .getBytes(StandardCharsets.UTF_8);

    Response response = resource.executeMultipart(
        "1",
        null,
        List.of(
            new TestEntityPart("descriptor", null, MediaType.APPLICATION_JSON_TYPE, descriptor),
            new TestEntityPart("formData[999999999999999999999999]", "payload.txt", MediaType.TEXT_PLAIN_TYPE, new byte[] {1})));

    assertEquals(400, response.getStatus());
    assertTrue(((String) response.getEntity()).contains("file index is invalid"));
  }

  private static FlexDocHost host(FlexDocHostExecution execution) {
    FlexDocConfig config = new FlexDocConfig(
        "/docs", "/openapi.json", "Test API", "light", true,
        null, null, null, null, true);
    return new FlexDocHost(config, null, execution);
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
