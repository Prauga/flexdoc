package com.prauga.flexdoc.spring;

@FunctionalInterface
public interface FlexDocSpecProvider {
  Object getOpenApiDocument() throws Exception;
}
