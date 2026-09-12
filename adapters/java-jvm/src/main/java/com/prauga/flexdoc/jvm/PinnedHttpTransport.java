package com.prauga.flexdoc.jvm;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.classic.methods.HttpUriRequestBase;
import org.apache.hc.client5.http.impl.DefaultSchemePortResolver;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.impl.routing.DefaultRoutePlanner;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.io.entity.ByteArrayEntity;
import org.apache.hc.core5.util.Timeout;

/** Outbound HTTP transport that connects only to addresses already validated by FlexDoc. */
final class PinnedHttpTransport {
  private static final ExecutorService EXECUTOR = Executors.newCachedThreadPool(task -> {
    Thread thread = new Thread(task, "flexdoc-jvm-host-execution");
    thread.setDaemon(true);
    return thread;
  });

  private PinnedHttpTransport() {}

  static Response execute(
      String method,
      URI url,
      List<FlexDocHostExecution.Header> headers,
      byte[] body,
      InetAddress[] validatedAddresses,
      long timeoutMs,
      int maxResponseBytes) throws IOException, DeadlineExceeded, ResponseTooLarge {
    if (validatedAddresses == null || validatedAddresses.length == 0) {
      throw new UnknownHostException("No validated target addresses were supplied.");
    }

    String expectedHost = normalizeHost(url.getHost());
    InetAddress[] pinnedAddresses = validatedAddresses.clone();
    DnsResolver pinnedResolver = host -> {
      if (!normalizeHost(host).equals(expectedHost)) {
        throw new UnknownHostException("Unexpected host resolution attempt: " + host);
      }
      return pinnedAddresses.clone();
    };

    Timeout timeout = Timeout.ofMilliseconds(Math.max(1L, timeoutMs));
    ConnectionConfig connectionConfig = ConnectionConfig.custom()
        .setConnectTimeout(timeout)
        .setSocketTimeout(timeout)
        .build();

    PoolingHttpClientConnectionManager connectionManager =
        PoolingHttpClientConnectionManagerBuilder.create()
            .setDnsResolver(pinnedResolver)
            .setDefaultConnectionConfig(connectionConfig)
            .setMaxConnTotal(1)
            .setMaxConnPerRoute(1)
            .build();

    HttpUriRequestBase request = new HttpUriRequestBase(method, url);
    for (FlexDocHostExecution.Header header : headers) {
      request.addHeader(header.name(), header.value());
    }
    if (body != null) request.setEntity(new ByteArrayEntity(body, null));

    CloseableHttpClient client = HttpClients.custom()
        .setConnectionManager(connectionManager)
        .setRoutePlanner(new DefaultRoutePlanner(DefaultSchemePortResolver.INSTANCE))
        .disableRedirectHandling()
        .disableAutomaticRetries()
        .disableContentCompression()
        .disableCookieManagement()
        .disableAuthCaching()
        .disableConnectionState()
        .disableDefaultUserAgent()
        .build();

    Future<Response> future = EXECUTOR.submit(() -> client.execute(request, response -> {
      List<List<String>> responseHeaders = new ArrayList<>();
      for (Header header : response.getHeaders()) {
        responseHeaders.add(List.of(header.getName(), header.getValue()));
      }

      ByteArrayOutputStream output = new ByteArrayOutputStream();
      HttpEntity entity = response.getEntity();
      if (entity != null) {
        try (InputStream input = entity.getContent()) {
          byte[] buffer = new byte[8192];
          int read;
          while ((read = input.read(buffer)) != -1) {
            if ((long) output.size() + read > maxResponseBytes) throw new ResponseTooLarge();
            output.write(buffer, 0, read);
          }
        }
      }

      return new Response(
          response.getCode(),
          response.getReasonPhrase() == null ? "" : response.getReasonPhrase(),
          responseHeaders,
          output.toByteArray());
    }));

    try {
      return future.get(Math.max(1L, timeoutMs), TimeUnit.MILLISECONDS);
    } catch (TimeoutException error) {
      request.cancel();
      future.cancel(true);
      throw new DeadlineExceeded();
    } catch (InterruptedException error) {
      request.cancel();
      future.cancel(true);
      Thread.currentThread().interrupt();
      throw new IOException("Host execution transport was interrupted.", error);
    } catch (ExecutionException error) {
      Throwable cause = error.getCause();
      if (cause instanceof ResponseTooLarge tooLarge) throw tooLarge;
      if (cause instanceof IOException io) throw io;
      throw new IOException(cause == null ? "Unknown host execution transport error." : cause.getMessage(), cause);
    } finally {
      try {
        client.close();
      } catch (IOException ignored) {
        // The request result already carries the primary transport outcome.
      }
    }
  }

  private static String normalizeHost(String host) {
    if (host == null) return "";
    String value = host;
    if (value.startsWith("[") && value.endsWith("]")) value = value.substring(1, value.length() - 1);
    return value.toLowerCase(java.util.Locale.ROOT);
  }

  static final class DeadlineExceeded extends IOException {}
  static final class ResponseTooLarge extends IOException {}
  record Response(int status, String statusText, List<List<String>> headers, byte[] body) {}
}
