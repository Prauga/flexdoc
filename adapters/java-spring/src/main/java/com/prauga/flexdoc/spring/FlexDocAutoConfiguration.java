package com.prauga.flexdoc.spring;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;

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
      try (var input = resource.getInputStream()) {
        return objectMapper.readValue(input, Object.class);
      }
    };
  }

  @Bean
  FlexDocController flexDocController(
      FlexDocProperties properties,
      ObjectProvider<FlexDocSpecProvider> provider,
      ObjectMapper objectMapper) {
    return new FlexDocController(properties, provider.getIfAvailable(), objectMapper);
  }
}
