package com.prauga.flexdoc.jvm;

import java.util.Map;

/** Transport-neutral response produced by the JVM host-execution route. */
public record FlexDocHostExecutionResult(int status, Map<String, Object> body) {
  /** Creates an immutable route response. */
  public FlexDocHostExecutionResult {
    body = body == null ? Map.of() : Map.copyOf(body);
  }
}
