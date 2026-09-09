package com.prauga.flexdoc.jaxrs;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prauga.flexdoc.jvm.FlexDocHost;
import com.prauga.flexdoc.jvm.FlexDocHostExecutionFile;
import com.prauga.flexdoc.jvm.FlexDocHostExecutionResult;
import com.prauga.flexdoc.jvm.FlexDocHttpResponse;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.EntityPart;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Default Jakarta REST resource exposing a configured {@link FlexDocHost} at {@code /docs}. */
@Path("/docs")
public class FlexDocJaxRsResource {
  private static final int MAX_EXECUTION_REQUEST_BYTES = 32 * 1024 * 1024;
  private static final Pattern FILE_PART = Pattern.compile("^formData\\[(\\d+)]$");
  private static final TypeReference<Map<String, Object>> ENVELOPE_TYPE = new TypeReference<>() {};

  private final FlexDocHost host;
  private final ObjectMapper objectMapper;

  /**
   * Creates a resource from a DI-provided framework-neutral host.
   *
   * @param host configured FlexDoc host
   */
  @Inject
  public FlexDocJaxRsResource(FlexDocHost host) { this(host, new ObjectMapper()); }

  FlexDocJaxRsResource(FlexDocHost host, ObjectMapper objectMapper) {
    this.host = host;
    this.objectMapper = objectMapper;
  }

  /** @return FlexDoc documentation HTML */
  @GET
  @Produces("text/html; charset=utf-8")
  public Response documentation() throws Exception { return toResponse(host.documentation()); }

  /** @return canonical renderer JavaScript */
  @GET
  @Path("__flexdoc/renderer.js")
  @Produces("application/javascript; charset=utf-8")
  public Response rendererJavaScript() { return toResponse(host.rendererJavaScript()); }

  /** @return canonical renderer stylesheet */
  @GET
  @Path("__flexdoc/renderer.css")
  @Produces("text/css; charset=utf-8")
  public Response rendererCss() { return toResponse(host.rendererCss()); }

  /** Executes one canonical JSON API Client envelope through the configured JVM host. */
  @POST
  @Path("__flexdoc/execute")
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  public Response execute(
      @HeaderParam("X-FlexDoc-Execute") String executeMarker,
      @HeaderParam("Content-Length") String contentLength,
      InputStream body) {
    if (!"1".equals(executeMarker)) return executionResponse(host.executeHostRequest(executeMarker, Map.of()));
    try {
      byte[] bytes = readBounded(body, contentLength, MAX_EXECUTION_REQUEST_BYTES);
      return executionResponse(host.executeHostRequest(executeMarker, parseEnvelope(bytes)));
    } catch (BadEnvelope error) {
      return badRequest(error.getMessage());
    }
  }

  /** Executes the canonical multipart descriptor plus indexed browser file parts. */
  @POST
  @Path("__flexdoc/execute")
  @Consumes(MediaType.MULTIPART_FORM_DATA)
  @Produces(MediaType.APPLICATION_JSON)
  public Response executeMultipart(
      @HeaderParam("X-FlexDoc-Execute") String executeMarker,
      @HeaderParam("Content-Length") String contentLength,
      List<EntityPart> parts) {
    if (!"1".equals(executeMarker)) return executionResponse(host.executeHostRequest(executeMarker, Map.of()));
    validateDeclaredLength(contentLength, MAX_EXECUTION_REQUEST_BYTES);
    if (parts == null) return badRequest("Host execution multipart request requires a descriptor.");

    byte[] descriptor = null;
    Map<Integer, FlexDocHostExecutionFile> files = new LinkedHashMap<>();
    int total = 0;
    try {
      for (EntityPart part : parts) {
        if (part == null) continue;
        byte[] bytes = readBounded(part.getContent(), null, MAX_EXECUTION_REQUEST_BYTES - total);
        total += bytes.length;
        String name = part.getName();
        if ("descriptor".equals(name)) {
          if (descriptor != null) return badRequest("Host execution multipart request contains multiple descriptors.");
          descriptor = bytes;
          continue;
        }
        Matcher matcher = FILE_PART.matcher(name == null ? "" : name);
        if (!matcher.matches()) continue;
        int index = Integer.parseInt(matcher.group(1));
        if (files.containsKey(index)) {
          return badRequest("Host execution multipart request contains duplicate formData[" + index + "] parts.");
        }
        String mediaType = part.getMediaType() == null ? null : part.getMediaType().toString();
        files.put(index, new FlexDocHostExecutionFile(part.getFileName().orElse(null), mediaType, bytes));
      }
      if (descriptor == null) return badRequest("Host execution multipart request requires a descriptor.");
      return executionResponse(host.executeHostRequest(executeMarker, parseEnvelope(descriptor), files));
    } catch (BadEnvelope error) {
      return badRequest(error.getMessage());
    }
  }

  /**
   * Converts the neutral response to Jakarta REST.
   *
   * @param response the framework-neutral FlexDoc response
   * @return a Jakarta REST response with status, type, cache policy, and body
   */
  protected Response toResponse(FlexDocHttpResponse response) {
    return Response.status(response.status())
        .type(response.contentType())
        .header("Cache-Control", response.cacheControl())
        .entity(response.body())
        .build();
  }

  private Map<String, Object> parseEnvelope(byte[] bytes) {
    if (bytes.length == 0) throw new BadEnvelope("Host execution request body is empty.");
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

  private byte[] readBounded(InputStream input, String contentLength, int limit) {
    if (limit < 0) throw new BadEnvelope("Host execution request exceeded the 32 MiB safety limit.");
    validateDeclaredLength(contentLength, limit);
    if (input == null) return new byte[0];
    try (input; var out = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192];
      int total = 0;
      for (int read; (read = input.read(buffer)) >= 0;) {
        total += read;
        if (total > limit) throw new BadEnvelope("Host execution request exceeded the 32 MiB safety limit.");
        out.write(buffer, 0, read);
      }
      return out.toByteArray();
    } catch (BadEnvelope error) {
      throw error;
    } catch (IOException error) {
      throw new BadEnvelope("Unable to read host execution request body.");
    }
  }

  private static void validateDeclaredLength(String raw, int limit) {
    if (raw == null || raw.isBlank()) return;
    try {
      long declared = Long.parseLong(raw);
      if (declared < 0) throw new NumberFormatException();
      if (declared > limit) throw new BadEnvelope("Host execution request exceeded the 32 MiB safety limit.");
    } catch (NumberFormatException error) {
      throw new BadEnvelope("Host execution request Content-Length is invalid.");
    }
  }

  private Response badRequest(String message) {
    return executionResponse(new FlexDocHostExecutionResult(400, Map.of("error", message)));
  }

  private Response executionResponse(FlexDocHostExecutionResult result) {
    try {
      return Response.status(result.status())
          .type(MediaType.APPLICATION_JSON_TYPE)
          .header("Cache-Control", "no-store")
          .entity(objectMapper.writeValueAsString(result.body()))
          .build();
    } catch (IOException error) {
      return Response.status(500)
          .type(MediaType.APPLICATION_JSON_TYPE)
          .header("Cache-Control", "no-store")
          .entity("{\"error\":\"Unable to serialize host execution response.\"}")
          .build();
    }
  }

  private static final class BadEnvelope extends RuntimeException {
    BadEnvelope(String message) { super(message); }
  }
}
