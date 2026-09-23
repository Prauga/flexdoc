package com.prauga.flexdoc.spring;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class SpringContractValidationConformanceTest {
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void matchesTheSharedFixture() throws Exception {
    JsonNode document = objectMapper.readTree(fixturePath().toFile());
    for (JsonNode item : document.get("cases")) {
      JsonNode input = item.get("input");
      var actual = SpringContractValidation.validate(
          routes(input.get("documentedRoutes")),
          routes(input.get("runtimeRoutes")),
          input.get("discoveryComplete").asBoolean(),
          routes(input.get("acknowledgedUndocumented")));
      JsonNode actualJson = objectMapper.valueToTree(actual);
      assertThat(actualJson).as(item.get("name").asText()).isEqualTo(item.get("expected"));
    }
  }

  private static List<SpringRuntimeIntelligence.RuntimeRoute> routes(JsonNode value) {
    List<SpringRuntimeIntelligence.RuntimeRoute> routes = new ArrayList<>();
    if (value == null || !value.isArray()) return routes;
    for (JsonNode route : value) {
      routes.add(new SpringRuntimeIntelligence.RuntimeRoute(route.get("method").asText(), route.get("path").asText()));
    }
    return routes;
  }

  private static Path fixturePath() {
    Path dir = Path.of("").toAbsolutePath();
    while (dir != null) {
      Path candidate = dir.resolve("contracts").resolve("contract-validation-fixtures.json");
      if (candidate.toFile().isFile()) return candidate;
      dir = dir.getParent();
    }
    throw new IllegalStateException("contract validation fixtures were not found");
  }
}
