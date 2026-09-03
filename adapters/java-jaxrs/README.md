# Prauga FlexDoc Jakarta REST adapter

`com.prauga.flexdoc:flexdoc-jaxrs` is a thin Jakarta REST/JAX-RS wrapper around `flexdoc-jvm`. Provide a `FlexDocHost` through CDI and register `FlexDocJaxRsResource`; the default resource serves `/docs` and its local renderer assets.

This path is suitable for Jakarta REST runtimes such as Quarkus/RESTEasy. For a custom documentation path, create a small application resource with the desired `@Path` and delegate to a `FlexDocHost` or subclass the resource in frameworks that honor inherited resource methods.
