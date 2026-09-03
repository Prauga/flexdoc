# Prauga FlexDoc JVM host

`com.prauga.flexdoc:flexdoc-jvm` is the framework-neutral Java 17+ host for FlexDoc. It owns the HTML bootstrap, renderer fingerprinting, cache policy, and embedded canonical JS/CSS. It has no Spring, Jakarta REST, servlet, Guice, or application-server dependency.

```java
FlexDocHost host = new FlexDocHost(
    FlexDocConfig.builder()
        .path("/docs")
        .specUrl("/openapi.json")
        .title("My API")
        .build());
```

An HTTP framework only needs to map three responses from the host: `documentation()`, `rendererJavaScript()`, and `rendererCss()`.

For Guice or Governator-style applications, bind a configured `FlexDocHost` as a singleton and have the application's existing HTTP layer translate `FlexDocHttpResponse` into its native response type. Governator is built around Guice lifecycle/DI, so no renderer-specific Governator integration is required.
