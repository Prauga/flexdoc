package com.prauga.example.micronaut;

import com.prauga.flexdoc.jvm.FlexDocConfig;
import com.prauga.flexdoc.jvm.FlexDocHost;
import io.micronaut.context.annotation.Factory;
import jakarta.inject.Singleton;

@Factory
public class FlexDocFactory {
  @Singleton
  FlexDocHost flexDocHost() {
    return new FlexDocHost(FlexDocConfig.builder().path("/docs").specUrl("/openapi.json").title("Micronaut FlexDoc Example").build());
  }
}
