package com.prauga.flexdoc.jaxrs;

import com.prauga.flexdoc.jvm.FlexDocHost;
import com.prauga.flexdoc.jvm.FlexDocHttpResponse;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Response;

/** Default Jakarta REST resource exposing a configured {@link FlexDocHost} at {@code /docs}. */
@Path("/docs")
public class FlexDocJaxRsResource {
  private final FlexDocHost host;

  /** Creates a resource from a DI-provided framework-neutral host. */
  @Inject
  public FlexDocJaxRsResource(FlexDocHost host) { this.host = host; }

  /** @return FlexDoc documentation HTML */
  @GET
  @Produces("text/html; charset=utf-8")
  public Response documentation() throws Exception { return toResponse(host.documentation()); }

  /** @return canonical renderer JavaScript */
  @GET
  @Path("__flexdoc/renderer.js")
  @Produces("application/javascript; charset=utf-8")
  public Response rendererJavaScript() { return toResponse(host.rendererJavaScript()); }

  /** @return canonical renderer stylesheet */
  @GET
  @Path("__flexdoc/renderer.css")
  @Produces("text/css; charset=utf-8")
  public Response rendererCss() { return toResponse(host.rendererCss()); }

  /** Converts the neutral response to Jakarta REST. */
  protected Response toResponse(FlexDocHttpResponse response) {
    return Response.status(response.status())
        .type(response.contentType())
        .header("Cache-Control", response.cacheControl())
        .entity(response.body())
        .build();
  }
}
