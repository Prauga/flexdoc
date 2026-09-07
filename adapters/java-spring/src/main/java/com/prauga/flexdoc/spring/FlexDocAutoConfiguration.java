package com.prauga.flexdoc.spring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prauga.flexdoc.jvm.FlexDocHost;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/** Auto-configures the FlexDoc documentation endpoint for Spring Boot applications. */
@AutoConfiguration
@EnableConfigurationProperties(FlexDocProperties.class)
@ConditionalOnProperty(prefix = "flexdoc", name = "enabled", havingValue = "true", matchIfMissing = true)
public class FlexDocAutoConfiguration {
  /**
   * Creates a classpath-backed spec provider when {@code flexdoc.spec-location} is set.
   *
   * @param properties bound FlexDoc configuration properties
   * @param resourceLoader loader used to resolve the configured spec location
   * @param objectMapper Jackson mapper used to deserialize the OpenAPI document
   * @return a provider that reads the configured OpenAPI resource
   */
  @Bean
  @ConditionalOnMissingBean
  @ConditionalOnProperty(prefix = "flexdoc", name = "spec-location")
  FlexDocSpecProvider flexDocSpecProvider(FlexDocProperties properties, ResourceLoader resourceLoader, ObjectMapper objectMapper) {
    return () -> {
      Resource resource = resourceLoader.getResource(properties.getSpecLocation());
      try (var input = resource.getInputStream()) { return objectMapper.readValue(input, Object.class); }
    };
  }

  /**
   * Creates the framework-neutral FlexDoc host used by the MVC controller.
   *
   * @param properties bound FlexDoc configuration properties
   * @param provider optional application-provided OpenAPI document source
   * @param objectMapper Jackson mapper used to serialize provider output
   * @return configured FlexDoc host
   */
  @Bean
  @ConditionalOnMissingBean
  FlexDocHost flexDocHost(FlexDocProperties properties, ObjectProvider<FlexDocSpecProvider> provider, ObjectMapper objectMapper) {
    return new FlexDocHost(properties.toConfig(), () -> {
      FlexDocSpecProvider specProvider = provider.getIfAvailable();
      if (specProvider == null) return null;
      Object document = specProvider.getOpenApiDocument();
      return document == null ? null : objectMapper.writeValueAsString(document);
    });
  }

  /**
   * Registers the MVC controller that serves documentation and renderer assets.
   *
   * @param properties bound FlexDoc configuration properties
   * @param host configured FlexDoc host
   * @return FlexDoc MVC controller
   */
  @Bean
  FlexDocController flexDocController(FlexDocProperties properties, FlexDocHost host) {
    return new FlexDocController(properties, host);
  }

  /**
   * Registers the Runtime Intelligence endpoint when {@code flexdoc.runtime-intelligence=true}.
   *
   * @param properties bound FlexDoc configuration properties
   * @param specProvider application OpenAPI document source required for drift comparison
   * @param handlerMapping live Spring MVC request-mapping registry
   * @param objectMapper Jackson mapper used to serialize the snapshot
   * @param environment Spring environment used for active profile metadata
   * @return Runtime Intelligence MVC controller
   */
  @Bean
  @ConditionalOnProperty(prefix = "flexdoc", name = "runtime-intelligence", havingValue = "true")
  FlexDocRuntimeController flexDocRuntimeController(
      FlexDocProperties properties,
      ObjectProvider<FlexDocSpecProvider> specProvider,
      ObjectProvider<RequestMappingHandlerMapping> handlerMapping,
      ObjectMapper objectMapper,
      Environment environment) {
    FlexDocSpecProvider provider = specProvider.getIfAvailable();
    if (provider == null) {
      throw new IllegalStateException(
          "FlexDoc Runtime Intelligence requires a FlexDocSpecProvider so live Spring routes can be compared with the exact OpenAPI document");
    }
    return new FlexDocRuntimeController(
        new SpringRuntimeIntelligence(properties, provider, handlerMapping, objectMapper, environment),
        objectMapper);
  }
}
