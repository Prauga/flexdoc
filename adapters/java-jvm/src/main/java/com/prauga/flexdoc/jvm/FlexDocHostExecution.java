package com.prauga.flexdoc.jvm;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Framework-neutral Java 17 implementation of the existing FlexDoc host-execution envelope.
 *
 * <p>This first native executor intentionally advertises no host-only authentication capabilities.
 * Browser-capable none/basic/bearer/OAuth2/API-key requests are supported so the same resolved
 * request draft can execute through a Spring host. Cookies, certificates, Digest, Hawk, NTLM,
 * OAuth 1.0, and AWS Signature V4 remain unavailable until implemented natively.</p>
 */
public final class FlexDocHostExecution {
  private static final Set<String> METHODS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS");
  private static final Set<String> HOP_BY_HOP = Set.of(
      "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer",
      "transfer-encoding", "upgrade", "host", "content-length", "set-cookie");
  private static final int MAX_REDIRECTS = 5;
  private static final int MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
  private static final long DEFAULT_TIMEOUT_MS = 30_000L;
  private static final long MIN_TIMEOUT_MS = 100L;
  private static final long MAX_TIMEOUT_MS = 120_000L;

  private final Set<String> allowedOrigins;
  private final HttpClient client;

  /**
   * Creates a JVM executor with an explicit exact-origin allowlist.
   *
   * @param allowedOrigins allowed HTTP(S) target origins; wildcards are not supported
   */
  public FlexDocHostExecution(List<String> allowedOrigins) {
    LinkedHashSet<String> normalized = new LinkedHashSet<>();
    for (String value : allowedOrigins == null ? List.<String>of() : allowedOrigins) {
      if (value == null || value.isBlank()) continue;
      URI uri = parseAbsoluteHttpUri(value, "Host execution allowed origins must be absolute HTTP(S) origins.");
      if (uri.getRawUserInfo() != null
          || uri.getRawPath() != null && !uri.getRawPath().isEmpty() && !uri.getRawPath().equals("/")
          || uri.getRawQuery() != null
          || uri.getRawFragment() != null) {
        throw new IllegalArgumentException("Host execution allowed origins cannot contain credentials, paths, queries, or fragments: " + value);
      }
      normalized.add(origin(uri));
    }
    if (normalized.isEmpty()) {
      throw new IllegalArgumentException("FlexDoc host execution requires at least one exact allowed origin.");
    }
    this.allowedOrigins = Set.copyOf(normalized);
    this.client = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .connectTimeout(Duration.ofSeconds(10))
        .build();
  }

  /** @return host-only capabilities implemented by this native executor */
  public List<String> capabilities() { return List.of(); }

  /** @return immutable exact-origin allowlist */
  public Set<String> allowedOrigins() { return allowedOrigins; }

  /**
   * Handles the adapter-owned execute route using the canonical JSON execution envelope.
   *
   * @param executeMarker value of the incoming X-FlexDoc-Execute header
   * @param envelope canonical execution envelope parsed by the framework transport
   * @return HTTP route status and JSON-serializable response body
   */
  public FlexDocHostExecutionResult handle(String executeMarker, Map<String, Object> envelope) {
    return handle(executeMarker, envelope, Map.of());
  }

  /** Handles one canonical execute envelope plus indexed multipart file parts. */
  public FlexDocHostExecutionResult handle(
      String executeMarker,
      Map<String, Object> envelope,
      Map<Integer, FlexDocHostExecutionFile> files) {
    if (!"1".equals(executeMarker)) {
      return new FlexDocHostExecutionResult(403, Map.of("error", "Missing X-FlexDoc-Execute header."));
    }
    try {
      return new FlexDocHostExecutionResult(200, execute(envelope, files));
    } catch (FlexDocHostExecutionException error) {
      return new FlexDocHostExecutionResult(error.status(), Map.of("error", error.getMessage()));
    } catch (RuntimeException error) {
      return new FlexDocHostExecutionResult(502, Map.of("error", "API host execution failed."));
    }
  }

  /** Executes one canonical host request without uploaded multipart file parts. */
  public Map<String, Object> execute(Map<String, Object> envelope) {
    return execute(envelope, Map.of());
  }

  /** Executes one canonical host request with indexed multipart file parts. */
  public Map<String, Object> execute(
      Map<String, Object> envelope,
      Map<Integer, FlexDocHostExecutionFile> files) {
    if (envelope == null) throw badRequest("Host execution body must be a JSON object.");
    Map<String, Object> draft = object(envelope.get("request"), "Host execution body requires a canonical request draft.");
    String rawUrl = string(draft.get("url"));
    if (rawUrl == null || rawUrl.isBlank()) throw badRequest("Host execution requires an absolute request URL.");
    URI url = parseTarget(rawUrl);
    url = appendQuery(url, entries(draft.get("query")));

    String method = string(draft.get("method"));
    method = method == null || method.isBlank() ? "GET" : method.trim().toUpperCase(Locale.ROOT);
    if (!METHODS.contains(method)) throw badRequest("Unsupported host execution HTTP method: " + method);

    List<Header> headers = sanitizeHeaders(entries(draft.get("headers")));
    applyAuth(draft.get("auth"), method, url, headers);
    String bodyMode = inferBodyMode(draft);
    Body body = prepareBody(draft, envelope, files == null ? Map.of() : files, bodyMode);
    if ("formdata".equals(bodyMode)) deleteHeader(headers, "Content-Type");
    if (body.contentType() != null && header(headers, "Content-Type") == null) {
      setHeader(headers, "Content-Type", body.contentType());
    }

    long timeoutMs = number(envelope.get("timeoutMs"), DEFAULT_TIMEOUT_MS);
    timeoutMs = Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, timeoutMs));
    return executeWithRedirects(method, url, headers, body.bytes(), timeoutMs, draft.get("auth"));
  }

  private Map<String, Object> executeWithRedirects(
      String initialMethod,
      URI initialUrl,
      List<Header> initialHeaders,
      byte[] initialBody,
      long timeoutMs,
      Object rawAuth) {
    String method = initialMethod;
    URI url = initialUrl;
    byte[] body = initialBody;
    List<Header> headers = new ArrayList<>(initialHeaders);

    for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      url = applyQueryAuth(rawAuth, url);
      assertAllowed(url);
      long started = System.nanoTime();
      ByteArrayOutputStream receivedBody = new ByteArrayOutputStream();
      HttpResponse<Void> response;
      CompletableFuture<HttpResponse<Void>> future;
      try {
        HttpRequest.Builder builder = HttpRequest.newBuilder(url).timeout(Duration.ofMillis(timeoutMs));
        for (Header header : headers) builder.header(header.name(), header.value());
        HttpRequest.BodyPublisher publisher = body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofByteArray(body);
        builder.method(method, publisher);
        future = client.sendAsync(builder.build(), HttpResponse.BodyHandlers.ofByteArrayConsumer(chunk -> {
          if (chunk.isEmpty()) return;
          byte[] bytes = chunk.get();
          if ((long) receivedBody.size() + bytes.length > MAX_RESPONSE_BYTES) {
            throw new ResponseLimitExceeded();
          }
          receivedBody.writeBytes(bytes);
        }));
      } catch (IllegalArgumentException error) {
        throw upstream("Host execution request failed: " + error.getMessage());
      }
      try {
        response = future.get(timeoutMs, TimeUnit.MILLISECONDS);
      } catch (TimeoutException error) {
        future.cancel(true);
        throw upstream("Host execution request timed out after " + timeoutMs + " ms.");
      } catch (InterruptedException error) {
        future.cancel(true);
        Thread.currentThread().interrupt();
        throw upstream("Host execution was interrupted.");
      } catch (ExecutionException error) {
        if (causedByResponseLimit(error)) {
          throw upstream("Host execution response exceeded the 10 MiB safety limit.");
        }
        Throwable cause = error.getCause();
        String message = cause == null || cause.getMessage() == null ? "unknown transport error" : cause.getMessage();
        throw upstream("Host execution request failed: " + message);
      } catch (RuntimeException error) {
        if (causedByResponseLimit(error)) {
          throw upstream("Host execution response exceeded the 10 MiB safety limit.");
        }
        throw error;
      }
      long elapsedMs = Math.max(0L, (System.nanoTime() - started) / 1_000_000L);

      int status = response.statusCode();
      String location = response.headers().firstValue("location").orElse(null);
      if (isRedirect(status) && location != null) {
        if (redirect == MAX_REDIRECTS) throw forbidden("Host execution exceeded the redirect safety limit.");
        URI next;
        try { next = url.resolve(location); }
        catch (IllegalArgumentException error) { throw badRequest("Host execution received an invalid redirect URL."); }
        if (!origin(next).equals(origin(url))) {
          throw forbidden("Host execution does not follow cross-origin redirects.");
        }
        assertAllowed(next);
        if (status == 303) {
          method = "GET";
          body = null;
          deleteHeader(headers, "Content-Type");
        }
        url = next;
        continue;
      }

      byte[] responseBody = receivedBody.toByteArray();
      List<List<String>> responseHeaders = new ArrayList<>();
      response.headers().map().forEach((name, values) -> {
        for (String value : values) responseHeaders.add(List.of(name, value));
      });

      Map<String, Object> out = new LinkedHashMap<>();
      out.put("status", status);
      out.put("statusText", reasonPhrase(status));
      out.put("headers", responseHeaders);
      out.put("body", new String(responseBody, StandardCharsets.UTF_8));
      out.put("responseTime", elapsedMs);
      return out;
    }
    throw forbidden("Host execution exceeded the redirect safety limit.");
  }

  private void assertAllowed(URI uri) {
    if (!isHttp(uri)) throw forbidden("Host execution only allows HTTP(S) URLs.");
    if (uri.getRawUserInfo() != null) throw forbidden("Host execution URLs cannot contain embedded credentials.");
    if (!allowedOrigins.contains(origin(uri))) {
      throw forbidden("Origin " + origin(uri) + " is not allowed for host execution.");
    }
    String host = uri.getHost();
    if (host == null || host.isBlank()) throw badRequest("Host execution URL is missing a hostname.");
    if (isMetadataHost(host)) throw forbidden("Host execution blocks link-local and cloud metadata endpoints.");
    try {
      for (InetAddress address : InetAddress.getAllByName(host)) {
        if (address.isLinkLocalAddress() || isMetadataAddress(address)) {
          throw forbidden("Host execution blocks DNS resolutions to link-local and cloud metadata endpoints.");
        }
      }
    } catch (FlexDocHostExecutionException error) {
      throw error;
    } catch (IOException error) {
      throw upstream("Host execution could not resolve target hostname.");
    }
  }

  private static boolean isMetadataHost(String host) {
    String value = stripBrackets(host).toLowerCase(Locale.ROOT);
    return value.equals("169.254.169.254")
        || value.equals("metadata.google.internal")
        || value.equals("metadata.google")
        || value.equals("fe80::a9fe:a9fe")
        || value.startsWith("fe80:");
  }

  private static boolean isMetadataAddress(InetAddress address) {
    byte[] bytes = address.getAddress();
    if (bytes.length == 4) return (bytes[0] & 0xff) == 169 && (bytes[1] & 0xff) == 254;
    if (address instanceof Inet6Address && address.isLinkLocalAddress()) return true;
    if (bytes.length == 16 && isIpv4Mapped(bytes)) {
      return (bytes[12] & 0xff) == 169 && (bytes[13] & 0xff) == 254;
    }
    return false;
  }

  private static boolean isIpv4Mapped(byte[] bytes) {
    if (bytes.length != 16) return false;
    for (int index = 0; index < 10; index++) if (bytes[index] != 0) return false;
    return (bytes[10] & 0xff) == 0xff && (bytes[11] & 0xff) == 0xff;
  }

  private static URI appendQuery(URI source, List<Map<String, Object>> query) {
    if (query.isEmpty()) return source;
    StringBuilder raw = new StringBuilder(source.getRawQuery() == null ? "" : source.getRawQuery());
    for (Map<String, Object> entry : query) {
      if (Boolean.FALSE.equals(entry.get("enabled"))) continue;
      String key = string(entry.get("key"));
      if (key == null || key.isBlank()) continue;
      if (raw.length() > 0) raw.append('&');
      raw.append(urlEncode(key)).append('=').append(urlEncode(stringOrEmpty(entry.get("value"))));
    }
    try {
      StringBuilder target = new StringBuilder(source.getScheme()).append("://").append(source.getRawAuthority());
      if (source.getRawPath() != null) target.append(source.getRawPath());
      if (raw.length() > 0) target.append('?').append(raw);
      if (source.getRawFragment() != null) target.append('#').append(source.getRawFragment());
      return URI.create(target.toString());
    } catch (IllegalArgumentException error) {
      throw badRequest("Host execution query parameters produced an invalid URL.");
    }
  }

  private static List<Header> sanitizeHeaders(List<Map<String, Object>> entries) {
    List<Header> out = new ArrayList<>();
    for (Map<String, Object> entry : entries) {
      if (Boolean.FALSE.equals(entry.get("enabled"))) continue;
      String key = string(entry.get("key"));
      if (key == null || key.isBlank()) continue;
      String normalized = key.trim().toLowerCase(Locale.ROOT);
      if (HOP_BY_HOP.contains(normalized) || normalized.startsWith("proxy-") || normalized.startsWith("sec-")
          || normalized.equals("origin") || normalized.equals("referer")) continue;
      out.add(new Header(key.trim(), stringOrEmpty(entry.get("value"))));
    }
    return out;
  }

  private static URI applyQueryAuth(Object rawAuth, URI url) {
    if (!(rawAuth instanceof Map<?, ?> rawMap)) return url;
    Map<String, Object> auth = stringMap(rawMap);
    if (!"apiKey".equals(string(auth.get("type"))) || !"query".equals(string(auth.get("in")))) return url;
    String key = string(auth.get("key"));
    if (key == null || key.isBlank()) throw badRequest("API key authentication requires a key name.");
    return appendQuery(url, List.of(Map.of("key", key, "value", stringOrEmpty(auth.get("value")))));
  }

  private static void applyAuth(Object rawAuth, String method, URI url, List<Header> headers) {
    if (!(rawAuth instanceof Map<?, ?> rawMap)) return;
    Map<String, Object> auth = stringMap(rawMap);
    String type = string(auth.get("type"));
    if (type == null || type.equals("none") || type.equals("inherit")) return;
    switch (type) {
      case "bearer" -> {
        String token = stringOrEmpty(auth.get("token"));
        if (!token.isEmpty()) setHeader(headers, "Authorization", "Bearer " + token);
      }
      case "oauth2" -> {
        String token = stringOrEmpty(auth.get("accessToken"));
        if (!token.isEmpty()) setHeader(headers, "Authorization", "Bearer " + token);
      }
      case "basic" -> {
        String value = stringOrEmpty(auth.get("username")) + ":" + stringOrEmpty(auth.get("password"));
        setHeader(headers, "Authorization", "Basic " + Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8)));
      }
      case "apiKey" -> {
        String key = string(auth.get("key"));
        if (key == null || key.isBlank()) throw badRequest("API key authentication requires a key name.");
        String value = stringOrEmpty(auth.get("value"));
        String location = string(auth.get("in"));
        if (location == null || location.equals("header")) setHeader(headers, key, value);
        else if (location.equals("query")) { /* applied to the target URL before transport */ }
        else if (location.equals("cookie")) throw unsupported("Cookie authentication is not implemented by the JVM host executor.");
        else throw badRequest("Unsupported API key location: " + location);
      }
      default -> throw unsupported("Authentication type " + type + " is not implemented by the JVM host executor.");
    }
  }

  private static String inferBodyMode(Map<String, Object> draft) {
    String mode = string(draft.get("bodyMode"));
    if (mode != null && !mode.isBlank()) return mode;
    if (draft.get("binary") != null) return "binary";
    if (draft.get("formData") != null) return "formdata";
    if (draft.get("urlencoded") != null) return "urlencoded";
    if (draft.get("graphql") != null) return "graphql";
    if (draft.get("body") == null || stringOrEmpty(draft.get("body")).isEmpty()) return "none";
    return stringOrEmpty(draft.get("contentType")).toLowerCase(Locale.ROOT).contains("json") ? "json" : "raw";
  }

  private static Body prepareBody(
      Map<String, Object> draft,
      Map<String, Object> envelope,
      Map<Integer, FlexDocHostExecutionFile> files,
      String mode) {
    String explicitContentType = string(draft.get("contentType"));
    return switch (mode) {
      case "none" -> new Body(null, null);
      case "raw" -> new Body(stringOrEmpty(draft.get("body")).getBytes(StandardCharsets.UTF_8), explicitContentType);
      case "json" -> new Body(stringOrEmpty(draft.get("body")).getBytes(StandardCharsets.UTF_8), explicitContentType == null ? "application/json" : explicitContentType);
      case "binary" -> {
        String base64 = string(envelope.get("bodyBase64"));
        if (base64 == null) throw badRequest("Binary host execution requires bodyBase64.");
        String binaryContentType = explicitContentType;
        if (binaryContentType == null && draft.get("binary") instanceof Map<?, ?> rawBinary) {
          binaryContentType = string(stringMap(rawBinary).get("contentType"));
        }
        if (binaryContentType == null || binaryContentType.isBlank()) binaryContentType = "application/octet-stream";
        try { yield new Body(Base64.getDecoder().decode(base64), binaryContentType); }
        catch (IllegalArgumentException error) { throw badRequest("Binary host execution bodyBase64 is invalid."); }
      }
      case "urlencoded" -> new Body(formUrlEncoded(entries(draft.get("urlencoded"))).getBytes(StandardCharsets.UTF_8), explicitContentType == null ? "application/x-www-form-urlencoded" : explicitContentType);
      case "graphql" -> new Body(graphqlBody(draft.get("graphql")).getBytes(StandardCharsets.UTF_8), explicitContentType == null ? "application/json" : explicitContentType);
      case "formdata" -> multipartBody(entries(draft.get("formData")), files);
      default -> throw unsupported("Body mode " + mode + " is not implemented by the JVM host executor.");
    };
  }

  private static Body multipartBody(
      List<Map<String, Object>> entries,
      Map<Integer, FlexDocHostExecutionFile> files) {
    String boundary = "----flexdoc-" + UUID.randomUUID().toString().replace("-", "");
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    try {
      for (int index = 0; index < entries.size(); index++) {
        Map<String, Object> entry = entries.get(index);
        if (Boolean.FALSE.equals(entry.get("enabled"))) continue;
        String key = string(entry.get("key"));
        if (key == null || key.isBlank()) continue;
        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        if ("file".equals(string(entry.get("type")))) {
          FlexDocHostExecutionFile file = files.get(index);
          if (file == null) throw badRequest("File field \"" + key + "\" needs an uploaded file part.");
          String fileName = file.name() == null || file.name().isBlank()
              ? (string(entry.get("fileName")) == null ? "upload.bin" : string(entry.get("fileName")))
              : file.name();
          String contentType = file.contentType();
          if (contentType == null || contentType.isBlank()) contentType = string(entry.get("contentType"));
          if (contentType == null || contentType.isBlank()) contentType = "application/octet-stream";
          out.write(("Content-Disposition: form-data; name=\"" + quoteMultipart(key)
              + "\"; filename=\"" + quoteMultipart(fileName) + "\"\r\n"
              + "Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
          out.write(file.data());
          out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        } else {
          out.write(("Content-Disposition: form-data; name=\"" + quoteMultipart(key) + "\"\r\n\r\n"
              + stringOrEmpty(entry.get("value")) + "\r\n").getBytes(StandardCharsets.UTF_8));
        }
      }
      out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
    } catch (IOException impossible) {
      throw new IllegalStateException(impossible);
    }
    return new Body(out.toByteArray(), "multipart/form-data; boundary=" + boundary);
  }

  private static String graphqlBody(Object value) {
    Map<String, Object> graphql = object(value, "GraphQL host execution requires a GraphQL request descriptor.");
    String query = stringOrEmpty(graphql.get("query"));
    String variables = string(graphql.get("variables"));
    if (variables == null || variables.isBlank()) variables = "{}";
    String trimmed = variables.trim();
    if (!(trimmed.startsWith("{") && trimmed.endsWith("}"))) throw badRequest("GraphQL variables must be a JSON object.");
    return "{\"query\":" + jsonString(query) + ",\"variables\":" + trimmed + "}";
  }

  private static String formUrlEncoded(List<Map<String, Object>> entries) {
    StringBuilder out = new StringBuilder();
    for (Map<String, Object> entry : entries) {
      if (Boolean.FALSE.equals(entry.get("enabled"))) continue;
      String key = string(entry.get("key"));
      if (key == null || key.isBlank()) continue;
      if (out.length() > 0) out.append('&');
      out.append(urlEncode(key)).append('=').append(urlEncode(stringOrEmpty(entry.get("value"))));
    }
    return out.toString();
  }

  private static String quoteMultipart(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "").replace("\n", "");
  }

  private static String jsonString(String value) {
    StringBuilder out = new StringBuilder("\"");
    for (int index = 0; index < value.length(); index++) {
      char ch = value.charAt(index);
      switch (ch) {
        case '\"' -> out.append("\\\"");
        case '\\' -> out.append("\\\\");
        case '\n' -> out.append("\\n");
        case '\r' -> out.append("\\r");
        case '\t' -> out.append("\\t");
        default -> {
          if (ch < 0x20) out.append(String.format("\\u%04x", (int) ch));
          else out.append(ch);
        }
      }
    }
    return out.append('\"').toString();
  }

  private static String urlEncode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
  }

  private static URI parseTarget(String value) {
    try {
      URI uri = parseAbsoluteHttpUri(value, "Host execution requires an absolute HTTP(S) request URL.");
      if (uri.getRawUserInfo() != null) throw forbidden("Host execution URLs cannot contain embedded credentials.");
      return uri;
    } catch (FlexDocHostExecutionException error) {
      throw error;
    } catch (IllegalArgumentException error) {
      throw badRequest("Host execution requires an absolute HTTP(S) request URL.");
    }
  }

  private static URI parseAbsoluteHttpUri(String value, String message) {
    try {
      URI uri = URI.create(value);
      if (!uri.isAbsolute() || !isHttp(uri) || uri.getHost() == null) throw new IllegalArgumentException();
      return uri;
    } catch (IllegalArgumentException error) {
      throw new IllegalArgumentException(message);
    }
  }

  private static boolean isHttp(URI uri) {
    return "http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme());
  }

  private static String origin(URI uri) {
    String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
    String host = stripBrackets(uri.getHost()).toLowerCase(Locale.ROOT);
    int port = uri.getPort();
    boolean defaultPort = port < 0 || (scheme.equals("http") && port == 80) || (scheme.equals("https") && port == 443);
    return scheme + "://" + (host.contains(":") ? "[" + host + "]" : host) + (defaultPort ? "" : ":" + port);
  }

  private static String stripBrackets(String value) {
    return value == null ? "" : value.replaceAll("^\\[|\\]$", "");
  }

  private static boolean isRedirect(int status) {
    return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
  }

  private static boolean causedByResponseLimit(Throwable error) {
    for (Throwable current = error; current != null; current = current.getCause()) {
      if (current instanceof ResponseLimitExceeded) return true;
    }
    return false;
  }

  private static String reasonPhrase(int status) {
    return switch (status) {
      case 200 -> "OK";
      case 201 -> "Created";
      case 202 -> "Accepted";
      case 204 -> "No Content";
      case 301 -> "Moved Permanently";
      case 302 -> "Found";
      case 303 -> "See Other";
      case 304 -> "Not Modified";
      case 307 -> "Temporary Redirect";
      case 308 -> "Permanent Redirect";
      case 400 -> "Bad Request";
      case 401 -> "Unauthorized";
      case 403 -> "Forbidden";
      case 404 -> "Not Found";
      case 405 -> "Method Not Allowed";
      case 409 -> "Conflict";
      case 422 -> "Unprocessable Content";
      case 429 -> "Too Many Requests";
      case 500 -> "Internal Server Error";
      case 502 -> "Bad Gateway";
      case 503 -> "Service Unavailable";
      case 504 -> "Gateway Timeout";
      default -> "";
    };
  }

  private static String header(List<Header> headers, String name) {
    for (Header header : headers) if (header.name().equalsIgnoreCase(name)) return header.value();
    return null;
  }

  private static void setHeader(List<Header> headers, String name, String value) {
    deleteHeader(headers, name);
    headers.add(new Header(name, value));
  }

  private static void deleteHeader(List<Header> headers, String name) {
    headers.removeIf(header -> header.name().equalsIgnoreCase(name));
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> entries(Object value) {
    if (!(value instanceof List<?> values)) return List.of();
    List<Map<String, Object>> out = new ArrayList<>();
    for (Object item : values) {
      if (item instanceof Map<?, ?> map) out.add(stringMap(map));
    }
    return out;
  }

  private static Map<String, Object> object(Object value, String message) {
    if (!(value instanceof Map<?, ?> map)) throw badRequest(message);
    return stringMap(map);
  }

  private static Map<String, Object> stringMap(Map<?, ?> map) {
    Map<String, Object> out = new LinkedHashMap<>();
    map.forEach((key, value) -> {
      if (key instanceof String string) out.put(string, value);
    });
    return out;
  }

  private static String string(Object value) { return value instanceof String string ? string : null; }
  private static String stringOrEmpty(Object value) { return value == null ? "" : String.valueOf(value); }
  private static long number(Object value, long fallback) { return value instanceof Number number ? number.longValue() : fallback; }

  private static FlexDocHostExecutionException badRequest(String message) { return new FlexDocHostExecutionException(400, message); }
  private static FlexDocHostExecutionException unsupported(String message) { return new FlexDocHostExecutionException(400, message); }
  private static FlexDocHostExecutionException forbidden(String message) { return new FlexDocHostExecutionException(403, message); }
  private static FlexDocHostExecutionException upstream(String message) { return new FlexDocHostExecutionException(502, message); }

  private static final class ResponseLimitExceeded extends RuntimeException {}
  private record Header(String name, String value) {}
  private record Body(byte[] bytes, String contentType) {}
}
