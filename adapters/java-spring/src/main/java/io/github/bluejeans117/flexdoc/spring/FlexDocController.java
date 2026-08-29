package io.github.bluejeans117.flexdoc.spring;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FlexDocController {
  private final FlexDocProperties properties;
  private final FlexDocSpecProvider provider;
  private final ObjectMapper objectMapper;

  public FlexDocController(FlexDocProperties properties, FlexDocSpecProvider provider, ObjectMapper objectMapper) {
    this.properties = properties;
    this.provider = provider;
    this.objectMapper = objectMapper;
  }

  @GetMapping(value = "${flexdoc.path:/docs}", produces = MediaType.TEXT_HTML_VALUE)
  public ResponseEntity<String> documentation() throws Exception {
    String base = normalizedPath();
    String spec = safeScriptJson(provider.getOpenApiDocument());
    Map<String, Object> options = new LinkedHashMap<>();
    options.put("title", properties.getTitle());
    options.put("theme", properties.getTheme());
    options.put("tryIt", Map.of("enabled", properties.isTryItEnabled()));
    String optionsJson = safeScriptJson(options);
    String title = escapeHtml(properties.getTitle());
    String html = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        + "<title>" + title + "</title><link rel=\"stylesheet\" href=\"" + base + "/__flexdoc/renderer.css\"></head>"
        + "<body><div id=\"flexdoc-root\"></div><script>window.__FLEXDOC_SPEC__=" + spec + ";window.__FLEXDOC_OPTIONS__=" + optionsJson + ";</script>"
        + "<script src=\"" + base + "/__flexdoc/renderer.js\"></script><script>window.FlexDocStandalone.mount(document.getElementById('flexdoc-root'),{spec:window.__FLEXDOC_SPEC__,options:window.__FLEXDOC_OPTIONS__});</script></body></html>";
    return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
  }

  @GetMapping(value = "${flexdoc.path:/docs}/__flexdoc/renderer.js", produces = "application/javascript")
  public ResponseEntity<byte[]> rendererJavaScript() throws IOException {
    return immutableResource("META-INF/flexdoc/flexdoc.standalone.js", MediaType.valueOf("application/javascript"));
  }

  @GetMapping(value = "${flexdoc.path:/docs}/__flexdoc/renderer.css", produces = "text/css")
  public ResponseEntity<byte[]> rendererCss() throws IOException {
    return immutableResource("META-INF/flexdoc/flexdoc.standalone.css", MediaType.valueOf("text/css"));
  }

  private ResponseEntity<byte[]> immutableResource(String path, MediaType type) throws IOException {
    var resource = new ClassPathResource(path);
    try (var input = resource.getInputStream()) {
      return ResponseEntity.ok().cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePublic().immutable()).contentType(type).body(input.readAllBytes());
    }
  }

  private String normalizedPath() {
    String path = properties.getPath();
    if (path == null || path.isBlank()) return "/docs";
    String normalized = path.startsWith("/") ? path : "/" + path;
    return normalized.endsWith("/") && normalized.length() > 1 ? normalized.substring(0, normalized.length() - 1) : normalized;
  }

  private String safeScriptJson(Object value) throws Exception {
    return objectMapper.writeValueAsString(value)
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029");
  }

  private static String escapeHtml(String value) {
    return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
  }
}
