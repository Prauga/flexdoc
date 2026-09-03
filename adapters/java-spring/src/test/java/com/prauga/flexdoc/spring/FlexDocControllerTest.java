package com.prauga.flexdoc.spring;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prauga.flexdoc.jvm.FlexDocHost;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FlexDocControllerTest {
  @Test
  void defaultsToSameOriginSpringdocEndpoint() throws Exception {
    FlexDocProperties properties = new FlexDocProperties();
    FlexDocHost host = new FlexDocHost(properties.toConfig());
    FlexDocController controller = new FlexDocController(properties, host);

    String html = new String(controller.documentation().getBody(), StandardCharsets.UTF_8);
    assertThat(html).contains("/docs/__flexdoc/renderer.js?v=");
    assertThat(html).contains("window.__FLEXDOC_SPEC__=null");
    assertThat(html).contains("window.__FLEXDOC_SPEC_URL__=\"/v3/api-docs\"");
    assertThat(html).contains("FlexDocStandalone.mountAsync");
  }

  @Test
  void rendersEmbeddedProviderSpecWithoutLeakingScriptMarkup() throws Exception {
    FlexDocProperties properties = new FlexDocProperties();
    properties.setPath("/reference");
    properties.setTitle("Example <API>");
    FlexDocSpecProvider provider = () -> Map.of("openapi", "3.1.0", "info", Map.of("title", "Example", "version", "1"), "paths", Map.of(), "x-test", "</script><script>alert(1)</script>");
    ObjectMapper mapper = new ObjectMapper();
    FlexDocHost host = new FlexDocHost(properties.toConfig(), () -> mapper.writeValueAsString(provider.getOpenApiDocument()));
    FlexDocController controller = new FlexDocController(properties, host);

    String html = new String(controller.documentation().getBody(), StandardCharsets.UTF_8);
    assertThat(html).contains("/reference/__flexdoc/renderer.js?v=");
    assertThat(html).contains("Example &lt;API&gt;");
    assertThat(html).contains("window.__FLEXDOC_SPEC_URL__=null");
    assertThat(html).doesNotContain("</script><script>alert(1)</script>");
    assertThat(html).contains("\\u003c/script\\u003e");
  }
}
