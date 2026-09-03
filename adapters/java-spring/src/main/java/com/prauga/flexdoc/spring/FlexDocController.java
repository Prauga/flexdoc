package com.prauga.flexdoc.spring;

import com.prauga.flexdoc.jvm.FlexDocHost;
import com.prauga.flexdoc.jvm.FlexDocHttpResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Spring MVC transport wrapper around the framework-neutral FlexDoc JVM host. */
@RestController
public class FlexDocController {
  private final FlexDocProperties properties;
  private final FlexDocHost host;

  public FlexDocController(FlexDocProperties properties, FlexDocHost host) {
    this.properties = properties;
    this.host = host;
  }

  @GetMapping(value = "${flexdoc.path:/docs}", produces = MediaType.TEXT_HTML_VALUE)
  public ResponseEntity<byte[]> documentation() throws Exception { return response(host.documentation()); }

  @GetMapping(value = "${flexdoc.path:/docs}/__flexdoc/renderer.js", produces = "application/javascript")
  public ResponseEntity<byte[]> rendererJavaScript() { return response(host.rendererJavaScript()); }

  @GetMapping(value = "${flexdoc.path:/docs}/__flexdoc/renderer.css", produces = "text/css")
  public ResponseEntity<byte[]> rendererCss() { return response(host.rendererCss()); }

  private ResponseEntity<byte[]> response(FlexDocHttpResponse response) {
    return ResponseEntity.status(response.status())
        .header(HttpHeaders.CACHE_CONTROL, response.cacheControl())
        .contentType(MediaType.parseMediaType(response.contentType()))
        .body(response.body());
  }
}
