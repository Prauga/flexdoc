package com.prauga.flexdoc.spring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.SpringVersion;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/** Builds observational Runtime Intelligence snapshots from Spring MVC's live request-mapping registry. */
final class SpringRuntimeIntelligence {
  private static final Set<String> HTTP_METHODS = Set.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD", "TRACE");

  record RuntimeRoute(String method, String path) {}
  record Discovery(List<RuntimeRoute> routes, boolean complete) {}

  private final FlexDocProperties properties;
  private final FlexDocSpecProvider specProvider;
  private final ObjectProvider<RequestMappingHandlerMapping> handlerMappingProvider;
  private final ObjectMapper objectMapper;
  private final Environment environment;

  SpringRuntimeIntelligence(
      FlexDocProperties properties,
      FlexDocSpecProvider specProvider,
      ObjectProvider<RequestMappingHandlerMapping> handlerMappingProvider,
      ObjectMapper objectMapper,
      Environment environment) {
    this.properties = properties;
    this.specProvider = specProvider;
    this.handlerMappingProvider = handlerMappingProvider;
    this.objectMapper = objectMapper;
    this.environment = environment;
  }

  Map<String, Object> snapshot(HttpServletRequest request) throws Exception {
    RequestMappingHandlerMapping handlerMapping = handlerMappingProvider.getIfAvailable();
    if (handlerMapping == null) throw new IllegalStateException("Spring MVC request mapping registry is unavailable");
    Object document = specProvider.getOpenApiDocument();
    if (document == null) throw new IllegalStateException("FlexDocSpecProvider returned no OpenAPI document");
    JsonNode spec = objectMapper.valueToTree(document);
    return buildSnapshot(
        handlerMapping.getHandlerMethods().keySet(),
        spec,
        request,
        properties.getPath(),
        properties.getSpecUrl(),
        activeEnvironmentName(environment));
  }

  static Map<String, Object> buildSnapshot(
      Iterable<RequestMappingInfo> mappings,
      JsonNode spec,
      HttpServletRequest request,
      String docsPath,
      String specUrl,
      String environmentName) {
    Discovery discovery = discoverRoutes(mappings, docsPath, specUrl);
    List<RuntimeRoute> documented = documentedRoutes(spec);
    Set<String> documentedKeys = new LinkedHashSet<>();
    for (RuntimeRoute route : documented) documentedKeys.add(routeKey(route));
    Set<String> runtimeKeys = new LinkedHashSet<>();
    for (RuntimeRoute route : discovery.routes()) runtimeKeys.add(routeKey(route));

    List<RuntimeRoute> runtimeOnly = discovery.routes().stream().filter(route -> !documentedKeys.contains(routeKey(route))).toList();
    List<RuntimeRoute> documentedOnly = documented.stream().filter(route -> !runtimeKeys.contains(routeKey(route))).toList();
    long matched = discovery.routes().stream().filter(route -> documentedKeys.contains(routeKey(route))).count();

    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("framework", "spring");
    String springVersion = SpringVersion.getVersion();
    if (springVersion != null && !springVersion.isBlank()) snapshot.put("frameworkVersion", springVersion);
    snapshot.put("runtime", Map.of(
        "name", "java",
        "version", System.getProperty("java.version", "unknown"),
        "platform", System.getProperty("os.name", "unknown").toLowerCase(Locale.ROOT),
        "arch", System.getProperty("os.arch", "unknown")));
    String origin = serverOrigin(request);
    if (origin != null) snapshot.put("serverOrigin", origin);
    int localPort = request == null ? 0 : request.getLocalPort();
    if (localPort > 0) snapshot.put("server", Map.of("localPort", localPort));
    if (environmentName != null && !environmentName.isBlank()) snapshot.put("environment", Map.of("name", environmentName));
    snapshot.put("discoveryComplete", discovery.complete());
    snapshot.put("routes", routeObjects(discovery.routes()));
    snapshot.put("runtimeOnly", routeObjects(runtimeOnly));
    snapshot.put("documentedOnly", routeObjects(documentedOnly));
    snapshot.put("summary", Map.of(
        "documented", documented.size(),
        "runtime", discovery.routes().size(),
        "matched", matched,
        "runtimeOnly", runtimeOnly.size(),
        "documentedOnly", documentedOnly.size()));
    return snapshot;
  }

  static Discovery discoverRoutes(Iterable<RequestMappingInfo> mappings, String docsPath, String specUrl) {
    List<RuntimeRoute> routes = new ArrayList<>();
    boolean complete = true;
    String normalizedDocs = normalizePath(docsPath);
    String normalizedSpec = specPath(specUrl);

    for (RequestMappingInfo info : mappings) {
      Set<String> patterns = info.getPatternValues();
      Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
      if (patterns.isEmpty() || methods.isEmpty()) {
        complete = false;
        continue;
      }
      for (String rawPattern : patterns) {
        String path = normalizeRuntimePath(rawPattern);
        if (path == null) {
          complete = false;
          continue;
        }
        if (isExcluded(path, normalizedDocs, normalizedSpec)) continue;
        for (RequestMethod requestMethod : methods) {
          String method = requestMethod.name();
          if (!HTTP_METHODS.contains(method)) {
            complete = false;
            continue;
          }
          routes.add(new RuntimeRoute(method, path));
        }
      }
    }

    return new Discovery(withoutImplicitHead(uniqueSorted(routes)), complete);
  }

  static List<RuntimeRoute> documentedRoutes(JsonNode spec) {
    List<RuntimeRoute> routes = new ArrayList<>();
    JsonNode paths = spec == null ? null : spec.get("paths");
    if (paths == null || !paths.isObject()) return routes;
    paths.fields().forEachRemaining(pathEntry -> {
      if (!pathEntry.getValue().isObject()) return;
      pathEntry.getValue().fieldNames().forEachRemaining(methodName -> {
        String method = methodName.toUpperCase(Locale.ROOT);
        if (HTTP_METHODS.contains(method)) routes.add(new RuntimeRoute(method, normalizePath(pathEntry.getKey())));
      });
    });
    return uniqueSorted(routes);
  }

  static String normalizeRuntimePath(String value) {
    if (value == null || value.isBlank()) return "/";
    StringBuilder output = new StringBuilder();
    for (int index = 0; index < value.length();) {
      char ch = value.charAt(index);
      if (ch == '*') return null;
      if (ch != '{') {
        output.append(ch);
        index++;
        continue;
      }

      int start = index + 1;
      int depth = 1;
      int cursor = start;
      while (cursor < value.length() && depth > 0) {
        char current = value.charAt(cursor);
        if (current == '{') depth++;
        else if (current == '}') depth--;
        cursor++;
      }
      if (depth != 0) return null;

      String expression = value.substring(start, cursor - 1);
      if (expression.startsWith("*")) expression = expression.substring(1);
      int constraint = expression.indexOf(':');
      String name = constraint >= 0 ? expression.substring(0, constraint) : expression;
      if (name.isBlank() || !name.chars().allMatch(c -> Character.isLetterOrDigit(c) || c == '_')) return null;
      output.append('{').append(name).append('}');
      index = cursor;
    }
    return normalizePath(output.toString());
  }

  private static List<RuntimeRoute> uniqueSorted(List<RuntimeRoute> routes) {
    return routes.stream()
        .distinct()
        .sorted(Comparator.comparing(RuntimeRoute::path).thenComparing(RuntimeRoute::method))
        .toList();
  }

  private static List<RuntimeRoute> withoutImplicitHead(List<RuntimeRoute> routes) {
    Set<String> keys = new LinkedHashSet<>();
    for (RuntimeRoute route : routes) keys.add(routeKey(route));
    return routes.stream().filter(route -> !route.method().equals("HEAD") || !keys.contains("GET " + route.path())).toList();
  }

  private static List<Map<String, String>> routeObjects(List<RuntimeRoute> routes) {
    return routes.stream().map(route -> Map.of("method", route.method(), "path", route.path())).toList();
  }

  private static String routeKey(RuntimeRoute route) { return route.method() + " " + route.path(); }

  private static boolean isExcluded(String path, String docsPath, String specPath) {
    return path.equals(docsPath) || path.startsWith(docsPath + "/") || (specPath != null && path.equals(specPath));
  }

  private static String specPath(String specUrl) {
    if (specUrl == null || specUrl.isBlank()) return null;
    try {
      java.net.URI uri = java.net.URI.create(specUrl);
      String path = uri.getPath();
      return path == null || path.isBlank() ? null : normalizePath(path);
    } catch (IllegalArgumentException ignored) {
      String value = specUrl.split("[?#]", 2)[0];
      return value.isBlank() ? null : normalizePath(value);
    }
  }

  private static String normalizePath(String value) {
    String normalized = value == null ? "" : value.trim();
    if (!normalized.startsWith("/")) normalized = "/" + normalized;
    while (normalized.contains("//")) normalized = normalized.replace("//", "/");
    while (normalized.length() > 1 && normalized.endsWith("/")) normalized = normalized.substring(0, normalized.length() - 1);
    return normalized.isBlank() ? "/" : normalized;
  }

  private static String activeEnvironmentName(Environment environment) {
    if (environment == null) return null;
    String[] activeProfiles = environment.getActiveProfiles();
    return activeProfiles.length == 0 ? null : String.join(", ", activeProfiles);
  }

  private static String serverOrigin(HttpServletRequest request) {
    if (request == null) return null;
    String scheme = request.getScheme();
    if (scheme == null || scheme.isBlank()) scheme = "http";
    String hostHeader = request.getHeader("Host");
    if (hostHeader != null && !hostHeader.isBlank()) return scheme + "://" + hostHeader;
    String host = request.getServerName();
    if (host == null || host.isBlank()) return null;
    int port = request.getServerPort();
    boolean defaultPort = (scheme.equalsIgnoreCase("https") && port == 443) || (scheme.equalsIgnoreCase("http") && port == 80);
    return scheme + "://" + host + (port > 0 && !defaultPort ? ":" + port : "");
  }
}
