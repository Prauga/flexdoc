package com.prauga.flexdoc.jvm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

final class FlexDocHostExecutionPolicyTest {
  @Test
  void acceptsOrdinaryCanonicalRequest() {
    assertNull(FlexDocHostExecutionPolicy.validate(Map.of(
        "request", Map.of("method", "GET", "url", "https://api.example.test/resource"))));
  }

  @Test
  void rejectsUnsupportedServerSideSessionAndCertificateState() {
    assertEquals(
        "Session cookie jars are not implemented by the JVM host executor.",
        FlexDocHostExecutionPolicy.validate(Map.of(
            "cookieJar", "session",
            "request", Map.of("method", "GET", "url", "https://api.example.test/resource"))));

    assertEquals(
        "Client certificates are not implemented by the JVM host executor.",
        FlexDocHostExecutionPolicy.validate(Map.of(
            "certificateId", "client-cert",
            "request", Map.of("method", "GET", "url", "https://api.example.test/resource"))));
  }

  @Test
  void rejectsUnsafeAndInjectedAuthHeaders() {
    assertEquals(
        "Unsafe host execution request header: Host",
        FlexDocHostExecutionPolicy.validate(Map.of(
            "request", Map.of(
                "method", "GET",
                "url", "https://api.example.test/resource",
                "auth", Map.of("type", "apiKey", "in", "header", "key", "Host", "value", "evil.example")))));

    assertEquals(
        "Invalid host execution request header: X-Api-Key",
        FlexDocHostExecutionPolicy.validate(Map.of(
            "request", Map.of(
                "method", "GET",
                "url", "https://api.example.test/resource",
                "auth", Map.of("type", "apiKey", "in", "header", "key", "X-Api-Key", "value", "secret\r\nX-Evil: yes")))));
  }

  @Test
  void rejectsDerivedContentTypeInjection() {
    assertEquals(
        "Invalid host execution content type.",
        FlexDocHostExecutionPolicy.validate(Map.of(
            "request", Map.of(
                "method", "POST",
                "url", "https://api.example.test/upload",
                "bodyMode", "formdata",
                "formData", List.of(Map.of(
                    "key", "upload",
                    "type", "file",
                    "contentType", "text/plain\r\nX-Evil: yes"))))));
  }
}
