package io.github.bluejeans117.flexdoc.spring;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flexdoc")
public class FlexDocProperties {
  private boolean enabled = true;
  private String path = "/docs";
  private String specUrl = "/v3/api-docs";
  private String specLocation = "";
  private String title = "API Documentation";
  private String theme = "light";
  private boolean tryItEnabled = true;

  public boolean isEnabled() { return enabled; }
  public void setEnabled(boolean enabled) { this.enabled = enabled; }
  public String getPath() { return path; }
  public void setPath(String path) { this.path = path; }
  public String getSpecUrl() { return specUrl; }
  public void setSpecUrl(String specUrl) { this.specUrl = specUrl; }
  public String getSpecLocation() { return specLocation; }
  public void setSpecLocation(String specLocation) { this.specLocation = specLocation; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public String getTheme() { return theme; }
  public void setTheme(String theme) { this.theme = theme; }
  public boolean isTryItEnabled() { return tryItEnabled; }
  public void setTryItEnabled(boolean tryItEnabled) { this.tryItEnabled = tryItEnabled; }
}
