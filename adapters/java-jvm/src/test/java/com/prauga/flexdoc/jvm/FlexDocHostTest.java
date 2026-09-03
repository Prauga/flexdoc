package com.prauga.flexdoc.jvm;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class FlexDocHostTest {
  @Test
  void hostsSameOriginSpecAndImmutableAssets() throws Exception {
    FlexDocHost host = new FlexDocHost(FlexDocConfig.builder().specUrl("/openapi.json").title("Example API").build());
    String html = host.documentation().bodyUtf8();

    assertTrue(html.contains("/docs/__flexdoc/renderer.js?v="));
    assertTrue(html.contains("window.__FLEXDOC_SPEC__=null"));
    assertTrue(html.contains("window.__FLEXDOC_SPEC_URL__=\"/openapi.json\""));
    assertTrue(host.rendererJavaScript().cacheControl().contains("immutable"));
    assertTrue(host.rendererCss().cacheControl().contains("immutable"));
    assertTrue(host.rendererJavaScript().body().length > 1000);
    assertTrue(host.rendererCss().body().length > 1000);
    assertArrayEquals(host.rendererJavaScript().body(), host.rendererJavaScript().body());
  }

  @Test
  void safelyEmbedsInlineSpecAndCustomPath() throws Exception {
    String json = "{\"openapi\":\"3.1.0\",\"x-test\":\"</script><script>alert(1)</script>\"}";
    FlexDocHost host = new FlexDocHost(
        FlexDocConfig.builder().path("reference/").title("Example <API>").build(),
        () -> json);
    String html = host.documentation().bodyUtf8();

    assertTrue(html.contains("/reference/__flexdoc/renderer.js?v="));
    assertTrue(html.contains("Example &lt;API&gt;"));
    assertTrue(html.contains("window.__FLEXDOC_SPEC_URL__=null"));
    assertFalse(html.contains("</script><script>alert(1)</script>"));
    assertTrue(html.contains("\\u003c/script\\u003e"));
  }
}
