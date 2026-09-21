package com.prauga.flexdoc.jvm;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Stable low-cardinality category for a non-successful host execution.
 *
 * <p>This mirrors the Node, Python, Go, Rust, Ruby, PHP, Elixir and .NET contract
 * deliberately: the same vocabulary, the same wire values, and the same order. An
 * operator running a mixed fleet should read one document shape regardless of which
 * runtime served the execute route, and a collector written for one runtime should
 * not need a second parser for another.</p>
 *
 * <p>Rejection messages interpolate request values such as origins, field names and
 * methods, so they are unbounded and cannot be used as a metric label. These can.</p>
 */
public enum FlexDocHostExecutionReason {
  /** A request arrived without the {@code X-FlexDoc-Execute} marker. */
  MARKER_MISSING("marker-missing"),
  /** Host execution is not enabled on this deployment. */
  EXECUTION_DISABLED("execution-disabled"),
  /** An admission limit rejected the request before execution. */
  ADMISSION_SATURATED("admission-saturated"),
  /** The destination is outside the configured allowlist or is blocked. */
  DESTINATION_FORBIDDEN("destination-forbidden"),
  /** A redirect was refused by the redirect policy. */
  REDIRECT_FORBIDDEN("redirect-forbidden"),
  /** The envelope or a body could not be parsed. */
  BODY_MALFORMED("body-malformed"),
  /** A request or response body exceeded its safety limit. */
  BODY_TOO_LARGE("body-too-large"),
  /** A declared media type was invalid or unsupported. */
  UNSUPPORTED_MEDIA_TYPE("unsupported-media-type"),
  /** The canonical request draft was structurally valid but unusable. */
  REQUEST_INVALID("request-invalid"),
  /** A requested authentication scheme is not implemented natively. */
  AUTH_UNSUPPORTED("auth-unsupported"),
  /** The upstream did not answer within the request deadline. */
  UPSTREAM_TIMEOUT("upstream-timeout"),
  /** The upstream could not be resolved or connected to. */
  UPSTREAM_UNREACHABLE("upstream-unreachable"),
  /** The upstream exchange failed for another reason. */
  UPSTREAM_ERROR("upstream-error");

  /** Identifies the operator export document shared across runtimes. */
  public static final String OBSERVATION_SCHEMA = "flexdoc.host-execution.observation/1";

  /** Names evidence an API host cannot observe by itself. */
  public static final List<String> OBSERVATION_GAPS = List.of("browser-direct-transport-mix");

  private static final Map<String, FlexDocHostExecutionReason> BY_WIRE_VALUE =
      List.of(values()).stream()
          .collect(Collectors.toUnmodifiableMap(FlexDocHostExecutionReason::wireValue, Function.identity()));

  private final String wireValue;

  FlexDocHostExecutionReason(String wireValue) {
    this.wireValue = wireValue;
  }

  /** @return the label value every FlexDoc runtime emits for this category */
  public String wireValue() { return wireValue; }

  /** @return the wire values in contract order */
  public static List<String> wireValues() {
    return List.of(values()).stream().map(FlexDocHostExecutionReason::wireValue).toList();
  }

  /**
   * Resolves a wire value, or empty when it is not one of the stable categories.
   *
   * @param value candidate label value
   * @return the matching category, if any
   */
  public static Optional<FlexDocHostExecutionReason> fromWireValue(String value) {
    return Optional.ofNullable(value).map(BY_WIRE_VALUE::get);
  }

  /**
   * The category a status code implies when a throw site has nothing more specific to
   * say, so that adding a rejection path can never silently lose its reason.
   *
   * @param status HTTP status the route will return
   * @return the default category for that status
   */
  public static FlexDocHostExecutionReason defaultForStatus(int status) {
    if (status == 403) return DESTINATION_FORBIDDEN;
    if (status >= 500) return UPSTREAM_ERROR;
    return REQUEST_INVALID;
  }
}
