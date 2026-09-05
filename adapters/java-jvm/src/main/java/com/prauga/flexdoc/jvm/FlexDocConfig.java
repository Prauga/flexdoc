package com.prauga.flexdoc.jvm;

import java.util.List;

/** Immutable framework-neutral configuration for a FlexDoc host. */
public record FlexDocConfig(
    String path,
    String specUrl,
    String title,
    String theme,
    boolean tryItEnabled,
    Object expand,
    String tryItDefaultServer,
    String tryItCredentials,
    Object tryItApiClientPersistenceKey) {
  /** Preserves the original public constructor while leaving new renderer settings unset. */
  public FlexDocConfig(String path, String specUrl, String title, String theme, boolean tryItEnabled) {
    this(path, specUrl, title, theme, tryItEnabled, null, null, null, null);
  }

  /** Creates validated configuration and normalizes the documentation path. */
  public FlexDocConfig {
    path = normalizePath(path);
    specUrl = blankToNull(specUrl);
    title = title == null || title.isBlank() ? "API Documentation" : title;
    theme = theme == null || theme.isBlank() ? "light" : theme;
    tryItDefaultServer = blankToNull(tryItDefaultServer);
    tryItCredentials = blankToNull(tryItCredentials);
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

    public Builder path(String value) { path = value; return this; }
    public Builder specUrl(String value) { specUrl = value; return this; }
    public Builder title(String value) { title = value; return this; }
    public Builder theme(String value) { theme = value; return this; }
    public Builder tryItEnabled(boolean value) { tryItEnabled = value; return this; }
    public Builder expand(String value) { expand = value; return this; }
    public Builder expandSections(List<String> value) { expand = value == null ? null : List.copyOf(value); return this; }
    public Builder tryItDefaultServer(String value) { tryItDefaultServer = value; return this; }
    public Builder tryItCredentials(String value) { tryItCredentials = value; return this; }
    public Builder tryItApiClientPersistenceKey(String value) { tryItApiClientPersistenceKey = value; return this; }
    public Builder tryItApiClientPersistenceKey(boolean value) { tryItApiClientPersistenceKey = value; return this; }
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
          tryItApiClientPersistenceKey);
    }
  }
}
