package com.prauga.flexdoc.spring;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.security.SecurityProperties;

class FlexDocAutoConfigurationAdmissionTest {
  @Test
  void registersAdmissionForConfiguredExecutePathAfterDefaultSecurityFilter() {
    FlexDocProperties properties = new FlexDocProperties();
    properties.setPath("/internal/docs/");
    properties.setTryItHostExecutionMaxInFlight(7);
    properties.setTryItHostExecutionRetryAfterSeconds(3);

    var registration = new FlexDocAutoConfiguration().flexDocHostExecutionAdmissionFilter(properties);

    assertThat(registration.getUrlPatterns()).containsExactly("/internal/docs/__flexdoc/execute");
    assertThat(registration.getOrder()).isEqualTo(SecurityProperties.DEFAULT_FILTER_ORDER + 10);
    assertThat(registration.getFilter().maxInFlight()).isEqualTo(7);
    assertThat(registration.getFilter().retryAfterSeconds()).isEqualTo(3);
  }

  @Test
  void defaultPathAndAdmissionSettingsAreBounded() {
    FlexDocProperties properties = new FlexDocProperties();

    var registration = new FlexDocAutoConfiguration().flexDocHostExecutionAdmissionFilter(properties);

    assertThat(registration.getUrlPatterns()).containsExactly("/docs/__flexdoc/execute");
    assertThat(registration.getFilter().maxInFlight()).isEqualTo(16);
    assertThat(registration.getFilter().retryAfterSeconds()).isEqualTo(1);
  }
}
