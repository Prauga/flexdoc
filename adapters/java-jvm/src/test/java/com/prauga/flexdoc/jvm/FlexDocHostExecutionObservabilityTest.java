package com.prauga.flexdoc.jvm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.ServerSocket;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class FlexDocHostExecutionObservabilityTest {
  private final List<FlexDocHostExecutionMetric> metrics = Collections.synchronizedList(new ArrayList<>());

  private FlexDocHostExecution executor(String origin) {
    return new FlexDocHostExecution(List.of(origin), metrics::add);
  }

  // The reason vocabulary is a cross-runtime contract, not a JVM detail: a collector
  // written against any other FlexDoc host must read these labels unchanged.
  @Test
  void reasonVocabularyMatchesEveryOtherRuntime() {
    assertEquals(
        List.of(
            "marker-missing", "execution-disabled", "admission-saturated", "destination-forbidden",
            "redirect-forbidden", "body-malformed", "body-too-large", "unsupported-media-type",
            "request-invalid", "auth-unsupported", "upstream-timeout", "upstream-unreachable",
            "upstream-error"),
        FlexDocHostExecutionReason.wireValues());
    assertEquals("flexdoc.host-execution.observation/1", FlexDocHostExecutionReason.OBSERVATION_SCHEMA);
    assertTrue(FlexDocHostExecutionReason.fromWireValue("upstream-timeout").isPresent());
    assertTrue(FlexDocHostExecutionReason.fromWireValue("slow").isEmpty());
    assertTrue(FlexDocHostExecutionReason.fromWireValue(null).isEmpty());
  }

  // A throw site that forgets its reason must still produce a usable category rather
  // than silently degrading the export.
  @Test
  void reasonDefaultsFollowTheStatus() {
    assertEquals(FlexDocHostExecutionReason.DESTINATION_FORBIDDEN, FlexDocHostExecutionReason.defaultForStatus(403));
    assertEquals(FlexDocHostExecutionReason.UPSTREAM_ERROR, FlexDocHostExecutionReason.defaultForStatus(502));
    assertEquals(FlexDocHostExecutionReason.REQUEST_INVALID, FlexDocHostExecutionReason.defaultForStatus(400));
    assertEquals(
        FlexDocHostExecutionReason.DESTINATION_FORBIDDEN,
        new FlexDocHostExecutionException(403, "blocked").reason());
  }

  @Test
  void unmarkedRequestIsCountedOutsideTheLifecycle() {
    FlexDocHostExecutionResult result = executor("http://127.0.0.1:1").handle(null, Map.of());

    assertEquals(403, result.status());
    assertEquals(1, metrics.size());
    assertEquals("flexdoc_execute_unmarked_total", metrics.get(0).name());
    assertEquals("marker-missing", metrics.get(0).labels().get("reason"));
  }

  @Test
  void policyRejectionCarriesItsReasonAndIsNotAnUpstreamError() {
    FlexDocHostExecutionResult result = executor("http://127.0.0.1:1")
        .handle("1", Map.of("request", Map.of("method", "GET", "url", "http://blocked.example.test/pets")));

    assertEquals(403, result.status());
    FlexDocHostExecutionMetric rejection = single("flexdoc_execute_rejections_total");
    assertEquals("destination-forbidden", rejection.labels().get("reason"));
    assertEquals("403", rejection.labels().get("statusCode"));
    assertEquals("route", rejection.labels().get("source"));
    assertEquals("rejected", single("flexdoc_execute_completions_total").labels().get("outcome"));
    assertTrue(named("flexdoc_execute_errors_total").isEmpty(), "a policy rejection is not an upstream error");
    assertNotNull(single("flexdoc_execute_duration_seconds"));
    assertEquals(0d, gaugeSum(), "the in-flight gauge must return to zero");
  }

  // The JVM entry point already takes a parsed map, so a draft that is not an object is
  // a structurally valid envelope FlexDoc cannot use, not an unparseable body. The two
  // stay separate categories because an operator acts on them differently.
  @Test
  void unusableDraftIsRequestInvalidRatherThanMalformed() {
    FlexDocHostExecutionResult result = executor("http://127.0.0.1:1").handle("1", Map.of("request", "not an object"));

    assertEquals(400, result.status());
    assertEquals("request-invalid", single("flexdoc_execute_rejections_total").labels().get("reason"));
  }

  @Test
  void malformedBodyIsSeparableFromAPolicyRejection() {
    FlexDocHostExecutionResult result = executor("http://127.0.0.1:1").handle("1", Map.of(
        "request", Map.of("method", "POST", "url", "http://127.0.0.1:1/pets", "bodyMode", "binary"),
        "bodyBase64", "not base64!!"));

    assertEquals(400, result.status());
    assertEquals("body-malformed", single("flexdoc_execute_rejections_total").labels().get("reason"));
    assertTrue(named("flexdoc_execute_errors_total").isEmpty(), "a malformed body is not an upstream error");
  }

  @Test
  void unreachableUpstreamIsAFailureNotARejection() throws IOException {
    String origin = "http://127.0.0.1:" + closedPort();
    FlexDocHostExecutionResult result = executor(origin)
        .handle("1", Map.of("request", Map.of("method", "GET", "url", origin + "/pets")));

    assertEquals(502, result.status());
    assertEquals("upstream-unreachable", single("flexdoc_execute_errors_total").labels().get("reason"));
    assertTrue(named("flexdoc_execute_rejections_total").isEmpty(), "an upstream failure is not a policy rejection");
    assertEquals("error", single("flexdoc_execute_completions_total").labels().get("outcome"));
    assertEquals(0d, gaugeSum(), "the in-flight gauge must return to zero after a failure");
  }

  @Test
  void throwingSinkCannotFailAnExecution() {
    FlexDocHostExecution hostile = new FlexDocHostExecution(
        List.of("http://127.0.0.1:1"),
        metric -> { throw new IllegalStateException("collector down"); });

    assertEquals(403, hostile.handle(null, Map.of()).status());
    assertEquals(
        403,
        hostile.handle("1", Map.of("request", Map.of("method", "GET", "url", "http://blocked.example.test/pets"))).status());
  }

  @Test
  void executorWithoutASinkBehavesExactlyAsBefore() {
    FlexDocHostExecution plain = new FlexDocHostExecution(List.of("http://127.0.0.1:1"));

    assertEquals(403, plain.handle(null, Map.of()).status());
    assertTrue(metrics.isEmpty());
  }

  @Test
  void recorderAggregatesByOutcomeAndReason() {
    FlexDocHostExecutionObservation recorder = new FlexDocHostExecutionObservation();
    recorder.record(metric("flexdoc_execute_requests_total", "counter", 1d, Map.of()));
    recorder.record(metric("flexdoc_execute_in_flight", "gauge", 1d, Map.of()));
    recorder.record(metric("flexdoc_execute_in_flight", "gauge", 1d, Map.of()));
    recorder.record(metric("flexdoc_execute_in_flight", "gauge", -1d, Map.of()));
    recorder.record(metric("flexdoc_execute_completions_total", "counter", 1d, Map.of("outcome", "rejected")));
    recorder.record(metric("flexdoc_execute_rejections_total", "counter", 1d, Map.of("reason", "destination-forbidden")));
    recorder.record(metric("flexdoc_execute_errors_total", "counter", 1d, Map.of("reason", "upstream-timeout")));
    recorder.record(metric("flexdoc_execute_unmarked_total", "counter", 1d, Map.of("reason", "marker-missing")));
    recorder.record(metric("flexdoc_execute_errors_total", "counter", 1d, Map.of("reason", "not-a-reason")));

    Map<String, Object> snapshot = recorder.snapshot();
    assertEquals(1, snapshot.get("startedExecutions"));
    assertEquals(1, snapshot.get("completedExecutions"));
    assertEquals(1, outcomes(snapshot).get("rejected"));
    assertEquals(0, outcomes(snapshot).get("success"));
    assertEquals(1, snapshot.get("inFlight"));
    assertEquals(2, snapshot.get("peakInFlight"));
    assertEquals(1, counts(snapshot, "rejectionsByReason").get("destination-forbidden"));
    assertEquals(1, counts(snapshot, "errorsByReason").size(), "an unknown reason must not be tallied");
    assertEquals(1, snapshot.get("unmarkedRequests"));
    assertNull(snapshot.get("durations"), "no duration summary before the first completion duration");
    assertNotNull(snapshot.get("windowStart"));
  }

  @Test
  void recorderReportsExactPercentiles() {
    FlexDocHostExecutionObservation recorder = new FlexDocHostExecutionObservation();
    IntStream.rangeClosed(1, 100).forEach(index ->
        recorder.record(metric("flexdoc_execute_duration_seconds", "histogram", index / 1000d, Map.of())));

    Map<String, Object> durations = durations(recorder);
    assertEquals(100, durations.get("sampleCount"));
    assertEquals(Boolean.FALSE, durations.get("sampled"), "100 observations fit under the default capacity");
    assertEquals(1d, (double) durations.get("minMs"), 0.001);
    assertEquals(50d, (double) durations.get("p50Ms"), 0.001);
    assertEquals(95d, (double) durations.get("p95Ms"), 0.001);
    assertEquals(99d, (double) durations.get("p99Ms"), 0.001);
    assertEquals(100d, (double) durations.get("maxMs"), 0.001);
  }

  @Test
  void recorderBoundsMemoryBySampling() {
    FlexDocHostExecutionObservation recorder = new FlexDocHostExecutionObservation(16);
    IntStream.range(0, 500).forEach(index ->
        recorder.record(metric("flexdoc_execute_duration_seconds", "histogram", 0.05d, Map.of())));

    Map<String, Object> durations = durations(recorder);
    assertEquals(16, durations.get("sampleCount"), "capacity must bound retention");
    assertEquals(Boolean.TRUE, durations.get("sampled"), "sampling must be declared past capacity");
  }

  @Test
  void resetStartsANewWindow() {
    FlexDocHostExecutionObservation recorder = new FlexDocHostExecutionObservation();
    recorder.record(metric("flexdoc_execute_requests_total", "counter", 1d, Map.of()));
    recorder.reset();

    assertEquals(0, recorder.snapshot().get("startedExecutions"));
    assertNull(recorder.snapshot().get("windowStart"));
  }

  @Test
  void recorderSinkIsUsableDirectlyAsAnExecutorSink() {
    FlexDocHostExecutionObservation recorder = new FlexDocHostExecutionObservation();
    new FlexDocHostExecution(List.of("http://127.0.0.1:1"), recorder.sink()).handle(null, Map.of());

    assertEquals(1, recorder.snapshot().get("unmarkedRequests"));
  }

  // The export is handed to operators and may be written to disk, so it must carry no
  // request content: only counts, timestamps and known category names.
  @Test
  void reportCarriesNoRequestContent() {
    FlexDocHostExecutionObservation recorder = new FlexDocHostExecutionObservation();
    recorder.record(metric("flexdoc_execute_requests_total", "counter", 1d, Map.of()));
    recorder.record(metric("flexdoc_execute_rejections_total", "counter", 1d, Map.of(
        "reason", "destination-forbidden",
        "target", "https://secret.internal/pets?token=abc")));
    recorder.record(metric("flexdoc_execute_duration_seconds", "histogram", 0.25d, Map.of()));

    Map<String, Object> report = recorder.report();
    assertEquals("flexdoc.host-execution.observation/1", report.get("schema"));
    assertEquals("java", report.get("runtime"));
    assertEquals(List.of("browser-direct-transport-mix"), report.get("gaps"));

    String rendered = report.toString();
    for (String leaked : List.of("secret.internal", "token=abc", "/pets")) {
      assertFalse(rendered.contains(leaked), "report leaked request content: " + leaked);
    }
  }

  // JVM adapters serve concurrently, so the aggregate is reachable from many request
  // threads at once and every update has to survive that.
  @Test
  void recorderSurvivesConcurrentUpdates() throws InterruptedException {
    FlexDocHostExecutionObservation recorder = new FlexDocHostExecutionObservation();
    int threads = 8;
    int perThread = 250;
    CountDownLatch start = new CountDownLatch(1);
    CountDownLatch done = new CountDownLatch(threads);

    for (int thread = 0; thread < threads; thread++) {
      new Thread(() -> {
        try {
          start.await();
          for (int index = 0; index < perThread; index++) {
            recorder.record(metric("flexdoc_execute_requests_total", "counter", 1d, Map.of()));
            recorder.record(metric("flexdoc_execute_duration_seconds", "histogram", 0.01d, Map.of()));
          }
        } catch (InterruptedException interrupted) {
          Thread.currentThread().interrupt();
        } finally {
          done.countDown();
        }
      }).start();
    }

    start.countDown();
    assertTrue(done.await(30, java.util.concurrent.TimeUnit.SECONDS), "recording threads must finish");

    Map<String, Object> snapshot = recorder.snapshot();
    assertEquals(threads * perThread, snapshot.get("startedExecutions"), "no concurrent update may be lost");
    assertEquals(threads * perThread, durations(recorder).get("sampleCount"));
  }

  private static FlexDocHostExecutionMetric metric(String name, String kind, double value, Map<String, String> labels) {
    return new FlexDocHostExecutionMetric(name, kind, value, labels);
  }

  // Bind then release so the port is almost certainly refused rather than open.
  private static int closedPort() throws IOException {
    try (ServerSocket socket = new ServerSocket(0)) {
      return socket.getLocalPort();
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> durations(FlexDocHostExecutionObservation recorder) {
    Map<String, Object> durations = (Map<String, Object>) recorder.snapshot().get("durations");
    assertNotNull(durations, "durations must be summarized once observed");
    return durations;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Integer> outcomes(Map<String, Object> snapshot) {
    return (Map<String, Integer>) snapshot.get("outcomes");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Integer> counts(Map<String, Object> snapshot, String key) {
    return (Map<String, Integer>) snapshot.get(key);
  }

  private List<FlexDocHostExecutionMetric> named(String name) {
    return metrics.stream().filter(metric -> metric.name().equals(name)).toList();
  }

  private FlexDocHostExecutionMetric single(String name) {
    List<FlexDocHostExecutionMetric> matches = named(name);
    assertEquals(1, matches.size(), "expected exactly one " + name);
    return matches.get(0);
  }

  private double gaugeSum() {
    return named("flexdoc_execute_in_flight").stream().mapToDouble(FlexDocHostExecutionMetric::value).sum();
  }
}
