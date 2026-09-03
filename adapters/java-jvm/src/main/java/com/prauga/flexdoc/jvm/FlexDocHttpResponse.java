package com.prauga.flexdoc.jvm;

import java.nio.charset.StandardCharsets;

/** Framework-neutral HTTP response returned by {@link FlexDocHost}. */
public record FlexDocHttpResponse(int status, String contentType, String cacheControl, byte[] body) {
  /** Defensively copies the response body. */
  public FlexDocHttpResponse {
    body = body == null ? new byte[0] : body.clone();
  }

  @Override
  public byte[] body() { return body.clone(); }

  /** @return UTF-8 response text for HTML and test assertions */
  public String bodyUtf8() { return new String(body, StandardCharsets.UTF_8); }
}
