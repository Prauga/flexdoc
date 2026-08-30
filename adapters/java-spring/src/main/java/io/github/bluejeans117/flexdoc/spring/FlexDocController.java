package io.github.bluejeans117.flexdoc.spring;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FlexDocController {
  private final FlexDocProperties properties;
  private final FlexDocSpecProvider provider;
  private final ObjectMapper objectMapper;

  public FlexDocController(FlexDocProperties properties, @Nullable FlexDocSpecProvider provider, ObjectMapper objectMapper) {
    this.properties = properties;
    this.provider = provider;
    this.objectMapper = objectMapper;
  }

  @GetMapping(value = "${flexdoc.path:/docs}", produces = MediaType.TEXT_HTML_VALUE)
  public ResponseEntity<String> documentation() throws Exception {
    String base = normalizedPath();
    Object document = provider == null ? null : provider.getOpenApiDocument();
    String spec = safeScriptJson(document);
    String specUrl = safeScriptJson(provider == null ? properties.getSpecUrl() : null);
    Map<String, Object> options = new LinkedHashMap<>();
    options.put("contractVersion", "1");
    options.put("title", properties.getTitle());
    options.put("theme", properties.getTheme());
    options.put("tryIt", Map.of("enabled", properties.isTryItEnabled()));
    String optionsJson = safeScriptJson(options);
    String title = escapeHtml(properties.getTitle());

    String html = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
        + "<meta name=\"color-scheme\" content=\"light dark\"><title>" + title + "</title><link rel=\"stylesheet\" href=\"" + base + "/__flexdoc/renderer.css\"></head>"
        + "<body><div id=\"flexdoc-root\"></div><script>window.__FLEXDOC_SPEC__=" + spec + ";window.__FLEXDOC_SPEC_URL__=" + specUrl + ";window.__FLEXDOC_OPTIONS__=" + optionsJson + ";</script>"
        + "<script src=\"" + base + "/__flexdoc/renderer.js\"></script><script>(async function(){const root=document.getElementById('flexdoc-root');try{let spec=window.__FLEXDOC_SPEC__;let baseUri;"
        + "if(!spec&&window.__FLEXDOC_SPEC_URL__){baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);spec=await response.json();}"
        + "if(!spec)throw new Error('No OpenAPI specification was provided');const config={spec:spec,options:window.__FLEXDOC_OPTIONS__||{},baseUri:baseUri};"
        + "if(baseUri&&window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);"
        + "}catch(error){root.innerHTML='<pre style=\"padding:24px;color:#b91c1c;white-space:pre-wrap\"></pre>';root.firstChild.textContent=error instanceof Error?error.message:String(error);}})();</script></body></html>";
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
      return ResponseEntity.ok()
          .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePublic().immutable())
          .contentType(type)
          .body(input.readAllBytes());
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
