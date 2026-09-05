# Quarkus + FlexDoc

This example proves the Jakarta REST path using Quarkus REST. The application provides a `FlexDocHost` CDI bean and translates it through `flexdoc-jaxrs` at `/docs`.

```bash
mvn test
mvn quarkus:dev
```

The FlexDoc Java family is pinned through `<flexdoc.version>0.5.0</flexdoc.version>`. The test boots Quarkus and verifies the docs shell plus both packaged renderer assets.
