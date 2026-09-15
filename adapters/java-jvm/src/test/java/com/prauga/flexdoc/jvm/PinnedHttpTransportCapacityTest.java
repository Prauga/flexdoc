package com.prauga.flexdoc.jvm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.lang.reflect.Field;
import java.net.InetAddress;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class PinnedHttpTransportCapacityTest {
  @Test
  void saturatedWorkerPoolRejectsWithoutBlocking() throws Exception {
    Field executorField = PinnedHttpTransport.class.getDeclaredField("EXECUTOR");
    executorField.setAccessible(true);
    ThreadPoolExecutor executor = (ThreadPoolExecutor) executorField.get(null);

    CountDownLatch release = new CountDownLatch(1);
    List<Future<?>> blockers = new ArrayList<>();
    boolean saturated = false;

    try {
      int maximumAccepted = PinnedHttpTransport.MAX_EXECUTION_THREADS
          + PinnedHttpTransport.MAX_QUEUED_EXECUTIONS;
      for (int index = 0; index <= maximumAccepted; index++) {
        try {
          blockers.add(executor.submit(() -> {
            try {
              release.await();
            } catch (InterruptedException error) {
              Thread.currentThread().interrupt();
            }
          }));
        } catch (RejectedExecutionException expected) {
          saturated = true;
          break;
        }
      }

      assertTrue(saturated, "host-execution executor did not reach its bounded capacity");
      assertEquals(PinnedHttpTransport.MAX_EXECUTION_THREADS, executor.getPoolSize());
      assertEquals(0, executor.getQueue().remainingCapacity(), "host-execution queue should be full");

      long started = System.nanoTime();
      IOException error = assertThrows(IOException.class, () -> PinnedHttpTransport.execute(
          "GET",
          URI.create("http://127.0.0.1:1/"),
          List.of(),
          null,
          new InetAddress[] { InetAddress.getByName("127.0.0.1") },
          1_000L,
          1024));
      long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);

      assertEquals("Host execution transport capacity exceeded.", error.getMessage());
      assertTrue(elapsedMs < 500L, "saturated transport should reject promptly, took " + elapsedMs + " ms");
    } finally {
      for (Future<?> blocker : blockers) blocker.cancel(true);
      release.countDown();
      long cleanupDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
      do {
        executor.purge();
        if (executor.getActiveCount() == 0 && executor.getQueue().isEmpty()) break;
        Thread.sleep(10L);
      } while (System.nanoTime() < cleanupDeadline);
    }
  }
}
