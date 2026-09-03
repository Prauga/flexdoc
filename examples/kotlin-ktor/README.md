# Ktor + FlexDoc

Ktor 3.5.2 maps the framework-neutral JVM `FlexDocHost` `0.4.0` responses directly into Ktor responses. There is no Ktor-specific renderer package.

```bash
mvn package
mvn exec:java
```

Open `http://127.0.0.1:5088/docs`.

The example deliberately translates only status, content type, cache policy, and bytes; renderer behavior remains in `flexdoc-jvm`.
