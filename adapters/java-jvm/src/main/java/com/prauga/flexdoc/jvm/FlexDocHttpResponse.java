package com.prauga.flexdoc.jvm;

import java.nio.charset.StandardCharsets;

/** Framework-neutral HTTP response returned by {@link FlexDocHost}. */
public record FlexDocHttpResponse(
    /** HTTP status code. */
    int status,
    /** Response {@code Content-Type} header value. */
    String contentType,
    /** Response {@code Cache-Control} header value. */
    String cacheControl,
    /** Response body bytes. */
    byte[] body) {
  /** Defensively copies the response body. */
  public FlexDocHttpResponse {
    body = body == null ? new byte[0] : body.clone();
  }

  /** @return a defensive copy of the response body */
  @Override
  public byte[] body() { return body.clone(); }

  /** @return UTF-8 response text for HTML and test assertions */
  public String bodyUtf8() { return new String(body, StandardCharsets.UTF_8); }
}
