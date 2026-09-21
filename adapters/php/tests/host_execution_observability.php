<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use Prauga\FlexDoc\HostExecution;
use Prauga\FlexDoc\HostExecutionMetric;
use Prauga\FlexDoc\HostExecutionObservability;
use Prauga\FlexDoc\HostExecutionObservation;

function evidenceCheck(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

/**
 * @param list<HostExecutionMetric> $collected
 */
function findMetric(array $collected, string $name): ?HostExecutionMetric {
    foreach ($collected as $metric) {
        if ($metric->name === $name) return $metric;
    }
    return null;
}

/** @return array{0: HostExecution, 1: object} */
function collectingExecutor(array $origins = ['https://api.example.test']): array {
    $collector = new class {
        /** @var list<HostExecutionMetric> */
        public array $metrics = [];

        public function __invoke(HostExecutionMetric $metric): void {
            $this->metrics[] = $metric;
        }

        /** @return list<string> */
        public function names(): array {
            return array_map(static fn (HostExecutionMetric $metric): string => $metric->name, $this->metrics);
        }
    };
    return [new HostExecution($origins, $collector), $collector];
}

function metric(string $name, string $kind, float $value, array $labels = []): HostExecutionMetric {
    return new HostExecutionMetric($name, $kind, $value, $labels);
}

// The reason vocabulary is a cross-runtime contract, not a PHP detail: a collector
// written against the Node, Python, Go, Rust or Ruby host must read these labels
// unchanged.
evidenceCheck(HostExecutionObservability::REASONS === [
    'marker-missing', 'execution-disabled', 'admission-saturated', 'destination-forbidden',
    'redirect-forbidden', 'body-malformed', 'body-too-large', 'unsupported-media-type',
    'request-invalid', 'auth-unsupported', 'upstream-timeout', 'upstream-unreachable',
    'upstream-error',
], 'reason vocabulary matches the other runtimes');
evidenceCheck(HostExecutionObservability::isReason('upstream-timeout'), 'known reason accepted');
evidenceCheck(!HostExecutionObservability::isReason('slow'), 'unknown reason rejected');

// An unmarked request never became an execution, so it must move no lifecycle metric.
[$executor, $collector] = collectingExecutor();
$executor->handle(null, []);
evidenceCheck(count($collector->metrics) === 1, 'unmarked request emits exactly one metric, got ' . implode(',', $collector->names()));
evidenceCheck($collector->metrics[0]->name === 'flexdoc_execute_unmarked_total', 'unmarked counter emitted');
evidenceCheck($collector->metrics[0]->labels['reason'] === 'marker-missing', 'unmarked reason');

// A policy rejection is a rejection, categorized, and never an upstream error.
[$executor, $collector] = collectingExecutor();
$result = $executor->handle('1', ['request' => ['url' => 'https://blocked.example.test/pets', 'method' => 'GET']]);
evidenceCheck($result['status'] === 403, 'blocked origin is rejected');
$rejection = findMetric($collector->metrics, 'flexdoc_execute_rejections_total');
evidenceCheck($rejection !== null, 'rejection counter emitted, got ' . implode(',', $collector->names()));
evidenceCheck($rejection->labels['reason'] === 'destination-forbidden', 'rejection reason');
evidenceCheck($rejection->labels['statusCode'] === '403', 'rejection status label');
evidenceCheck($rejection->labels['source'] === 'route', 'rejection source label');
evidenceCheck(findMetric($collector->metrics, 'flexdoc_execute_errors_total') === null, 'a policy rejection is not an upstream error');

// A malformed envelope must be separable from a policy rejection.
[$executor, $collector] = collectingExecutor();
$executor->handle('1', 'not an object');
$rejection = findMetric($collector->metrics, 'flexdoc_execute_rejections_total');
evidenceCheck($rejection->labels['reason'] === 'body-malformed', 'malformed envelope reason');

// An unreachable target is an upstream failure, and the gauge must still balance.
$probe = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
$address = stream_socket_get_name($probe, false);
fclose($probe);
[$executor, $collector] = collectingExecutor(["http://{$address}"]);
$result = $executor->handle('1', ['request' => ['url' => "http://{$address}/pets", 'method' => 'GET']]);
evidenceCheck($result['status'] === 502, 'refused connection is an upstream failure');
$failure = findMetric($collector->metrics, 'flexdoc_execute_errors_total');
evidenceCheck($failure !== null, 'error counter emitted, got ' . implode(',', $collector->names()));
evidenceCheck($failure->labels['reason'] === 'upstream-unreachable', 'upstream failure reason');
evidenceCheck(findMetric($collector->metrics, 'flexdoc_execute_rejections_total') === null, 'an upstream failure is not a rejection');
$gauge = 0.0;
foreach ($collector->metrics as $entry) {
    if ($entry->name === 'flexdoc_execute_in_flight') $gauge += $entry->value;
}
evidenceCheck($gauge === 0.0, 'in-flight gauge balances back to zero');

// Observability must never decide whether an execution succeeds.
$throwing = new HostExecution(['https://api.example.test'], static function (HostExecutionMetric $metric): void {
    throw new RuntimeException('collector down');
});
$result = $throwing->handle('1', ['request' => ['url' => 'https://blocked.example.test/pets', 'method' => 'GET']]);
evidenceCheck($result['status'] === 403, 'a throwing sink cannot fail an execution');

// An executor without a sink must behave exactly as it did before evidence existed.
$plain = new HostExecution(['https://api.example.test']);
evidenceCheck($plain->handle(null, [])['status'] === 403, 'no sink, no behaviour change');

// Recorder aggregation by outcome and reason.
$observation = new HostExecutionObservation();
$observation->record(metric('flexdoc_execute_requests_total', 'counter', 1));
$observation->record(metric('flexdoc_execute_in_flight', 'gauge', 1));
$observation->record(metric('flexdoc_execute_in_flight', 'gauge', 1));
$observation->record(metric('flexdoc_execute_in_flight', 'gauge', -1));
$observation->record(metric('flexdoc_execute_completions_total', 'counter', 1, ['outcome' => 'rejected']));
$observation->record(metric('flexdoc_execute_rejections_total', 'counter', 1, ['reason' => 'destination-forbidden']));
$observation->record(metric('flexdoc_execute_errors_total', 'counter', 1, ['reason' => 'upstream-timeout']));
$observation->record(metric('flexdoc_execute_unmarked_total', 'counter', 1, ['reason' => 'marker-missing']));
$observation->record(metric('flexdoc_execute_errors_total', 'counter', 1, ['reason' => 'not-a-reason']));

$snapshot = $observation->snapshot();
evidenceCheck($snapshot['startedExecutions'] === 1, 'started count');
evidenceCheck($snapshot['completedExecutions'] === 1, 'completed count');
evidenceCheck($snapshot['outcomes']['rejected'] === 1 && $snapshot['outcomes']['success'] === 0, 'outcome split');
evidenceCheck($snapshot['inFlight'] === 1 && $snapshot['peakInFlight'] === 2, 'peak concurrency retained');
evidenceCheck($snapshot['rejectionsByReason']['destination-forbidden'] === 1, 'rejection tally');
evidenceCheck(count($snapshot['errorsByReason']) === 1, 'an unknown reason is not tallied');
evidenceCheck($snapshot['unmarkedRequests'] === 1, 'unmarked stays separate from rejections');
evidenceCheck($snapshot['durations'] === null, 'no duration summary before the first completion duration');

// Percentiles are exact while observations fit under the capacity.
$observation = new HostExecutionObservation();
for ($index = 1; $index <= 100; $index++) {
    $observation->record(metric('flexdoc_execute_duration_seconds', 'histogram', $index / 1000, ['outcome' => 'success']));
}
$durations = $observation->snapshot()['durations'];
evidenceCheck($durations['sampled'] === false, '100 observations fit under the capacity');
evidenceCheck($durations['sampleCount'] === 100, 'sample count');
evidenceCheck(abs($durations['minMs'] - 1.0) < 0.001, 'min');
evidenceCheck(abs($durations['p50Ms'] - 50.0) < 0.001, 'p50');
evidenceCheck(abs($durations['p95Ms'] - 95.0) < 0.001, 'p95');
evidenceCheck(abs($durations['p99Ms'] - 99.0) < 0.001, 'p99');
evidenceCheck(abs($durations['maxMs'] - 100.0) < 0.001, 'max');

// Memory stays bounded once observations exceed the capacity.
$observation = new HostExecutionObservation(16);
for ($index = 0; $index < 500; $index++) {
    $observation->record(metric('flexdoc_execute_duration_seconds', 'histogram', 0.05));
}
$durations = $observation->snapshot()['durations'];
evidenceCheck($durations['sampleCount'] === 16, 'capacity bounds retention');
evidenceCheck($durations['sampled'] === true, 'sampling is declared past capacity');

// Reset starts a new window.
$observation = new HostExecutionObservation();
$observation->record(metric('flexdoc_execute_requests_total', 'counter', 1));
$observation->reset();
$snapshot = $observation->snapshot();
evidenceCheck($snapshot['startedExecutions'] === 0 && $snapshot['windowStart'] === null, 'reset clears the window');

// The recorder is usable directly as an executor sink.
$observation = new HostExecutionObservation();
$wired = new HostExecution(['https://api.example.test'], $observation->sink());
$wired->handle(null, []);
evidenceCheck($observation->snapshot()['unmarkedRequests'] === 1, 'recorder sink folds executor metrics');

// The export is handed to operators and may be written to disk, so it must carry
// no request content: only counts, timestamps and known category names.
$observation = new HostExecutionObservation();
$observation->record(metric('flexdoc_execute_requests_total', 'counter', 1));
$observation->record(metric('flexdoc_execute_rejections_total', 'counter', 1, [
    'reason' => 'destination-forbidden',
    'target' => 'https://secret.internal/pets?token=abc',
]));
$observation->record(metric('flexdoc_execute_duration_seconds', 'histogram', 0.25));

$report = $observation->report();
evidenceCheck($report['schema'] === 'flexdoc.host-execution.observation/1', 'shared schema');
evidenceCheck($report['runtime'] === 'php', 'runtime identifies itself');
evidenceCheck($report['gaps'] === ['browser-direct-transport-mix'], 'declared transport-mix gap');
$encoded = json_encode($report, JSON_THROW_ON_ERROR);
foreach (['secret.internal', 'token=abc', '/pets'] as $leaked) {
    evidenceCheck(!str_contains($encoded, $leaked), "report leaked request content {$leaked}");
}

echo "php host-execution observability checks passed\n";
