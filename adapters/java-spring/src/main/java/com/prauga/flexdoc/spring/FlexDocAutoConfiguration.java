package com.prauga.flexdoc.spring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prauga.flexdoc.jvm.FlexDocHost;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;

/** Auto-configures the FlexDoc documentation endpoint for Spring Boot applications. */
@AutoConfiguration
@EnableConfigurationProperties(FlexDocProperties.class)
@ConditionalOnProperty(prefix = "flexdoc", name = "enabled", havingValue = "true", matchIfMissing = true)
public class FlexDocAutoConfiguration {
  @Bean
  @ConditionalOnMissingBean
  @ConditionalOnProperty(prefix = "flexdoc", name = "spec-location")
  FlexDocSpecProvider flexDocSpecProvider(FlexDocProperties properties, ResourceLoader resourceLoader, ObjectMapper objectMapper) {
    return () -> {
      Resource resource = resourceLoader.getResource(properties.getSpecLocation());
      try (var input = resource.getInputStream()) { return objectMapper.readValue(input, Object.class); }
    };
  }

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

  @Bean
  FlexDocController flexDocController(FlexDocProperties properties, FlexDocHost host) {
    return new FlexDocController(properties, host);
  }
}
