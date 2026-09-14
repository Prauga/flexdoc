package com.prauga.flexdoc.spring;

import com.prauga.flexdoc.jvm.FlexDocConfig;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration properties for the self-hosted FlexDoc Spring Boot integration. */
@ConfigurationProperties(prefix = "flexdoc")
public class FlexDocProperties {
  /** Whether the FlexDoc auto-configuration is active. */
  private boolean enabled = true;
  /** Route where FlexDoc is mounted. */
  private String path = "/docs";
  /** OpenAPI JSON URL loaded by the browser when no spec provider is configured. */
  private String specUrl = "/v3/api-docs";
  /** Classpath or filesystem location used to create the default spec provider. */
  private String specLocation = "";
  /** Browser title and renderer title. */
  private String title = "API Documentation";
  /** Initial theme: system, light, or dark. */
  private String theme = "light";
  /** Whether Try It and the API Client handoff are enabled. */
  private boolean tryItEnabled = true;
  /** Renderer expansion preset. Ignored when {@link #expandSections} is non-empty. */
  private String expand = "";
  /** Explicit renderer sections to expand. Takes precedence over {@link #expand}. */
  private List<String> expandSections = List.of();
  /** Default Try It server URL. Omitted when blank. */
  private String tryItDefaultServer = "";
  /** Try It fetch credentials mode. Omitted when blank. */
  private String tryItCredentials = "";
  /** API Client persistence key, or {@code false} to disable IndexedDB workspace persistence. */
  private Object tryItApiClientPersistenceKey;
  /** Enables the Spring-owned native host execution endpoint. */
  private boolean tryItHostExecution;
  /** Exact HTTP(S) origins the native host executor may target. */
  private List<String> tryItHostExecutionAllowedOrigins = List.of();
  /** Enables live Spring route discovery and OpenAPI presence drift reporting. */
  private boolean runtimeIntelligence;

  /** @return whether FlexDoc auto-configuration is enabled */
  public boolean isEnabled() { return enabled; }

  /** @param enabled whether FlexDoc auto-configuration is enabled */
  public void setEnabled(boolean enabled) { this.enabled = enabled; }

  /** @return the documentation route */
  public String getPath() { return path; }

  /** @param path the documentation route */
  public void setPath(String path) { this.path = path; }

  /** @return the OpenAPI JSON URL used when no spec provider is configured */
  public String getSpecUrl() { return specUrl; }

  /** @param specUrl the OpenAPI JSON URL used when no spec provider is configured */
  public void setSpecUrl(String specUrl) { this.specUrl = specUrl; }

  /** @return the classpath or filesystem location for the default spec provider */
  public String getSpecLocation() { return specLocation; }

  /** @param specLocation the classpath or filesystem location for the default spec provider */
  public void setSpecLocation(String specLocation) { this.specLocation = specLocation; }

  /** @return the browser title and renderer title */
  public String getTitle() { return title; }

  /** @param title the browser title and renderer title */
  public void setTitle(String title) { this.title = title; }

  /** @return the initial theme */
  public String getTheme() { return theme; }

  /** @param theme the initial theme */
  public void setTheme(String theme) { this.theme = theme; }

  /** @return whether Try It is enabled */
  public boolean isTryItEnabled() { return tryItEnabled; }

  /** @param tryItEnabled whether Try It is enabled */
  public void setTryItEnabled(boolean tryItEnabled) { this.tryItEnabled = tryItEnabled; }

  /** @return the renderer expansion preset */
  public String getExpand() { return expand; }

  /** @param expand the renderer expansion preset */
  public void setExpand(String expand) { this.expand = expand; }

  /** @return the explicit renderer sections to expand */
  public List<String> getExpandSections() { return expandSections; }

  /** @param expandSections the explicit renderer sections to expand */
  public void setExpandSections(List<String> expandSections) { this.expandSections = expandSections == null ? List.of() : List.copyOf(expandSections); }

  /** @return the default Try It server URL */
  public String getTryItDefaultServer() { return tryItDefaultServer; }

  /** @param tryItDefaultServer the default Try It server URL */
  public void setTryItDefaultServer(String tryItDefaultServer) { this.tryItDefaultServer = tryItDefaultServer; }

  /** @return the Try It fetch credentials mode */
  public String getTryItCredentials() { return tryItCredentials; }

  /** @param tryItCredentials the Try It fetch credentials mode */
  public void setTryItCredentials(String tryItCredentials) { this.tryItCredentials = tryItCredentials; }

  /** @return the API Client persistence key */
  public Object getTryItApiClientPersistenceKey() { return tryItApiClientPersistenceKey; }

  /** @param tryItApiClientPersistenceKey the API Client persistence key, or {@code false} to disable persistence */
  public void setTryItApiClientPersistenceKey(Object tryItApiClientPersistenceKey) { this.tryItApiClientPersistenceKey = tryItApiClientPersistenceKey; }

  /** @return whether native Spring host execution is enabled */
  public boolean isTryItHostExecution() { return tryItHostExecution; }

  /** @param tryItHostExecution whether to register and advertise the native Spring executor */
  public void setTryItHostExecution(boolean tryItHostExecution) { this.tryItHostExecution = tryItHostExecution; }

  /** @return exact target origins permitted for native host execution */
  public List<String> getTryItHostExecutionAllowedOrigins() { return tryItHostExecutionAllowedOrigins; }

  /** @param allowedOrigins exact HTTP(S) origins permitted for native host execution */
  public void setTryItHostExecutionAllowedOrigins(List<String> allowedOrigins) {
    this.tryItHostExecutionAllowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
  }

  /** @return whether Runtime Intelligence is enabled */
  public boolean isRuntimeIntelligence() { return runtimeIntelligence; }

  /** @param runtimeIntelligence whether Runtime Intelligence is enabled */
  public void setRuntimeIntelligence(boolean runtimeIntelligence) { this.runtimeIntelligence = runtimeIntelligence; }

  FlexDocConfig toConfig() {
    FlexDocConfig.Builder builder = FlexDocConfig.builder()
        .path(path)
        .specUrl(specUrl)
        .title(title)
        .theme(theme)
        .tryItEnabled(tryItEnabled)
        .tryItDefaultServer(tryItDefaultServer)
        .tryItCredentials(tryItCredentials)
        .tryItHostExecution(tryItHostExecution);

    if (runtimeIntelligence) builder.runtimeIntelligenceFramework("spring");
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
