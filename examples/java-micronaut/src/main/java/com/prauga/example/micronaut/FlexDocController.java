package com.prauga.example.micronaut;

import com.prauga.flexdoc.jvm.FlexDocHost;
import com.prauga.flexdoc.jvm.FlexDocHttpResponse;
import io.micronaut.http.HttpHeaders;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.MutableHttpResponse;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;

@Controller("/docs")
public class FlexDocController {
  private final FlexDocHost host;

  public FlexDocController(FlexDocHost host) { this.host = host; }

  @Get(produces = "text/html")
  public HttpResponse<byte[]> documentation() throws Exception { return response(host.documentation()); }

  @Get(uri = "/__flexdoc/renderer.js", produces = "application/javascript")
  public HttpResponse<byte[]> rendererJavaScript() { return response(host.rendererJavaScript()); }

  @Get(uri = "/__flexdoc/renderer.css", produces = "text/css")
  public HttpResponse<byte[]> rendererCss() { return response(host.rendererCss()); }

  private HttpResponse<byte[]> response(FlexDocHttpResponse source) {
    MutableHttpResponse<byte[]> target = HttpResponse.<byte[]>status(HttpStatus.valueOf(source.status())).body(source.body());
    target.header(HttpHeaders.CONTENT_TYPE, source.contentType());
    target.header(HttpHeaders.CACHE_CONTROL, source.cacheControl());
    return target;
  }
}
