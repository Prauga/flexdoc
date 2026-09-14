package com.prauga.flexdoc.spring;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prauga.flexdoc.jvm.FlexDocHost;
import com.prauga.flexdoc.jvm.FlexDocHostExecutionFile;
import com.prauga.flexdoc.jvm.FlexDocHostExecutionPolicy;
import com.prauga.flexdoc.jvm.FlexDocHostExecutionResult;
import jakarta.servlet.http.HttpServletRequest;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

/** Spring MVC transport for the framework-neutral JVM host executor. */
@RestController
public final class FlexDocHostExecutionController {
  private static final int MAX_EXECUTION_REQUEST_BYTES = 32 * 1024 * 1024;
  private static final Pattern FILE_PART = Pattern.compile("^formData\\[(\\d+)]$");
  private static final TypeReference<Map<String, Object>> ENVELOPE_TYPE = new TypeReference<>() {};

  private final FlexDocHost host;
  private final ObjectMapper objectMapper;

  /** @param host configured FlexDoc host owning a real native executor */
  public FlexDocHostExecutionController(FlexDocHost host, ObjectMapper objectMapper) {
    this.host = host;
    this.objectMapper = objectMapper;
    if (!host.hasHostExecution()) {
      throw new IllegalStateException("FlexDoc Spring host-execution controller requires a configured JVM executor.");
    }
  }

  /** Executes one canonical JSON API Client envelope through the Spring application host. */
  @PostMapping(
      value = "${flexdoc.path:/docs}/__flexdoc/execute",
      consumes = MediaType.APPLICATION_JSON_VALUE,
      produces = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<Map<String, Object>> execute(
      @RequestHeader(value = "X-FlexDoc-Execute", required = false) String executeMarker,
      HttpServletRequest request) {
    if (!"1".equals(executeMarker)) return response(host.executeHostRequest(executeMarker, Map.of()));
    try {
      Map<String, Object> envelope = parseEnvelope(readBounded(request));
      String policyError = FlexDocHostExecutionPolicy.validate(envelope);
      if (policyError != null) return badRequest(policyError);
      return response(host.executeHostRequest(executeMarker, envelope));
    } catch (BadEnvelope error) {
      return badRequest(error.getMessage());
    }
  }

  /** Executes the canonical multipart descriptor plus indexed browser file parts. */
  @PostMapping(
      value = "${flexdoc.path:/docs}/__flexdoc/execute",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<Map<String, Object>> executeMultipart(
      @RequestHeader(value = "X-FlexDoc-Execute", required = false) String executeMarker,
      @RequestPart(value = "descriptor", required = false) String descriptor,
      MultipartHttpServletRequest request) {
    if (!"1".equals(executeMarker)) return response(host.executeHostRequest(executeMarker, Map.of()));
    if (descriptor == null) return badRequest("Host execution multipart request requires a descriptor.");
    try {
      long declared = request.getContentLengthLong();
      if (declared > MAX_EXECUTION_REQUEST_BYTES) {
        throw new BadEnvelope("Host execution request exceeded the 32 MiB safety limit.");
      }
      byte[] descriptorBytes = descriptor.getBytes(StandardCharsets.UTF_8);
      long size = descriptorBytes.length;
      if (size > MAX_EXECUTION_REQUEST_BYTES) {
        throw new BadEnvelope("Host execution request exceeded the 32 MiB safety limit.");
      }
      Map<Integer, FlexDocHostExecutionFile> files = new LinkedHashMap<>();
      for (Map.Entry<String, MultipartFile> entry : request.getFileMap().entrySet()) {
        Matcher matcher = FILE_PART.matcher(entry.getKey());
        if (!matcher.matches()) continue;
        MultipartFile file = entry.getValue();
        size += file.getSize();
        if (size > MAX_EXECUTION_REQUEST_BYTES) throw new BadEnvelope("Host execution request exceeded the 32 MiB safety limit.");
        int index = parsePartIndex(matcher.group(1));
        files.put(index, new FlexDocHostExecutionFile(
            file.getOriginalFilename(), file.getContentType(), file.getBytes()));
      }
      Map<String, Object> envelope = parseEnvelope(descriptorBytes);
      String policyError = FlexDocHostExecutionPolicy.validate(envelope);
      if (policyError != null) return badRequest(policyError);
      return response(host.executeHostRequest(executeMarker, envelope, files));
    } catch (BadEnvelope error) {
      return badRequest(error.getMessage());
    } catch (IOException error) {
      return badRequest("Unable to read multipart host execution upload.");
    }
  }

  private byte[] readBounded(HttpServletRequest request) {
    long declared = request.getContentLengthLong();
    if (declared > MAX_EXECUTION_REQUEST_BYTES) throw new BadEnvelope("Host execution request exceeded the 32 MiB safety limit.");
    try (var input = request.getInputStream(); var out = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192];
      int total = 0;
      for (int read; (read = input.read(buffer)) >= 0;) {
        total += read;
        if (total > MAX_EXECUTION_REQUEST_BYTES) throw new BadEnvelope("Host execution request exceeded the 32 MiB safety limit.");
        out.write(buffer, 0, read);
      }
      return out.toByteArray();
    } catch (BadEnvelope error) {
      throw error;
    } catch (IOException error) {
      throw new BadEnvelope("Unable to read host execution request body.");
    }
  }

  private Map<String, Object> parseEnvelope(byte[] bytes) {
    if (bytes.length == 0) throw new BadEnvelope("Host execution request body is empty.");
    if (bytes.length > MAX_EXECUTION_REQUEST_BYTES) throw new BadEnvelope("Host execution request exceeded the 32 MiB safety limit.");
    try {
      Map<String, Object> envelope = objectMapper.readValue(bytes, ENVELOPE_TYPE);
      if (envelope == null || !(envelope.get("request") instanceof Map<?, ?>)) {
        throw new BadEnvelope("Host execution body requires a canonical request draft.");
      }
      return envelope;
    } catch (BadEnvelope error) {
      throw error;
    } catch (IOException error) {
      throw new BadEnvelope("Host execution request body is not valid JSON.");
    }
  }

  private static int parsePartIndex(String raw) {
    try {
      return Integer.parseInt(raw);
    } catch (NumberFormatException error) {
      throw new BadEnvelope("Host execution multipart file index is invalid.");
    }
  }

  private ResponseEntity<Map<String, Object>> badRequest(String message) {
    return response(new FlexDocHostExecutionResult(400, Map.of("error", message)));
  }

  private ResponseEntity<Map<String, Object>> response(FlexDocHostExecutionResult result) {
    return ResponseEntity.status(result.status())
        .cacheControl(CacheControl.noStore())
        .contentType(MediaType.APPLICATION_JSON)
        .body(result.body());
  }

  private static final class BadEnvelope extends RuntimeException {
    BadEnvelope(String message) { super(message); }
  }
}
