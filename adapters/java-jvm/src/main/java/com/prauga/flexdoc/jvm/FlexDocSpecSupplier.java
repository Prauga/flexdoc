package com.prauga.flexdoc.jvm;

/** Supplies an optional serialized OpenAPI JSON document for each documentation request. */
@FunctionalInterface
public interface FlexDocSpecSupplier {
  /** @return serialized OpenAPI JSON, or {@code null} to use the configured spec URL */
  String getOpenApiJson() throws Exception;
}
