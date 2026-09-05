# Micronaut + FlexDoc

This example maps Micronaut HTTP routes directly to the framework-neutral `FlexDocHost`. No Micronaut-specific FlexDoc renderer package is required.

```bash
mvn test
mvn mn:run
```

The example uses Micronaut 4.x on Java 17 and pins the FlexDoc Java family through `<flexdoc.version>0.5.0</flexdoc.version>`. CI boots the application for the Micronaut test and verifies the docs shell plus renderer assets.
