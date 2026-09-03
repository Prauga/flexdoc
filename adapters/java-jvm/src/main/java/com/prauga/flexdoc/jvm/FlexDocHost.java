package com.prauga.flexdoc.jvm;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;

/** Framework-neutral FlexDoc host that serves the documentation shell and canonical renderer assets. */
public final class FlexDocHost {
  private static final String JS_RESOURCE = "/META-INF/flexdoc/flexdoc.standalone.js";
  private static final String CSS_RESOURCE = "/META-INF/flexdoc/flexdoc.standalone.css";
  private static final String IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

  private final FlexDocConfig config;
  private final FlexDocSpecSupplier specSupplier;
  private final byte[] javaScript;
  private final byte[] css;
  private final String fingerprint;

  /** Creates a host that loads the OpenAPI document from {@link FlexDocConfig#specUrl()}. */
  public FlexDocHost(FlexDocConfig config) { this(config, null); }

  /** Creates a host with an optional in-process serialized OpenAPI document supplier. */
  public FlexDocHost(FlexDocConfig config, FlexDocSpecSupplier specSupplier) {
    this.config = Objects.requireNonNull(config, "config");
    this.specSupplier = specSupplier;
    this.javaScript = readResource(JS_RESOURCE);
    this.css = readResource(CSS_RESOURCE);
    this.fingerprint = fingerprint(javaScript, css);
  }

  /** @return normalized host configuration */
  public FlexDocConfig config() { return config; }

  /** Builds the no-cache HTML shell used by any JVM HTTP framework. */
  public FlexDocHttpResponse documentation() throws Exception {
    String supplied = specSupplier == null ? null : specSupplier.getOpenApiJson();
    boolean hasInlineSpec = supplied != null && !supplied.isBlank();
    String spec = hasInlineSpec ? safeInlineJson(supplied) : "null";
    String specUrl = jsonString(hasInlineSpec ? null : config.specUrl());
    String options = "{\"contractVersion\":\"1\",\"title\":" + jsonString(config.title())
        + ",\"theme\":" + jsonString(config.theme())
        + ",\"tryIt\":{\"enabled\":" + config.tryItEnabled() + "}}";
    String base = escapeHtmlAttribute(config.path());
    String html = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
        + "<meta name=\"color-scheme\" content=\"light dark\"><title>" + escapeHtml(config.title()) + "</title><link rel=\"stylesheet\" href=\"" + base + "/__flexdoc/renderer.css?v=" + fingerprint + "\"></head>"
        + "<body><div id=\"flexdoc-root\"></div><script>window.__FLEXDOC_SPEC__=" + spec + ";window.__FLEXDOC_SPEC_URL__=" + specUrl + ";window.__FLEXDOC_OPTIONS__=" + options + ";</script>"
        + "<script src=\"" + base + "/__flexdoc/renderer.js?v=" + fingerprint + "\"></script><script>(async function(){const root=document.getElementById('flexdoc-root');try{let spec=window.__FLEXDOC_SPEC__;let baseUri;"
        + "if(!spec&&window.__FLEXDOC_SPEC_URL__){baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);spec=await response.json();}"
        + "if(!spec)throw new Error('No OpenAPI specification was provided');const config={spec:spec,options:window.__FLEXDOC_OPTIONS__||{},baseUri:baseUri};"
        + "if(baseUri&&window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);"
        + "}catch(error){root.innerHTML='<pre style=\"padding:24px;color:#b91c1c;white-space:pre-wrap\"></pre>';root.firstChild.textContent=error instanceof Error?error.message:String(error);}})();</script></body></html>";
    return new FlexDocHttpResponse(200, "text/html; charset=utf-8", "no-cache", html.getBytes(StandardCharsets.UTF_8));
  }

  /** @return immutable canonical renderer JavaScript response */
  public FlexDocHttpResponse rendererJavaScript() {
    return new FlexDocHttpResponse(200, "application/javascript; charset=utf-8", IMMUTABLE_CACHE, javaScript);
  }

  /** @return immutable canonical renderer stylesheet response */
  public FlexDocHttpResponse rendererCss() {
    return new FlexDocHttpResponse(200, "text/css; charset=utf-8", IMMUTABLE_CACHE, css);
  }

  private static byte[] readResource(String path) {
    try (InputStream input = FlexDocHost.class.getResourceAsStream(path)) {
      if (input == null) throw new IllegalStateException("Packaged FlexDoc renderer asset is missing: " + path);
      return input.readAllBytes();
    } catch (IOException error) {
      throw new IllegalStateException("Unable to read packaged FlexDoc renderer asset: " + path, error);
    }
  }

  private static String fingerprint(byte[] js, byte[] css) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      digest.update(js);
      digest.update((byte) 0);
      digest.update(css);
      return HexFormat.of().formatHex(digest.digest(), 0, 8);
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 is unavailable", error);
    }
  }

  private static String safeInlineJson(String json) {
    return json.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
        .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029");
  }

  private static String jsonString(String value) {
    if (value == null) return "null";
    StringBuilder out = new StringBuilder(value.length() + 16).append('"');
    for (int index = 0; index < value.length(); index++) {
      char ch = value.charAt(index);
      switch (ch) {
        case '"' -> out.append("\\\"");
        case '\\' -> out.append("\\\\");
        case '\b' -> out.append("\\b");
        case '\f' -> out.append("\\f");
        case '\n' -> out.append("\\n");
        case '\r' -> out.append("\\r");
        case '\t' -> out.append("\\t");
        case '<' -> out.append("\\u003c");
        case '>' -> out.append("\\u003e");
        case '&' -> out.append("\\u0026");
        case '\u2028' -> out.append("\\u2028");
        case '\u2029' -> out.append("\\u2029");
        default -> {
          if (ch < 0x20) out.append(String.format("\\u%04x", (int) ch));
          else out.append(ch);
        }
      }
    }
    return out.append('"').toString();
  }

  private static String escapeHtml(String value) {
    return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
  }

  private static String escapeHtmlAttribute(String value) { return escapeHtml(value); }
}
