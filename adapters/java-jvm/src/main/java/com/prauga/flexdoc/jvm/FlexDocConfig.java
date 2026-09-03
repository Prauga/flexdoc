package com.prauga.flexdoc.jvm;

/** Immutable framework-neutral configuration for a FlexDoc host. */
public record FlexDocConfig(String path, String specUrl, String title, String theme, boolean tryItEnabled) {
  /** Creates validated configuration and normalizes the documentation path. */
  public FlexDocConfig {
    path = normalizePath(path);
    specUrl = blankToNull(specUrl);
    title = title == null || title.isBlank() ? "API Documentation" : title;
    theme = theme == null || theme.isBlank() ? "light" : theme;
    if (!theme.equals("system") && !theme.equals("light") && !theme.equals("dark")) {
      throw new IllegalArgumentException("FlexDoc theme must be system, light, or dark");
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

    public Builder path(String value) { path = value; return this; }
    public Builder specUrl(String value) { specUrl = value; return this; }
    public Builder title(String value) { title = value; return this; }
    public Builder theme(String value) { theme = value; return this; }
    public Builder tryItEnabled(boolean value) { tryItEnabled = value; return this; }
    public FlexDocConfig build() { return new FlexDocConfig(path, specUrl, title, theme, tryItEnabled); }
  }
}
