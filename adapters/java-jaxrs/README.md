# Prauga FlexDoc Jakarta REST adapter

`com.prauga.flexdoc:flexdoc-jaxrs` is a thin Jakarta REST/JAX-RS wrapper around `flexdoc-jvm`. Provide a `FlexDocHost` through CDI and register `FlexDocJaxRsResource`; the default resource serves `/docs` and its local renderer assets.

`FlexDocJaxRsResource` uses `@Path("/docs")` because Jakarta REST resource paths are annotation values and therefore compile-time constants. `FlexDocConfig.path()` cannot dynamically change that class-level route. For a custom path, subclass the resource (or create the same thin resource in your application) with a new `@Path` while keeping the injected `FlexDocHost` configured to the same path:

```java
@Path("/reference")
public final class ReferenceFlexDocResource extends FlexDocJaxRsResource {
  @Inject
  public ReferenceFlexDocResource(FlexDocHost host) {
    super(host);
  }
}
```

Configure that host with `FlexDocConfig.builder().path("/reference")...` so its generated renderer asset URLs match the resource route. This path is suitable for Jakarta REST runtimes such as Quarkus/RESTEasy.
