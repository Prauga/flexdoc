package com.prauga.flexdoc.spring;

import com.prauga.flexdoc.jvm.FlexDocConfig;
import java.util.List;
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
  private String expand = "";
  private List<String> expandSections = List.of();
  private String tryItDefaultServer = "";
  private String tryItCredentials = "";
  private Object tryItApiClientPersistenceKey;

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
  public String getExpand() { return expand; }
  public void setExpand(String expand) { this.expand = expand; }
  public List<String> getExpandSections() { return expandSections; }
  public void setExpandSections(List<String> expandSections) { this.expandSections = expandSections == null ? List.of() : List.copyOf(expandSections); }
  public String getTryItDefaultServer() { return tryItDefaultServer; }
  public void setTryItDefaultServer(String tryItDefaultServer) { this.tryItDefaultServer = tryItDefaultServer; }
  public String getTryItCredentials() { return tryItCredentials; }
  public void setTryItCredentials(String tryItCredentials) { this.tryItCredentials = tryItCredentials; }
  public Object getTryItApiClientPersistenceKey() { return tryItApiClientPersistenceKey; }
  public void setTryItApiClientPersistenceKey(Object tryItApiClientPersistenceKey) { this.tryItApiClientPersistenceKey = tryItApiClientPersistenceKey; }

  FlexDocConfig toConfig() {
    FlexDocConfig.Builder builder = FlexDocConfig.builder()
        .path(path)
        .specUrl(specUrl)
        .title(title)
        .theme(theme)
        .tryItEnabled(tryItEnabled)
        .tryItDefaultServer(tryItDefaultServer)
        .tryItCredentials(tryItCredentials);

    if (expandSections != null && !expandSections.isEmpty()) builder.expandSections(expandSections);
    else if (expand != null && !expand.isBlank()) builder.expand(expand);

    Object persistenceKey = tryItApiClientPersistenceKey;
    if (persistenceKey instanceof String stringValue) {
      if (stringValue.equalsIgnoreCase("false")) builder.tryItApiClientPersistenceKey(false);
      else if (!stringValue.isBlank()) builder.tryItApiClientPersistenceKey(stringValue);
    } else if (persistenceKey instanceof Boolean booleanValue) {
      builder.tryItApiClientPersistenceKey(booleanValue);
    } else if (persistenceKey != null) {
      throw new IllegalArgumentException("FlexDoc API Client persistence key must be a string or false");
    }

    return builder.build();
  }
}
