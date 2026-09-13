package com.prauga.bench;

import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@RestController
public class HostImpactApplication {
  public static void main(String[] args) {
    String mode = System.getenv().getOrDefault("FLEXDOC_BENCH_MODE", "baseline");
    String port = System.getenv().getOrDefault("FLEXDOC_BENCH_PORT", "5810");
    String origin = System.getenv().getOrDefault("FLEXDOC_BENCH_ORIGIN", "http://127.0.0.1:" + port);

    System.setProperty("server.address", "127.0.0.1");
    System.setProperty("server.port", port);
    System.setProperty("spring.main.banner-mode", "off");
    System.setProperty("logging.level.root", "WARN");

    if ("baseline".equals(mode)) {
      System.setProperty("flexdoc.enabled", "false");
    } else {
      System.setProperty("flexdoc.enabled", "true");
      System.setProperty("flexdoc.path", "/docs");
      System.setProperty("flexdoc.spec-url", "/openapi.json");
      System.setProperty("flexdoc.title", "FlexDoc host-impact benchmark");
      System.setProperty("flexdoc.try-it-default-server", origin);
      if ("host".equals(mode)) {
        System.setProperty("flexdoc.try-it-host-execution", "true");
        System.setProperty("flexdoc.try-it-host-execution-allowed-origins[0]", origin);
      }
    }

    SpringApplication.run(HostImpactApplication.class, args);
  }

  @GetMapping("/health")
  public Map<String, Object> health() {
    return Map.of("ok", true);
  }

  @GetMapping("/target")
  public Map<String, Object> target() {
    return Map.of("ok", true, "runtime", "java-spring");
  }

  @GetMapping("/openapi.json")
  public Map<String, Object> openApi() {
    return Map.of(
        "openapi", "3.0.3",
        "info", Map.of("title", "FlexDoc host-impact benchmark", "version", "1.0.0"),
        "paths", Map.of(
            "/target", Map.of(
                "get", Map.of(
                    "responses", Map.of("200", Map.of("description", "ok"))))));
  }
}
