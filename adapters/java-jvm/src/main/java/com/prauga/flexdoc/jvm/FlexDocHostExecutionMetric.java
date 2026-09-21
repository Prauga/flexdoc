package com.prauga.flexdoc.jvm;

import java.util.Map;

/**
 * One dependency-free metric update that can be bridged to Micrometer, Prometheus or
 * OpenTelemetry without FlexDoc owning a registry.
 *
 * @param name metric name, shared with every other FlexDoc runtime
 * @param kind {@code counter}, {@code gauge} or {@code histogram}
 * @param value counter increment, gauge delta, or observation in seconds
 * @param labels low-cardinality labels; never request content
 */
public record FlexDocHostExecutionMetric(String name, String kind, double value, Map<String, String> labels) {

  /** Normalizes the label map so a caller cannot observe or mutate shared state. */
  public FlexDocHostExecutionMetric {
    labels = labels == null ? Map.of() : Map.copyOf(labels);
  }
}
