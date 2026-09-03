package com.prauga.example.quarkus;

import com.prauga.flexdoc.jaxrs.FlexDocJaxRsResource;
import com.prauga.flexdoc.jvm.FlexDocHost;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Response;

@Path("/docs")
public class DocsResource {
  private final FlexDocJaxRsResource delegate;

  @Inject
  public DocsResource(FlexDocHost host) { this.delegate = new FlexDocJaxRsResource(host); }

  @GET
  @Produces("text/html; charset=utf-8")
  public Response documentation() throws Exception { return delegate.documentation(); }

  @GET
  @Path("__flexdoc/renderer.js")
  @Produces("application/javascript; charset=utf-8")
  public Response rendererJavaScript() { return delegate.rendererJavaScript(); }

  @GET
  @Path("__flexdoc/renderer.css")
  @Produces("text/css; charset=utf-8")
  public Response rendererCss() { return delegate.rendererCss(); }
}
