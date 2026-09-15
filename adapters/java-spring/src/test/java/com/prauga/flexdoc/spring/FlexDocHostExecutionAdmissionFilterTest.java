package com.prauga.flexdoc.spring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.ServletException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class FlexDocHostExecutionAdmissionFilterTest {
  @Test
  void saturatedFilterRejectsImmediatelyWithRetryAfter() throws Exception {
    FlexDocHostExecutionAdmissionFilter filter = new FlexDocHostExecutionAdmissionFilter(1, 3);
    CountDownLatch entered = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    AtomicReference<Throwable> firstFailure = new AtomicReference<>();

    Thread first = new Thread(() -> {
      try {
        filter.doFilter(
            new MockHttpServletRequest(),
            new MockHttpServletResponse(),
            (request, response) -> {
              entered.countDown();
              try {
                if (!release.await(5, TimeUnit.SECONDS)) {
                  throw new ServletException("timed out waiting to release admission test");
                }
              } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                throw new ServletException(error);
              }
            });
      } catch (Throwable error) {
        firstFailure.set(error);
      }
    });
    first.start();

    assertTrue(entered.await(5, TimeUnit.SECONDS));
    assertEquals(1, filter.inFlight());

    MockHttpServletResponse saturated = new MockHttpServletResponse();
    AtomicBoolean downstreamRan = new AtomicBoolean(false);
    filter.doFilter(
        new MockHttpServletRequest(),
        saturated,
        (request, response) -> downstreamRan.set(true));

    assertEquals(429, saturated.getStatus());
    assertEquals("3", saturated.getHeader("Retry-After"));
    assertEquals("no-store", saturated.getHeader("Cache-Control"));
    assertTrue(saturated.getContentAsString().contains("capacity exceeded"));
    assertFalse(downstreamRan.get());

    release.countDown();
    first.join(5_000);
    assertFalse(first.isAlive());
    assertNull(firstFailure.get());
    assertEquals(0, filter.inFlight());
  }

  @Test
  void downstreamFailureStillReleasesPermit() throws Exception {
    FlexDocHostExecutionAdmissionFilter filter = new FlexDocHostExecutionAdmissionFilter(1);

    assertThrows(ServletException.class, () -> filter.doFilter(
        new MockHttpServletRequest(),
        new MockHttpServletResponse(),
        (request, response) -> { throw new ServletException("boom"); }));

    assertEquals(0, filter.inFlight());
    AtomicBoolean downstreamRan = new AtomicBoolean(false);
    filter.doFilter(
        new MockHttpServletRequest(),
        new MockHttpServletResponse(),
        (request, response) -> downstreamRan.set(true));
    assertTrue(downstreamRan.get());
    assertEquals(0, filter.inFlight());
  }
}
