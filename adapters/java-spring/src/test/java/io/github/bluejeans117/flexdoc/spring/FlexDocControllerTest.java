package io.github.bluejeans117.flexdoc.spring;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FlexDocControllerTest {
  @Test
  void rendersHostPageWithoutLeakingScriptMarkup() throws Exception {
    FlexDocProperties properties = new FlexDocProperties();
    properties.setPath("/reference");
    properties.setTitle("Example <API>");
    FlexDocSpecProvider provider = () -> Map.of(
        "openapi", "3.1.0",
        "info", Map.of("title", "Example", "version", "1"),
        "paths", Map.of(),
        "x-test", "</script><script>alert(1)</script>");

    FlexDocController controller = new FlexDocController(properties, provider, new ObjectMapper());
    String html = controller.documentation().getBody();

    assertThat(html).contains("/reference/__flexdoc/renderer.js");
    assertThat(html).contains("Example &lt;API&gt;");
    assertThat(html).doesNotContain("</script><script>alert(1)</script>");
    assertThat(html).contains("\\u003c/script\\u003e");
  }
}
