package com.prauga.flexdoc.spring;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Spring MVC endpoint exposing opt-in live Runtime Intelligence snapshots. */
@RestController
public final class FlexDocRuntimeController {
  private final SpringRuntimeIntelligence runtimeIntelligence;
  private final ObjectMapper objectMapper;

  FlexDocRuntimeController(SpringRuntimeIntelligence runtimeIntelligence, ObjectMapper objectMapper) {
    this.runtimeIntelligence = runtimeIntelligence;
    this.objectMapper = objectMapper;
  }

  @GetMapping(value = "${flexdoc.path:/docs}/__flexdoc/runtime", produces = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<byte[]> runtime(HttpServletRequest request) {
    try {
      byte[] body = objectMapper.writeValueAsBytes(runtimeIntelligence.snapshot(request));
      return ResponseEntity.ok()
          .header(HttpHeaders.CACHE_CONTROL, "no-store")
          .contentType(MediaType.APPLICATION_JSON)
          .body(body);
    } catch (Exception error) {
      return ResponseEntity.internalServerError()
          .header(HttpHeaders.CACHE_CONTROL, "no-store")
          .contentType(MediaType.APPLICATION_JSON)
          .body("{\"error\":\"Runtime intelligence unavailable.\"}".getBytes(StandardCharsets.UTF_8));
    }
  }
}
