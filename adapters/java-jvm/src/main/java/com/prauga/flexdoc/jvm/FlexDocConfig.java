package com.prauga.flexdoc.jvm;

import java.util.List;

/** Immutable framework-neutral configuration for a FlexDoc host. */
public record FlexDocConfig(
    /** Route where FlexDoc is mounted. */
    String path,
    /** OpenAPI JSON URL loaded by the browser when no inline spec supplier is configured. */
    String specUrl,
    /** Browser title and renderer title. */
    String title,
    /** Initial theme: system, light, or dark. */
    String theme,
    /** Whether Try It and the API Client handoff are enabled. */
    boolean tryItEnabled,
    /** Renderer expansion preset or explicit section list. Omitted when unset. */
    Object expand,
    /** Default Try It server URL. Omitted when unset. */
    String tryItDefaultServer,
    /** Fetch credentials mode: omit, same-origin, or include. Omitted when unset. */
    String tryItCredentials,
    /** API Client persistence key, or {@code false} to disable IndexedDB workspace persistence. */
    Object tryItApiClientPersistenceKey,
    /** Advertise the host-execution protocol shape in renderer options. Host execution is not implemented yet. */
    boolean tryItHostExecution,
    /** Framework identifier exposed to Runtime Intelligence, or {@code null} when disabled. */
    String runtimeIntelligenceFramework) {
  /**
   * Creates configuration with the original public fields; later renderer settings remain unset.
   *
   * @param path route where FlexDoc is mounted
   * @param specUrl OpenAPI JSON URL loaded by the browser
   * @param title browser and renderer title
   * @param theme initial theme: system, light, or dark
   * @param tryItEnabled whether Try It and the API Client handoff are enabled
   */
  public FlexDocConfig(String path, String specUrl, String title, String theme, boolean tryItEnabled) {
    this(path, specUrl, title, theme, tryItEnabled, null, null, null, null, false, null);
  }

  /**
   * Creates configuration with renderer expansion and Try It settings; host execution and Runtime Intelligence remain unset.
   *
   * @param path route where FlexDoc is mounted
   * @param specUrl OpenAPI JSON URL loaded by the browser
   * @param title browser and renderer title
   * @param theme initial theme: system, light, or dark
   * @param tryItEnabled whether Try It and the API Client handoff are enabled
   * @param expand renderer expansion preset or explicit section list
   * @param tryItDefaultServer default Try It server URL
   * @param tryItCredentials fetch credentials mode
   * @param tryItApiClientPersistenceKey API Client persistence key, or {@code false}
   */
  public FlexDocConfig(
      String path,
      String specUrl,
      String title,
      String theme,
      boolean tryItEnabled,
      Object expand,
      String tryItDefaultServer,
      String tryItCredentials,
      Object tryItApiClientPersistenceKey) {
    this(path, specUrl, title, theme, tryItEnabled, expand, tryItDefaultServer, tryItCredentials, tryItApiClientPersistenceKey, false, null);
  }

  /**
   * Creates configuration with host-execution advertisement enabled; Runtime Intelligence remains disabled.
   *
   * @param path route where FlexDoc is mounted
   * @param specUrl OpenAPI JSON URL loaded by the browser
   * @param title browser and renderer title
   * @param theme initial theme: system, light, or dark
   * @param tryItEnabled whether Try It and the API Client handoff are enabled
   * @param expand renderer expansion preset or explicit section list
   * @param tryItDefaultServer default Try It server URL
   * @param tryItCredentials fetch credentials mode
   * @param tryItApiClientPersistenceKey API Client persistence key, or {@code false}
   * @param tryItHostExecution whether to advertise host-execution protocol metadata
   */
  public FlexDocConfig(
      String path,
      String specUrl,
      String title,
      String theme,
      boolean tryItEnabled,
      Object expand,
      String tryItDefaultServer,
      String tryItCredentials,
      Object tryItApiClientPersistenceKey,
      boolean tryItHostExecution) {
    this(path, specUrl, title, theme, tryItEnabled, expand, tryItDefaultServer, tryItCredentials, tryItApiClientPersistenceKey, tryItHostExecution, null);
  }

  /** Creates validated configuration and normalizes the documentation path. */
  public FlexDocConfig {
    path = normalizePath(path);
    specUrl = blankToNull(specUrl);
    title = title == null || title.isBlank() ? "API Documentation" : title;
    theme = theme == null || theme.isBlank() ? "light" : theme;
    tryItDefaultServer = blankToNull(tryItDefaultServer);
    tryItCredentials = blankToNull(tryItCredentials);
    runtimeIntelligenceFramework = blankToNull(runtimeIntelligenceFramework);
    if (!theme.equals("system") && !theme.equals("light") && !theme.equals("dark")) {
      throw new IllegalArgumentException("FlexDoc theme must be system, light, or dark");
    }
    if (tryItCredentials != null
        && !tryItCredentials.equals("omit")
        && !tryItCredentials.equals("same-origin")
        && !tryItCredentials.equals("include")) {
      throw new IllegalArgumentException("FlexDoc Try It credentials must be omit, same-origin, or include");
    }
    if (expand != null && !(expand instanceof String) && !(expand instanceof List<?>)) {
      throw new IllegalArgumentException("FlexDoc expand must be a preset string or section list");
    }
    if (expand instanceof List<?> values && values.stream().anyMatch(value -> !(value instanceof String))) {
      throw new IllegalArgumentException("FlexDoc expand section lists must contain strings");
    }
    if (tryItApiClientPersistenceKey != null
        && !(tryItApiClientPersistenceKey instanceof String)
        && !(tryItApiClientPersistenceKey instanceof Boolean)) {
      throw new IllegalArgumentException("FlexDoc API Client persistence key must be a string or false");
    }
    if (Boolean.TRUE.equals(tryItApiClientPersistenceKey)) {
      throw new IllegalArgumentException("FlexDoc API Client persistence key supports false, not true");
    }
  }

  /** @return a builder with FlexDoc defaults */
  public static Builder builder() { return new Builder(); }

  private static String normalizePath(String value) {
    if (value == null || value.isBlank()) return "/docs";
    String normalized = value.trim();
    if (!normalized.startsWith("/")) normalized = "/" + normalized;
    while (normalized.length() > 1 && normalized.endsWith("/")) {
      normalized = normalized.substring(0, normalized.length() - 1);
    }
    return normalized.equals("/") ? "/docs" : normalized;
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  /** Fluent builder for framework integrations and DI modules. */
  public static final class Builder {
    private String path = "/docs";
    private String specUrl = "/openapi.json";
    private String title = "API Documentation";
    private String theme = "light";
    private boolean tryItEnabled = true;
    private Object expand;
    private String tryItDefaultServer;
    private String tryItCredentials;
    private Object tryItApiClientPersistenceKey;
    private boolean tryItHostExecution;
    private String runtimeIntelligenceFramework;

    /** Creates a builder initialized with FlexDoc defaults. */
    public Builder() {}

    /** Sets the route where FlexDoc is mounted. */
    public Builder path(String value) { path = value; return this; }

    /** Sets the OpenAPI JSON URL loaded by the browser. */
    public Builder specUrl(String value) { specUrl = value; return this; }

    /** Sets the browser title and renderer title. */
    public Builder title(String value) { title = value; return this; }

    /** Sets the initial theme: system, light, or dark. */
    public Builder theme(String value) { theme = value; return this; }

    /** Enables or disables Try It and the API Client handoff. */
    public Builder tryItEnabled(boolean value) { tryItEnabled = value; return this; }

    /** Sets a renderer expansion preset. */
    public Builder expand(String value) { expand = value; return this; }

    /** Sets explicit renderer sections to expand. */
    public Builder expandSections(List<String> value) { expand = value == null ? null : List.copyOf(value); return this; }

    /** Sets the default Try It server URL. */
    public Builder tryItDefaultServer(String value) { tryItDefaultServer = value; return this; }

    /** Sets the Try It fetch credentials mode. */
    public Builder tryItCredentials(String value) { tryItCredentials = value; return this; }

    /** Sets the API Client persistence key. */
    public Builder tryItApiClientPersistenceKey(String value) { tryItApiClientPersistenceKey = value; return this; }

    /** Disables API Client persistence when {@code false}. */
    public Builder tryItApiClientPersistenceKey(boolean value) { tryItApiClientPersistenceKey = value; return this; }

    /** Advertises the host-execution protocol shape in renderer options. */
    public Builder tryItHostExecution(boolean value) { tryItHostExecution = value; return this; }

    /** Enables Runtime Intelligence for the given framework identifier. */
    public Builder runtimeIntelligenceFramework(String value) { runtimeIntelligenceFramework = value; return this; }

    /** Builds validated host configuration. */
    public FlexDocConfig build() {
      return new FlexDocConfig(
          path,
          specUrl,
          title,
          theme,
          tryItEnabled,
          expand,
          tryItDefaultServer,
          tryItCredentials,
          tryItApiClientPersistenceKey,
          tryItHostExecution,
          runtimeIntelligenceFramework);
    }
  }
}
