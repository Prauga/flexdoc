package com.prauga.flexdoc.jvm;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Fail-closed validation shared by JVM framework bindings before native host execution. */
public final class FlexDocHostExecutionPolicy {
  private static final Pattern HEADER_NAME = Pattern.compile("^[!#$%&'*+\\-.^_`|~0-9A-Za-z]+$");
  private static final Set<String> UNSAFE_HEADERS = Set.of(
      "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer",
      "transfer-encoding", "upgrade", "host", "content-length", "set-cookie", "origin", "referer");

  private FlexDocHostExecutionPolicy() {}

  /**
   * Returns a canonical bad-request message when server-side execution metadata is unsafe or unsupported.
   *
   * @param envelope canonical host-execution envelope
   * @return validation message, or {@code null} when the envelope may proceed
   */
  public static String validate(Map<String, Object> envelope) {
    if (envelope == null) return "Host execution body must be a JSON object.";
    if ("session".equals(string(envelope.get("cookieJar")))) {
      return "Session cookie jars are not implemented by the JVM host executor.";
    }
    String certificateId = string(envelope.get("certificateId"));
    if (certificateId != null && !certificateId.isBlank()) {
      return "Client certificates are not implemented by the JVM host executor.";
    }

    if (!(envelope.get("request") instanceof Map<?, ?> rawRequest)) {
      return "Host execution body requires a canonical request draft.";
    }
    Map<String, Object> request = stringMap(rawRequest);

    String error = validateContentType(string(request.get("contentType")));
    if (error != null) return error;

    if (request.get("binary") instanceof Map<?, ?> rawBinary) {
      error = validateContentType(string(stringMap(rawBinary).get("contentType")));
      if (error != null) return error;
    }

    Object rawFormData = request.get("formData");
    if (rawFormData instanceof List<?> rows) {
      for (Object row : rows) {
        if (!(row instanceof Map<?, ?> rawRow)) continue;
        error = validateContentType(string(stringMap(rawRow).get("contentType")));
        if (error != null) return error;
      }
    }

    if (request.get("auth") instanceof Map<?, ?> rawAuth) {
      Map<String, Object> auth = stringMap(rawAuth);
      String type = string(auth.get("type"));
      if ("apiKey".equals(type)) {
        String location = string(auth.get("in"));
        if (location == null || location.isBlank() || "header".equals(location)) {
          String key = string(auth.get("key"));
          if (key == null || key.isBlank()) return "API key authentication requires a key name.";
          key = key.trim();
          String normalized = key.toLowerCase(Locale.ROOT);
          if (unsafeHeader(normalized)) return "Unsafe host execution request header: " + key;
          if (!HEADER_NAME.matcher(key).matches()) return "Invalid host execution request header: " + key;
          if (containsLineBreak(string(auth.get("value")))) return "Invalid host execution request header: " + key;
        }
      } else if ("bearer".equals(type)) {
        if (containsLineBreak(string(auth.get("token")))) return "Invalid host execution request header: Authorization";
      } else if ("oauth2".equals(type)) {
        if (containsLineBreak(string(auth.get("accessToken")))) return "Invalid host execution request header: Authorization";
      }
    }

    return null;
  }

  private static String validateContentType(String value) {
    if (value == null || value.isBlank()) return null;
    return containsLineBreak(value) ? "Invalid host execution content type." : null;
  }

  private static boolean unsafeHeader(String normalized) {
    return UNSAFE_HEADERS.contains(normalized)
        || normalized.startsWith("proxy-")
        || normalized.startsWith("sec-");
  }

  private static boolean containsLineBreak(String value) {
    return value != null && (value.indexOf('\r') >= 0 || value.indexOf('\n') >= 0);
  }

  private static String string(Object value) {
    return value instanceof String string ? string : null;
  }

  private static Map<String, Object> stringMap(Map<?, ?> source) {
    java.util.LinkedHashMap<String, Object> out = new java.util.LinkedHashMap<>();
    source.forEach((key, value) -> {
      if (key instanceof String name) out.put(name, value);
    });
    return out;
  }
}
