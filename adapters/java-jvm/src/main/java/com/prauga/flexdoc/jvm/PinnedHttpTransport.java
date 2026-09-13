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
import org.apache.hc.client5.http.classic.methods.HttpUriRequestBase;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.impl.DefaultSchemePortResolver;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.impl.routing.DefaultRoutePlanner;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.io.entity.ByteArrayEntity;
import org.apache.hc.core5.util.TimeValue;
import org.apache.hc.core5.util.Timeout;

/** Outbound HTTP transport that connects only to addresses already validated by FlexDoc. */
final class PinnedHttpTransport {
  private static final ExecutorService EXECUTOR = Executors.newCachedThreadPool(task -> {
    Thread thread = new Thread(task, "flexdoc-jvm-host-execution");
    thread.setDaemon(true);
    return thread;
  });

  private static final ThreadLocal<RequestContext> REQUEST_CONTEXT = new ThreadLocal<>();

  private static final DnsResolver PINNED_RESOLVER = new DnsResolver() {
    @Override
    public InetAddress[] resolve(String host) throws UnknownHostException {
      RequestContext context = currentContext(host);
      return context.pinnedAddresses().clone();
    }

    @Override
    public String resolveCanonicalHostname(String host) throws UnknownHostException {
      currentContext(host);
      return host;
    }

    private RequestContext currentContext(String host) throws UnknownHostException {
      RequestContext context = REQUEST_CONTEXT.get();
      if (context == null) {
        throw new UnknownHostException("No active validated address set for host execution.");
      }
      if (!normalizeHost(host).equals(context.expectedHost())) {
        throw new UnknownHostException("Unexpected host resolution attempt: " + host);
      }
      return context;
    }
  };

  private static final PoolingHttpClientConnectionManager CONNECTION_MANAGER =
      PoolingHttpClientConnectionManagerBuilder.create()
          .setDnsResolver(PINNED_RESOLVER)
          .setConnectionConfigResolver(route -> {
            RequestContext context = REQUEST_CONTEXT.get();
            Timeout timeout = context == null ? Timeout.ONE_MILLISECOND : context.timeout();
            return ConnectionConfig.custom()
                .setConnectTimeout(timeout)
                .setSocketTimeout(timeout)
                .setTimeToLive(TimeValue.ZERO_MILLISECONDS)
                .build();
          })
          .setMaxConnTotal(256)
          .setMaxConnPerRoute(256)
          .build();

  private static final CloseableHttpClient CLIENT = HttpClients.custom()
      .setConnectionManager(CONNECTION_MANAGER)
      .setConnectionReuseStrategy((request, response, context) -> false)
      .setRoutePlanner(new DefaultRoutePlanner(DefaultSchemePortResolver.INSTANCE))
      .disableRedirectHandling()
      .disableAutomaticRetries()
      .disableContentCompression()
      .disableCookieManagement()
      .disableAuthCaching()
      .disableConnectionState()
      .disableDefaultUserAgent()
      .build();

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

    Timeout timeout = Timeout.ofMilliseconds(Math.max(1L, timeoutMs));
    RequestContext context = new RequestContext(
        normalizeHost(url.getHost()),
        validatedAddresses.clone(),
        timeout);

    HttpUriRequestBase request = new HttpUriRequestBase(method, url);
    for (FlexDocHostExecution.Header header : headers) {
      request.addHeader(header.name(), header.value());
    }
    if (body != null) request.setEntity(new ByteArrayEntity(body, null));

    Future<Response> future = EXECUTOR.submit(() -> {
      REQUEST_CONTEXT.set(context);
      try {
        return CLIENT.execute(request, response -> {
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
        });
      } finally {
        REQUEST_CONTEXT.remove();
      }
    });

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
    }
  }

  private static String normalizeHost(String host) {
    if (host == null) return "";
    String value = host;
    if (value.startsWith("[") && value.endsWith("]")) value = value.substring(1, value.length() - 1);
    return value.toLowerCase(java.util.Locale.ROOT);
  }

  private record RequestContext(String expectedHost, InetAddress[] pinnedAddresses, Timeout timeout) {}

  static final class DeadlineExceeded extends IOException {}
  static final class ResponseTooLarge extends IOException {}
  record Response(int status, String statusText, List<List<String>> headers, byte[] body) {}
}
