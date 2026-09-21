<?php

declare(strict_types=1);

namespace Prauga\FlexDoc;

/**
 * Execution evidence for the PHP host executor.
 *
 * This mirrors the Node, Python, Go, Rust and Ruby contract deliberately: the
 * same reason vocabulary, the same metric names and labels, and the same export
 * schema. An operator running a mixed fleet should read one document shape
 * regardless of which runtime served the execute route, and a collector written
 * for one runtime should not need a second parser for another.
 */
final class HostExecutionObservability
{
    /**
     * Stable low-cardinality categories for a non-successful execution.
     *
     * Rejection messages interpolate request values such as origins, field names
     * and methods, so they are unbounded and cannot be used as a metric label.
     * These can.
     *
     * @var list<string>
     */
    public const REASONS = [
        'marker-missing',
        'execution-disabled',
        'admission-saturated',
        'destination-forbidden',
        'redirect-forbidden',
        'body-malformed',
        'body-too-large',
        'unsupported-media-type',
        'request-invalid',
        'auth-unsupported',
        'upstream-timeout',
        'upstream-unreachable',
        'upstream-error',
    ];

    public const SCHEMA = 'flexdoc.host-execution.observation/1';

    /** Evidence an API host cannot observe by itself, declared rather than omitted. */
    public const GAPS = ['browser-direct-transport-mix'];

    /** @var list<string> */
    public const OUTCOMES = ['success', 'rejected', 'error'];

    public static function isReason(mixed $value): bool
    {
        return is_string($value) && in_array($value, self::REASONS, true);
    }
}

/**
 * One dependency-free metric update that can be bridged to Prometheus or
 * OpenTelemetry without FlexDoc owning a registry.
 */
final class HostExecutionMetric
{
    /**
     * @param 'counter'|'gauge'|'histogram' $kind
     * @param array<string, string> $labels
     */
    public function __construct(
        public readonly string $name,
        public readonly string $kind,
        public readonly float $value,
        public readonly array $labels = [],
    ) {
    }
}

/**
 * Aggregates host-execution evidence for one window, free of request content.
 *
 * Only counters and durations are retained. No URL, header, body, credential or
 * per-request timestamp reaches this recorder, so the aggregate cannot carry
 * request content by construction.
 *
 * Durations are retained up to the sample capacity and then replaced by
 * reservoir sampling, so memory stays bounded for a worker that serves many
 * requests while percentiles stay representative of the whole window rather than
 * only its opening. Counts stay exact regardless.
 *
 * PHP's request lifecycle means one recorder observes one process. Under
 * php-fpm that is a single worker, so treat an export as per-worker evidence
 * unless the application persists and merges snapshots itself.
 */
final class HostExecutionObservation
{
    private ?float $windowStart = null;
    private ?float $windowEnd = null;
    private int $started = 0;
    private int $unmarked = 0;
    private int $completed = 0;
    private int $inFlight = 0;
    private int $peakInFlight = 0;
    private int $observedDurations = 0;

    /** @var array<string, int> */
    private array $outcomes = [];

    /** @var array<string, int> */
    private array $rejections = [];

    /** @var array<string, int> */
    private array $errors = [];

    /** @var list<float> */
    private array $durations = [];

    private int $capacity;

    /** @var callable(): float */
    private $clock;

    public function __construct(int $durationSampleCapacity = 8192, ?callable $clock = null)
    {
        $this->capacity = max(1, $durationSampleCapacity);
        $this->clock = $clock ?? static fn (): float => microtime(true);
        $this->reset();
    }

    /** Discard all counts and start a new window. */
    public function reset(): void
    {
        $this->windowStart = null;
        $this->windowEnd = null;
        $this->started = 0;
        $this->unmarked = 0;
        $this->completed = 0;
        $this->inFlight = 0;
        $this->peakInFlight = 0;
        $this->observedDurations = 0;
        $this->outcomes = array_fill_keys(HostExecutionObservability::OUTCOMES, 0);
        $this->rejections = [];
        $this->errors = [];
        $this->durations = [];
    }

    /** Fold one metric update into the aggregate. */
    public function record(HostExecutionMetric $metric): void
    {
        $timestamp = ($this->clock)();
        $this->windowStart ??= $timestamp;
        $this->windowEnd = $timestamp;

        switch ($metric->name) {
            case 'flexdoc_execute_requests_total':
                $this->started++;
                break;
            case 'flexdoc_execute_in_flight':
                $this->inFlight = max(0, $this->inFlight + (int) $metric->value);
                $this->peakInFlight = max($this->peakInFlight, $this->inFlight);
                break;
            case 'flexdoc_execute_completions_total':
                $this->completed++;
                $outcome = $metric->labels['outcome'] ?? null;
                if ($outcome !== null && array_key_exists($outcome, $this->outcomes)) {
                    $this->outcomes[$outcome]++;
                }
                break;
            case 'flexdoc_execute_rejections_total':
                $this->tally($this->rejections, $metric->labels['reason'] ?? null);
                break;
            case 'flexdoc_execute_unmarked_total':
                // Deliberately not folded into rejections: those describe validated
                // envelopes, and merging the two would double-count attempts.
                $this->unmarked++;
                break;
            case 'flexdoc_execute_errors_total':
                $this->tally($this->errors, $metric->labels['reason'] ?? null);
                break;
            case 'flexdoc_execute_duration_seconds':
                $this->recordDuration($metric->value);
                break;
        }
    }

    /** A callable usable directly as the executor's metric sink. */
    public function sink(): callable
    {
        return [$this, 'record'];
    }

    /**
     * Current aggregate; safe to call at any time.
     *
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        $ordered = $this->durations;
        sort($ordered);

        return [
            'windowStart' => self::formatInstant($this->windowStart),
            'windowEnd' => self::formatInstant($this->windowEnd),
            'startedExecutions' => $this->started,
            'unmarkedRequests' => $this->unmarked,
            'completedExecutions' => $this->completed,
            'outcomes' => $this->outcomes,
            'inFlight' => $this->inFlight,
            'peakInFlight' => $this->peakInFlight,
            'rejectionsByReason' => $this->rejections,
            'errorsByReason' => $this->errors,
            'durations' => $ordered === [] ? null : [
                'sampleCount' => count($ordered),
                'sampled' => $this->observedDurations > count($ordered),
                'minMs' => $ordered[0],
                'p50Ms' => self::percentile($ordered, 0.5),
                'p95Ms' => self::percentile($ordered, 0.95),
                'p99Ms' => self::percentile($ordered, 0.99),
                'maxMs' => $ordered[count($ordered) - 1],
            ],
        ];
    }

    /**
     * Build the operator export document for this observation.
     *
     * The document is aggregate-only and is meant to be written to disk or handed
     * to an operator; FlexDoc never transmits it. Browser-direct executions never
     * reach an API host, so the transport mix cannot be derived here, and that gap
     * is declared so a review cannot mistake this document for complete evidence.
     *
     * @return array<string, mixed>
     */
    public function report(?string $generatedAt = null): array
    {
        return [
            'schema' => HostExecutionObservability::SCHEMA,
            'generatedAt' => $generatedAt ?? self::formatInstant(microtime(true)),
            'runtime' => 'php',
            'observation' => $this->snapshot(),
            'gaps' => HostExecutionObservability::GAPS,
        ];
    }

    /** @param array<string, int> $counts */
    private function tally(array &$counts, mixed $reason): void
    {
        if (!HostExecutionObservability::isReason($reason)) return;
        $counts[$reason] = ($counts[$reason] ?? 0) + 1;
    }

    private function recordDuration(float $seconds): void
    {
        $milliseconds = max(0.0, $seconds * 1000);
        $this->observedDurations++;
        if (count($this->durations) < $this->capacity) {
            $this->durations[] = $milliseconds;
            return;
        }
        $candidate = (int) (mt_rand() / mt_getrandmax() * $this->observedDurations);
        if ($candidate < $this->capacity) {
            $this->durations[$candidate] = $milliseconds;
        }
    }

    /** @param list<float> $ordered */
    private static function percentile(array $ordered, float $fraction): float
    {
        if (count($ordered) === 1) return $ordered[0];
        $rank = (int) ceil($fraction * count($ordered));
        return $ordered[max(1, min($rank, count($ordered))) - 1];
    }

    private static function formatInstant(?float $epochSeconds): ?string
    {
        if ($epochSeconds === null) return null;
        $milliseconds = (int) round(($epochSeconds - floor($epochSeconds)) * 1000);
        return gmdate('Y-m-d\TH:i:s', (int) floor($epochSeconds)) . sprintf('.%03dZ', min($milliseconds, 999));
    }
}
