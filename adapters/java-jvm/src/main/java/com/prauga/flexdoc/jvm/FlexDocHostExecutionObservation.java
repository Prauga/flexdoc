package com.prauga.flexdoc.jvm;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Consumer;

/**
 * Aggregates host-execution evidence for one window.
 *
 * <p>Only counters and durations are retained. No URL, header, body, credential or
 * per-request timestamp reaches this recorder, so the aggregate cannot carry request
 * content by construction.</p>
 *
 * <p>Durations are retained up to the sample capacity and then replaced by reservoir
 * sampling, so memory stays bounded for a host that runs indefinitely while
 * percentiles stay representative of the whole window rather than only its opening.
 * Counts stay exact regardless.</p>
 *
 * <p>JVM adapters serve concurrently, so every method is synchronized: the aggregate
 * is reachable from many request threads at once and no update may be lost.</p>
 */
public final class FlexDocHostExecutionObservation {
  private static final int DEFAULT_DURATION_SAMPLE_CAPACITY = 8192;
  private static final List<String> OUTCOMES = List.of("success", "rejected", "error");

  private final int durationSampleCapacity;
  private final List<Double> durations = new ArrayList<>();
  private final Map<String, Integer> outcomes = new LinkedHashMap<>();
  private final Map<String, Integer> rejections = new LinkedHashMap<>();
  private final Map<String, Integer> errors = new LinkedHashMap<>();
  private Instant windowStart;
  private Instant windowEnd;
  private int started;
  private int unmarked;
  private int completed;
  private int inFlight;
  private int peakInFlight;
  private long observedDurations;

  /** Creates a recorder with the default 8192-sample duration capacity. */
  public FlexDocHostExecutionObservation() {
    this(DEFAULT_DURATION_SAMPLE_CAPACITY);
  }

  /**
   * Creates a recorder retaining at most the given number of durations before uniform
   * sampling begins.
   *
   * @param durationSampleCapacity retained duration count; values below one are raised to one
   */
  public FlexDocHostExecutionObservation(int durationSampleCapacity) {
    this.durationSampleCapacity = Math.max(1, durationSampleCapacity);
    reset();
  }

  /**
   * A sink that folds updates into this recorder, usable directly as the executor's
   * metric sink from concurrent request threads.
   *
   * @return the metric sink
   */
  public Consumer<FlexDocHostExecutionMetric> sink() { return this::record; }

  /** Discards all counts and starts a new window. */
  public synchronized void reset() {
    windowStart = null;
    windowEnd = null;
    started = 0;
    unmarked = 0;
    completed = 0;
    inFlight = 0;
    peakInFlight = 0;
    observedDurations = 0L;
    durations.clear();
    outcomes.clear();
    for (String outcome : OUTCOMES) outcomes.put(outcome, 0);
    rejections.clear();
    errors.clear();
  }

  /**
   * Folds one metric update into the aggregate.
   *
   * @param metric update emitted by the executor
   */
  public synchronized void record(FlexDocHostExecutionMetric metric) {
    if (metric == null) return;

    Instant now = Instant.now();
    if (windowStart == null) windowStart = now;
    windowEnd = now;

    switch (metric.name()) {
      case "flexdoc_execute_requests_total" -> started++;
      case "flexdoc_execute_in_flight" -> {
        inFlight = Math.max(0, inFlight + (int) metric.value());
        peakInFlight = Math.max(peakInFlight, inFlight);
      }
      case "flexdoc_execute_completions_total" -> {
        completed++;
        String outcome = metric.labels().get("outcome");
        if (outcome != null && outcomes.containsKey(outcome)) outcomes.merge(outcome, 1, Integer::sum);
      }
      case "flexdoc_execute_rejections_total" -> tally(rejections, metric.labels().get("reason"));
      // Deliberately not folded into rejections: those describe validated envelopes,
      // and merging the two would double-count attempts.
      case "flexdoc_execute_unmarked_total" -> unmarked++;
      case "flexdoc_execute_errors_total" -> tally(errors, metric.labels().get("reason"));
      case "flexdoc_execute_duration_seconds" -> recordDuration(metric.value());
      default -> { /* An unknown metric name is ignored rather than guessed at. */ }
    }
  }

  /**
   * Returns the current aggregate; safe to call at any time.
   *
   * @return a JSON-serializable snapshot of the window
   */
  public synchronized Map<String, Object> snapshot() {
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("windowStart", format(windowStart));
    snapshot.put("windowEnd", format(windowEnd));
    snapshot.put("startedExecutions", started);
    snapshot.put("unmarkedRequests", unmarked);
    snapshot.put("completedExecutions", completed);
    snapshot.put("outcomes", new LinkedHashMap<>(outcomes));
    snapshot.put("inFlight", inFlight);
    snapshot.put("peakInFlight", peakInFlight);
    snapshot.put("rejectionsByReason", new LinkedHashMap<>(rejections));
    snapshot.put("errorsByReason", new LinkedHashMap<>(errors));
    snapshot.put("durations", durations.isEmpty() ? null : durationSummary());
    return snapshot;
  }

  /**
   * Builds the operator export document.
   *
   * <p>The document is aggregate-only and is meant to be written to disk or handed to
   * an operator; FlexDoc never transmits it. Browser-direct executions never reach an
   * API host, so the transport mix cannot be derived here, and that gap is declared so
   * a review cannot mistake this document for complete evidence.</p>
   *
   * @return a JSON-serializable export document
   */
  public Map<String, Object> report() {
    Map<String, Object> report = new LinkedHashMap<>();
    report.put("schema", FlexDocHostExecutionReason.OBSERVATION_SCHEMA);
    report.put("generatedAt", format(Instant.now()));
    report.put("runtime", "java");
    report.put("observation", snapshot());
    report.put("gaps", FlexDocHostExecutionReason.OBSERVATION_GAPS);
    return report;
  }

  private Map<String, Object> durationSummary() {
    double[] ordered = durations.stream().mapToDouble(Double::doubleValue).toArray();
    Arrays.sort(ordered);

    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("sampleCount", ordered.length);
    summary.put("sampled", observedDurations > ordered.length);
    summary.put("minMs", ordered[0]);
    summary.put("p50Ms", percentile(ordered, 0.5));
    summary.put("p95Ms", percentile(ordered, 0.95));
    summary.put("p99Ms", percentile(ordered, 0.99));
    summary.put("maxMs", ordered[ordered.length - 1]);
    return summary;
  }

  private void recordDuration(double seconds) {
    double milliseconds = Math.max(0d, seconds * 1000d);
    observedDurations++;
    if (durations.size() < durationSampleCapacity) {
      durations.add(milliseconds);
      return;
    }
    int candidate = (int) (ThreadLocalRandom.current().nextDouble() * observedDurations);
    if (candidate < durationSampleCapacity) durations.set(candidate, milliseconds);
  }

  private static void tally(Map<String, Integer> counts, String reason) {
    // An unknown reason is dropped rather than tallied: the whole point of the
    // vocabulary is that these keys stay low-cardinality and comparable.
    FlexDocHostExecutionReason.fromWireValue(reason)
        .ifPresent(known -> counts.merge(known.wireValue(), 1, Integer::sum));
  }

  private static String format(Instant instant) {
    return instant == null ? null : DateTimeFormatter.ISO_INSTANT.format(instant);
  }

  private static double percentile(double[] sorted, double fraction) {
    if (sorted.length == 1) return sorted[0];
    int rank = (int) Math.ceil(fraction * sorted.length);
    return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
  }
}
