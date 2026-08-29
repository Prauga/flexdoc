package io.github.bluejeans117.flexdoc.spring;

import com.fasterxml.jackson.databind.ObjectMapper;
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
  FlexDocSpecProvider flexDocSpecProvider(FlexDocProperties properties, ResourceLoader resourceLoader, ObjectMapper objectMapper) {
    return () -> {
      if (properties.getSpecLocation() == null || properties.getSpecLocation().isBlank()) {
        throw new IllegalStateException("Set flexdoc.spec-location or provide a FlexDocSpecProvider bean");
      }
      Resource resource = resourceLoader.getResource(properties.getSpecLocation());
      try (var input = resource.getInputStream()) {
        return objectMapper.readValue(input, Object.class);
      }
    };
  }

  @Bean
  FlexDocController flexDocController(FlexDocProperties properties, FlexDocSpecProvider provider, ObjectMapper objectMapper) {
    return new FlexDocController(properties, provider, objectMapper);
  }
}
