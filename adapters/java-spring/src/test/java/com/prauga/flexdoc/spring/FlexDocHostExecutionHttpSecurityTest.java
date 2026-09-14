package com.prauga.flexdoc.spring;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prauga.flexdoc.jvm.FlexDocHost;
import com.prauga.flexdoc.jvm.FlexDocHostExecution;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class FlexDocHostExecutionHttpSecurityTest {
  private static final int MAX_EXECUTION_REQUEST_BYTES = 32 * 1024 * 1024;

  private MockMvc mvc;

  @BeforeEach
  void setUp() {
    FlexDocProperties properties = new FlexDocProperties();
    properties.setTryItHostExecution(true);
    properties.setTryItHostExecutionAllowedOrigins(List.of("https://api.example.test"));
    FlexDocHost host = new FlexDocHost(
        properties.toConfig(),
        null,
        new FlexDocHostExecution(properties.getTryItHostExecutionAllowedOrigins()));
    mvc = MockMvcBuilders
        .standaloneSetup(new FlexDocHostExecutionController(host, new ObjectMapper()))
        .build();
  }

  @Test
  void executeRouteRequiresProtocolMarkerAtHttpBoundary() throws Exception {
    mvc.perform(post("/docs/__flexdoc/execute")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"request\":{\"url\":\"https://api.example.test/pets\"}}"))
        .andExpect(status().isForbidden())
        .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
        .andExpect(jsonPath("$.error").value("Missing X-FlexDoc-Execute header."));
  }

  @Test
  void executeRouteRejectsOriginsOutsideServerAllowlist() throws Exception {
    mvc.perform(post("/docs/__flexdoc/execute")
            .header("X-FlexDoc-Execute", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"request\":{\"url\":\"https://blocked.example/private\"}}"))
        .andExpect(status().isForbidden())
        .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
        .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("not allowed")));
  }

  @Test
  void executeRouteRejectsOversizedBodiesAtHttpBoundary() throws Exception {
    byte[] oversized = new byte[MAX_EXECUTION_REQUEST_BYTES + 1];
    mvc.perform(post("/docs/__flexdoc/execute")
            .header("X-FlexDoc-Execute", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content(oversized))
        .andExpect(status().isBadRequest())
        .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
        .andExpect(jsonPath("$.error").value("Host execution request exceeded the 32 MiB safety limit."));
  }

  @Test
  void executeRouteRejectsMalformedJsonAtHttpBoundary() throws Exception {
    mvc.perform(post("/docs/__flexdoc/execute")
            .header("X-FlexDoc-Execute", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("not-json"))
        .andExpect(status().isBadRequest())
        .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
        .andExpect(jsonPath("$.error").value("Host execution request body is not valid JSON."));
  }

  @Test
  void executeRouteRejectsUnsupportedHttpMethodAndMediaType() throws Exception {
    mvc.perform(get("/docs/__flexdoc/execute"))
        .andExpect(status().isMethodNotAllowed());

    mvc.perform(post("/docs/__flexdoc/execute")
            .header("X-FlexDoc-Execute", "1")
            .contentType(MediaType.TEXT_PLAIN)
            .content("{}"))
        .andExpect(status().isUnsupportedMediaType());
  }
}
