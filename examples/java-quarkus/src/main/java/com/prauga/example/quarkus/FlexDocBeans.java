package com.prauga.example.quarkus;

import com.prauga.flexdoc.jvm.FlexDocConfig;
import com.prauga.flexdoc.jvm.FlexDocHost;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;

public class FlexDocBeans {
  @Produces
  @Singleton
  FlexDocHost flexDocHost() {
    return new FlexDocHost(FlexDocConfig.builder().path("/docs").specUrl("/openapi.json").title("Quarkus FlexDoc Example").build());
  }
}
