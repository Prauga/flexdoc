package io.github.bluejeans117.flexdoc.spring;

@FunctionalInterface
public interface FlexDocSpecProvider {
  Object getOpenApiDocument() throws Exception;
}
