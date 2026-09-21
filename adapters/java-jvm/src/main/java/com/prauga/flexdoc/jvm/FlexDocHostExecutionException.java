package com.prauga.flexdoc.jvm;

/** Failure raised by the framework-neutral JVM host executor with an HTTP route status. */
public final class FlexDocHostExecutionException extends RuntimeException {
  private final int status;
  private final FlexDocHostExecutionReason reason;

  /**
   * Creates an execution failure whose reason is derived from its status.
   *
   * @param status HTTP status the adapter route should return
   * @param message browser-safe execution error message
   */
  public FlexDocHostExecutionException(int status, String message) {
    this(status, message, null);
  }

  /**
   * Creates an execution failure with an explicit observation category.
   *
   * <p>The message interpolates origins, field names and methods, so it is unbounded
   * and unusable as a metric label. The reason is the low-cardinality category that
   * is, and it defaults from the status so a new throw site cannot lose it silently.</p>
   *
   * @param status HTTP status the adapter route should return
   * @param message browser-safe execution error message
   * @param reason observation category, or null to derive it from the status
   */
  public FlexDocHostExecutionException(int status, String message, FlexDocHostExecutionReason reason) {
    super(message);
    this.status = status;
    this.reason = reason == null ? FlexDocHostExecutionReason.defaultForStatus(status) : reason;
  }

  /** @return HTTP status the adapter transport should return */
  public int status() { return status; }

  /** @return stable observation category for this failure */
  public FlexDocHostExecutionReason reason() { return reason; }
}
