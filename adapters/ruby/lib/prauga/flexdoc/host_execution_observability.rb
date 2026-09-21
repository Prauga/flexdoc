# frozen_string_literal: true

require "time"

module Prauga
  module FlexDoc
    # Execution evidence for the Ruby host executor.
    #
    # This mirrors the Node, Python, Go and Rust contract deliberately: the same
    # reason vocabulary, the same metric names and labels, and the same export
    # schema. An operator running a mixed fleet should read one document shape
    # regardless of which runtime served the execute route, and a collector
    # written for one runtime should not need a second parser for another.
    module HostExecutionObservability
      # Stable low-cardinality categories for a non-successful execution.
      #
      # Rejection messages interpolate request values such as origins, field
      # names and methods, so they are unbounded and cannot be used as a metric
      # label. These can.
      HOST_EXECUTION_REASONS = %w[
        marker-missing
        execution-disabled
        admission-saturated
        destination-forbidden
        redirect-forbidden
        body-malformed
        body-too-large
        unsupported-media-type
        request-invalid
        auth-unsupported
        upstream-timeout
        upstream-unreachable
        upstream-error
      ].freeze

      OBSERVATION_SCHEMA = "flexdoc.host-execution.observation/1"

      # Evidence an API host cannot observe by itself, declared rather than omitted.
      OBSERVATION_GAPS = %w[browser-direct-transport-mix].freeze

      OUTCOMES = %w[success rejected error].freeze

      def self.host_execution_reason?(value)
        HOST_EXECUTION_REASONS.include?(value)
      end
    end

    # One dependency-free metric update that can be bridged to Prometheus or
    # OpenTelemetry without FlexDoc owning a registry.
    HostExecutionMetric = Data.define(:name, :kind, :value, :labels) do
      def initialize(name:, kind:, value:, labels: {})
        super
      end
    end

    # Aggregates host-execution evidence for one window, free of request content.
    #
    # Only counters and durations are retained. No URL, header, body, credential
    # or per-request timestamp reaches this recorder, so the aggregate cannot
    # carry request content by construction.
    #
    # Durations are retained up to +duration_sample_capacity+ and then replaced by
    # reservoir sampling, so memory stays bounded for a host that runs
    # indefinitely while percentiles stay representative of the whole window
    # rather than only its opening. Counts stay exact regardless.
    class HostExecutionObservation
      def initialize(duration_sample_capacity: 8192, clock: -> { Time.now }, random: -> { Kernel.rand })
        @capacity = [duration_sample_capacity.to_i, 1].max
        @clock = clock
        @random = random
        @mutex = Mutex.new
        reset
      end

      # Discard all counts and start a new window.
      def reset
        @mutex.synchronize { clear_state }
        nil
      end

      # Fold one metric update into the aggregate. Safe to pass as a metric sink
      # from concurrent request handlers.
      def record(metric)
        @mutex.synchronize do
          timestamp = @clock.call
          @window_start ||= timestamp
          @window_end = timestamp

          case metric.name
          when "flexdoc_execute_requests_total"
            @started += 1
          when "flexdoc_execute_in_flight"
            @in_flight = [@in_flight + metric.value.to_i, 0].max
            @peak_in_flight = [@peak_in_flight, @in_flight].max
          when "flexdoc_execute_completions_total"
            @completed += 1
            outcome = metric.labels["outcome"] || metric.labels[:outcome]
            @outcomes[outcome] += 1 if @outcomes.key?(outcome)
          when "flexdoc_execute_rejections_total"
            tally(@rejections, metric.labels["reason"] || metric.labels[:reason])
          when "flexdoc_execute_unmarked_total"
            # Deliberately not folded into rejections: those describe validated
            # envelopes, and merging the two would double-count attempts.
            @unmarked += 1
          when "flexdoc_execute_errors_total"
            tally(@errors, metric.labels["reason"] || metric.labels[:reason])
          when "flexdoc_execute_duration_seconds"
            record_duration(metric.value.to_f)
          end
        end
        nil
      end

      # A callable sink usable directly as the executor's +metric_sink+.
      def sink
        method(:record)
      end

      # Current aggregate; safe to call at any time.
      def snapshot
        @mutex.synchronize do
          ordered = @durations.sort
          {
            "windowStart" => @window_start&.utc&.iso8601(3),
            "windowEnd" => @window_end&.utc&.iso8601(3),
            "startedExecutions" => @started,
            "unmarkedRequests" => @unmarked,
            "completedExecutions" => @completed,
            "outcomes" => @outcomes.dup,
            "inFlight" => @in_flight,
            "peakInFlight" => @peak_in_flight,
            "rejectionsByReason" => @rejections.dup,
            "errorsByReason" => @errors.dup,
            "durations" => duration_summary(ordered)
          }
        end
      end

      private

      def clear_state
        @window_start = nil
        @window_end = nil
        @started = 0
        @unmarked = 0
        @completed = 0
        @in_flight = 0
        @peak_in_flight = 0
        @observed_durations = 0
        @outcomes = HostExecutionObservability::OUTCOMES.to_h { |outcome| [outcome, 0] }
        @rejections = {}
        @errors = {}
        @durations = []
      end

      def tally(counts, reason)
        return unless HostExecutionObservability.host_execution_reason?(reason)

        counts[reason] = counts.fetch(reason, 0) + 1
      end

      def record_duration(seconds)
        milliseconds = [seconds * 1000, 0.0].max
        @observed_durations += 1
        if @durations.length < @capacity
          @durations << milliseconds
          return
        end
        candidate = (@random.call * @observed_durations).to_i
        @durations[candidate] = milliseconds if candidate < @capacity
      end

      def duration_summary(ordered)
        return nil if ordered.empty?

        {
          "sampleCount" => ordered.length,
          "sampled" => @observed_durations > ordered.length,
          "minMs" => ordered.first,
          "p50Ms" => percentile(ordered, 0.5),
          "p95Ms" => percentile(ordered, 0.95),
          "p99Ms" => percentile(ordered, 0.99),
          "maxMs" => ordered.last
        }
      end

      def percentile(ordered, fraction)
        return ordered.first if ordered.length == 1

        rank = (fraction * ordered.length).ceil.clamp(1, ordered.length)
        ordered[rank - 1]
      end
    end

    # Build the operator export document for a host-execution observation.
    #
    # The document is aggregate-only and is meant to be written to disk or handed
    # to an operator; FlexDoc never transmits it. Browser-direct executions never
    # reach an API host, so the transport mix cannot be derived here, and that gap
    # is declared so a review cannot mistake this document for complete evidence.
    def self.host_execution_observation_report(observation, generated_at: nil)
      {
        "schema" => HostExecutionObservability::OBSERVATION_SCHEMA,
        "generatedAt" => generated_at || Time.now.utc.iso8601(3),
        "runtime" => "ruby",
        "observation" => observation.snapshot,
        "gaps" => HostExecutionObservability::OBSERVATION_GAPS.dup
      }
    end
  end
end
