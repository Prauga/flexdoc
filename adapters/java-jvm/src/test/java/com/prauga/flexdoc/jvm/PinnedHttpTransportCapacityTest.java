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
    CountDownLatch workersStarted = new CountDownLatch(PinnedHttpTransport.MAX_EXECUTION_THREADS);
    List<Future<?>> blockers = new ArrayList<>();

    try {
      for (int index = 0; index < PinnedHttpTransport.MAX_EXECUTION_THREADS; index++) {
        blockers.add(executor.submit(() -> {
          workersStarted.countDown();
          try {
            release.await();
          } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
          }
        }));
      }
      assertTrue(workersStarted.await(5, TimeUnit.SECONDS), "host-execution workers did not saturate");

      for (int index = 0; index < PinnedHttpTransport.MAX_QUEUED_EXECUTIONS; index++) {
        blockers.add(executor.submit(() -> {
          try {
            release.await();
          } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
          }
        }));
      }
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
      executor.purge();
    }
  }
}
