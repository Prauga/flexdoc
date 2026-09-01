package com.prauga.flexdoc.spring;

/** Supplies an application-generated OpenAPI document directly to the FlexDoc endpoint. */
@FunctionalInterface
public interface FlexDocSpecProvider {
  /**
   * Produces the OpenAPI document to render.
   *
   * @return an object that Jackson can serialize as an OpenAPI document
   * @throws Exception when the application cannot produce the document
   */
  Object getOpenApiDocument() throws Exception;
}
