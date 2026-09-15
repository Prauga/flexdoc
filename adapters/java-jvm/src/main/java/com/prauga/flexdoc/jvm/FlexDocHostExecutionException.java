package com.prauga.flexdoc.jvm;

/** Failure raised by the framework-neutral JVM host executor with an HTTP route status. */
public final class FlexDocHostExecutionException extends RuntimeException {
  private final int status;

  /**
   * Creates an execution failure.
   *
   * @param status HTTP status the adapter route should return
   * @param message browser-safe execution error message
   */
  public FlexDocHostExecutionException(int status, String message) {
    super(message);
    this.status = status;
  }

  /** @return HTTP status the adapter transport should return */
  public int status() { return status; }
}
