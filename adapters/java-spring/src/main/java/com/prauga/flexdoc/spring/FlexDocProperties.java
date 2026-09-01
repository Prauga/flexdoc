package com.prauga.flexdoc.spring;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration properties for the self-hosted FlexDoc Spring Boot integration. */
@ConfigurationProperties(prefix = "flexdoc")
public class FlexDocProperties {
  private boolean enabled = true;
  private String path = "/docs";
  private String specUrl = "/v3/api-docs";
  private String specLocation = "";
  private String title = "API Documentation";
  private String theme = "light";
  private boolean tryItEnabled = true;

  /** @return whether the FlexDoc endpoint is enabled */
  public boolean isEnabled() { return enabled; }

  /** @param enabled whether the FlexDoc endpoint should be enabled */
  public void setEnabled(boolean enabled) { this.enabled = enabled; }

  /** @return documentation route, defaulting to {@code /docs} */
  public String getPath() { return path; }

  /** @param path documentation route */
  public void setPath(String path) { this.path = path; }

  /** @return URL from which the browser renderer loads the OpenAPI document */
  public String getSpecUrl() { return specUrl; }

  /** @param specUrl URL from which the browser renderer loads the OpenAPI document */
  public void setSpecUrl(String specUrl) { this.specUrl = specUrl; }

  /** @return optional Spring resource location containing an OpenAPI document */
  public String getSpecLocation() { return specLocation; }

  /** @param specLocation optional Spring resource location containing an OpenAPI document */
  public void setSpecLocation(String specLocation) { this.specLocation = specLocation; }

  /** @return documentation page title */
  public String getTitle() { return title; }

  /** @param title documentation page title */
  public void setTitle(String title) { this.title = title; }

  /** @return renderer theme name */
  public String getTheme() { return theme; }

  /** @param theme renderer theme name */
  public void setTheme(String theme) { this.theme = theme; }

  /** @return whether interactive Try It controls are enabled */
  public boolean isTryItEnabled() { return tryItEnabled; }

  /** @param tryItEnabled whether interactive Try It controls are enabled */
  public void setTryItEnabled(boolean tryItEnabled) { this.tryItEnabled = tryItEnabled; }
}
