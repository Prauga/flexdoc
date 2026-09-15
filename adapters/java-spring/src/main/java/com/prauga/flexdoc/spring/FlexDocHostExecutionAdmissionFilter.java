package com.prauga.flexdoc.spring;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Semaphore;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Process-local admission control for the privileged FlexDoc host-execution route.
 *
 * <p>Register this filter specifically for {@code <docsPath>/__flexdoc/execute}, before the
 * FlexDoc controller. It is a bounded-concurrency safety primitive, not authentication or a
 * distributed caller rate limiter.</p>
 */
public final class FlexDocHostExecutionAdmissionFilter extends OncePerRequestFilter {
  private final Semaphore permits;
  private final int maxInFlight;
  private final int retryAfterSeconds;

  /** Creates a filter with a one-second Retry-After response. */
  public FlexDocHostExecutionAdmissionFilter(int maxInFlight) {
    this(maxInFlight, 1);
  }

  /**
   * Creates a bounded host-execution admission filter.
   *
   * @param maxInFlight maximum concurrently admitted execute requests in this process
   * @param retryAfterSeconds positive Retry-After value returned when saturated
   */
  public FlexDocHostExecutionAdmissionFilter(int maxInFlight, int retryAfterSeconds) {
    if (maxInFlight < 1) {
      throw new IllegalArgumentException("FlexDoc host-execution maxInFlight must be positive.");
    }
    if (retryAfterSeconds < 1) {
      throw new IllegalArgumentException("FlexDoc host-execution retryAfterSeconds must be positive.");
    }
    this.maxInFlight = maxInFlight;
    this.retryAfterSeconds = retryAfterSeconds;
    this.permits = new Semaphore(maxInFlight, true);
  }

  /** @return configured per-process concurrency ceiling */
  public int maxInFlight() {
    return maxInFlight;
  }

  /** @return current number of admitted requests that have not completed */
  public int inFlight() {
    return maxInFlight - permits.availablePermits();
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    if (!permits.tryAcquire()) {
      response.setStatus(429);
      response.setHeader("Retry-After", Integer.toString(retryAfterSeconds));
      response.setHeader("Cache-Control", "no-store");
      response.setContentType("application/json");
      response.setCharacterEncoding(StandardCharsets.UTF_8.name());
      response.getWriter().write("{\"error\":\"FlexDoc host execution capacity exceeded.\"}");
      return;
    }

    try {
      filterChain.doFilter(request, response);
    } finally {
      permits.release();
    }
  }
}
