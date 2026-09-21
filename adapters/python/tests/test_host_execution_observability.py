"""Execution-evidence tests for the Python host executor."""

import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from prauga_flexdoc import (
    HOST_EXECUTION_REASONS,
    FlexDocHostExecution,
    FlexDocHostExecutionObservation,
    create_host_execution_observation_report,
    is_host_execution_reason,
)


class ReasonTaxonomyTest(unittest.TestCase):
    def test_matches_the_node_vocabulary_exactly(self):
        # The fleet export is only readable if both runtimes name the same things.
        self.assertEqual(HOST_EXECUTION_REASONS, (
            "marker-missing",
            "execution-disabled",
            "admission-saturated",
            "destination-forbidden",
            "redirect-forbidden",
            "body-malformed",
            "body-too-large",
            "unsupported-media-type",
            "request-invalid",
            "auth-unsupported",
            "upstream-timeout",
            "upstream-unreachable",
            "upstream-error",
        ))

    def test_rejects_anything_outside_the_vocabulary(self):
        self.assertFalse(is_host_execution_reason("nope"))
        self.assertFalse(is_host_execution_reason(None))
        self.assertTrue(is_host_execution_reason("body-malformed"))


class ExecutorEvidenceTest(unittest.TestCase):
    def _executor(self):
        metrics = []
        executor = FlexDocHostExecution(["https://api.example.test"], metric_sink=metrics.append)
        return executor, metrics

    def _names(self, metrics):
        return [metric.name for metric in metrics]

    def _labels(self, metrics, name):
        return [dict(metric.labels) for metric in metrics if metric.name == name]

    def test_counts_an_unmarked_request_outside_the_lifecycle(self):
        executor, metrics = self._executor()

        result = executor.handle(None, {})

        self.assertEqual(result.status, 403)
        self.assertEqual(self._names(metrics), ["flexdoc_execute_unmarked_total"])
        self.assertEqual(self._labels(metrics, "flexdoc_execute_unmarked_total"), [{"reason": "marker-missing"}])

    def test_reports_a_malformed_envelope_as_a_rejection_with_its_reason(self):
        executor, metrics = self._executor()

        result = executor.handle("1", None)

        self.assertEqual(result.status, 400)
        self.assertIn("flexdoc_execute_requests_total", self._names(metrics))
        self.assertEqual(self._labels(metrics, "flexdoc_execute_completions_total"), [{"outcome": "rejected"}])
        self.assertEqual(
            self._labels(metrics, "flexdoc_execute_rejections_total"),
            [{"source": "route", "statusCode": "400", "reason": "body-malformed"}],
        )

    def test_reports_a_disallowed_origin_as_a_forbidden_destination(self):
        executor, metrics = self._executor()

        result = executor.handle("1", {"request": {"method": "GET", "url": "https://elsewhere.test/pets"}})

        self.assertEqual(result.status, 403)
        self.assertEqual(
            self._labels(metrics, "flexdoc_execute_rejections_total"),
            [{"source": "route", "statusCode": "403", "reason": "destination-forbidden"}],
        )

    def test_separates_an_unreachable_target_from_a_rejection(self):
        metrics = []
        # Port 9 is the discard port: allowed by policy, nothing listening.
        executor = FlexDocHostExecution(["http://127.0.0.1:9"], metric_sink=metrics.append)

        result = executor.handle("1", {"request": {"method": "GET", "url": "http://127.0.0.1:9/pets"}})

        self.assertEqual(result.status, 502)
        self.assertEqual(self._labels(metrics, "flexdoc_execute_completions_total"), [{"outcome": "error"}])
        self.assertEqual(self._labels(metrics, "flexdoc_execute_rejections_total"), [])
        self.assertEqual(
            [labels["reason"] for labels in self._labels(metrics, "flexdoc_execute_errors_total")],
            ["upstream-unreachable"],
        )

    def test_returns_the_in_flight_gauge_to_zero_on_every_path(self):
        executor, metrics = self._executor()
        executor.handle("1", None)
        executor.handle("1", {"request": {"method": "GET", "url": "https://elsewhere.test/pets"}})

        gauge = sum(metric.value for metric in metrics if metric.name == "flexdoc_execute_in_flight")

        self.assertEqual(gauge, 0)

    def test_a_failing_sink_never_fails_an_execution(self):
        def explode(_metric):
            raise RuntimeError("sink is broken")

        executor = FlexDocHostExecution(["https://api.example.test"], metric_sink=explode)

        self.assertEqual(executor.handle("1", None).status, 400)

    def test_emits_nothing_when_no_sink_is_configured(self):
        executor = FlexDocHostExecution(["https://api.example.test"])

        self.assertEqual(executor.handle("1", None).status, 400)


class ObservationRecorderTest(unittest.TestCase):
    def _recorder(self):
        clock = [1_700_000_000.0]

        def now():
            clock[0] += 1
            return clock[0]

        return FlexDocHostExecutionObservation(now=now), clock

    def _run(self, observation, executor_metrics):
        for metric in executor_metrics:
            observation.record(metric)

    def test_aggregates_a_mixed_window_by_outcome_and_reason(self):
        observation, _ = self._recorder()
        metrics = []
        executor = FlexDocHostExecution(["https://api.example.test"], metric_sink=metrics.append)
        executor.handle(None, {})
        executor.handle("1", None)
        executor.handle("1", {"request": {"method": "GET", "url": "https://elsewhere.test/pets"}})
        self._run(observation, metrics)

        snapshot = observation.snapshot()

        self.assertEqual(snapshot["startedExecutions"], 2)
        self.assertEqual(snapshot["unmarkedRequests"], 1)
        self.assertEqual(snapshot["completedExecutions"], 2)
        self.assertEqual(snapshot["outcomes"], {"success": 0, "rejected": 2, "error": 0})
        self.assertEqual(snapshot["rejectionsByReason"], {"body-malformed": 1, "destination-forbidden": 1})
        self.assertEqual(snapshot["inFlight"], 0)
        self.assertEqual(snapshot["peakInFlight"], 1)

    def test_reports_exact_percentiles_below_the_sampling_capacity(self):
        observation = FlexDocHostExecutionObservation()
        from prauga_flexdoc import FlexDocHostExecutionMetric

        for value in [0.010, 0.020, 0.030, 0.040]:
            observation.record(FlexDocHostExecutionMetric("flexdoc_execute_duration_seconds", "histogram", value, {"outcome": "success"}))

        durations = observation.snapshot()["durations"]

        self.assertEqual(durations["sampleCount"], 4)
        self.assertFalse(durations["sampled"])
        self.assertEqual(durations["minMs"], 10)
        self.assertEqual(durations["p50Ms"], 20)
        self.assertEqual(durations["maxMs"], 40)

    def test_bounds_memory_by_sampling_and_says_so(self):
        from prauga_flexdoc import FlexDocHostExecutionMetric

        observation = FlexDocHostExecutionObservation(duration_sample_capacity=3, random=lambda: 0.99)
        for value in [0.001, 0.002, 0.003, 0.004, 0.005]:
            observation.record(FlexDocHostExecutionMetric("flexdoc_execute_duration_seconds", "histogram", value, {"outcome": "success"}))

        durations = observation.snapshot()["durations"]

        self.assertEqual(durations["sampleCount"], 3)
        self.assertTrue(durations["sampled"])

    def test_has_no_duration_summary_before_the_first_completion(self):
        self.assertIsNone(FlexDocHostExecutionObservation().snapshot()["durations"])

    def test_reset_starts_a_new_window(self):
        observation, _ = self._recorder()
        metrics = []
        executor = FlexDocHostExecution(["https://api.example.test"], metric_sink=metrics.append)
        executor.handle("1", None)
        self._run(observation, metrics)

        observation.reset()
        snapshot = observation.snapshot()

        self.assertIsNone(snapshot["windowStart"])
        self.assertEqual(snapshot["startedExecutions"], 0)
        self.assertEqual(snapshot["rejectionsByReason"], {})

    def test_ignores_a_reason_outside_the_vocabulary(self):
        from prauga_flexdoc import FlexDocHostExecutionMetric

        observation = FlexDocHostExecutionObservation()
        observation.record(FlexDocHostExecutionMetric("flexdoc_execute_errors_total", "counter", 1, {"reason": "made-up"}))

        self.assertEqual(observation.snapshot()["errorsByReason"], {})


class ObservationReportTest(unittest.TestCase):
    def test_shares_the_node_export_schema_and_declares_the_same_gap(self):
        report = create_host_execution_observation_report(FlexDocHostExecutionObservation())

        self.assertEqual(report["schema"], "flexdoc.host-execution.observation/1")
        self.assertEqual(report["runtime"], "python")
        self.assertEqual(report["gaps"], ["browser-direct-transport-mix"])

    def test_carries_only_counts_timestamps_and_known_category_names(self):
        metrics = []
        executor = FlexDocHostExecution(["https://api.example.test"], metric_sink=metrics.append)
        executor.handle("1", {"request": {"method": "POST", "url": "https://secret.test/login", "headers": [{"name": "Authorization", "value": "Bearer topsecret"}]}})
        observation = FlexDocHostExecutionObservation()
        for metric in metrics:
            observation.record(metric)

        document = json.dumps(create_host_execution_observation_report(observation))

        for leaked in ["secret.test", "topsecret", "Authorization", "POST", "login"]:
            self.assertNotIn(leaked, document)

    def test_is_json_serializable(self):
        report = create_host_execution_observation_report(FlexDocHostExecutionObservation())

        self.assertEqual(json.loads(json.dumps(report))["schema"], report["schema"])


if __name__ == "__main__":
    unittest.main()
