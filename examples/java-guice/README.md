# Guice / Governator-style FlexDoc host

This example binds `FlexDocHost` as a Guice singleton and maps its neutral responses through the JDK HTTP server. That is the integration model for Guice applications and for Governator applications, whose lifecycle/object graph is built on Guice.

```bash
mvn package
java -jar target/flexdoc-guice-example-0.1.0-all.jar
```

Open `http://127.0.0.1:5091/docs`.

The FlexDoc JVM host is pinned through `<flexdoc.version>0.4.0</flexdoc.version>`. No Spring Boot or Jakarta REST dependency is required.
