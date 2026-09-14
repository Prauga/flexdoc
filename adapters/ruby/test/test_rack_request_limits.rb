# frozen_string_literal: true

require "json"
require "minitest/autorun"
require "rack/mock"
require_relative "../lib/prauga/flexdoc"

class FlexDocRackRequestLimitsTest < Minitest::Test
  class RecordingInput
    attr_reader :read_sizes

    def initialize(payload = "")
      @payload = payload
      @read_sizes = []
    end

    def read(size = nil)
      @read_sizes << size
      raise "rack.input was read without an explicit bound" if size.nil?

      @payload.byteslice(0, size)
    end
  end

  def app
    executor = Prauga::FlexDoc::HostExecution.new(allowed_origins: ["https://api.example.test"])
    host = Prauga::FlexDoc::Host.new(
      Prauga::FlexDoc::Config.new(try_it_host_execution: true),
      host_execution: executor
    )
    Prauga::FlexDoc::RackApp.new(host)
  end

  def execute_env(input:, content_type:, content_length: nil)
    env = Rack::MockRequest.env_for(
      "/docs/__flexdoc/execute",
      method: "POST",
      "CONTENT_TYPE" => content_type,
      "HTTP_X_FLEXDOC_EXECUTE" => "1",
      input: ""
    )
    env["rack.input"] = input
    if content_length
      env["CONTENT_LENGTH"] = content_length.to_s
    else
      env.delete("CONTENT_LENGTH")
    end
    env
  end

  def test_oversized_declared_body_is_rejected_before_rack_input_is_read
    input = RecordingInput.new
    status, = app.call(execute_env(
      input:,
      content_type: "multipart/form-data; boundary=flexdoc-test",
      content_length: Prauga::FlexDoc::HostExecution::MAX_EXECUTION_REQUEST_BYTES + 1
    ))

    assert_equal 400, status
    assert_empty input.read_sizes
  end

  def test_unknown_length_multipart_is_read_with_explicit_sentinel_bound
    input = RecordingInput.new("not-a-valid-multipart-body")
    status, = app.call(execute_env(
      input:,
      content_type: "multipart/form-data; boundary=flexdoc-test"
    ))

    assert_equal 400, status
    assert_equal [Prauga::FlexDoc::HostExecution::MAX_EXECUTION_REQUEST_BYTES + 1], input.read_sizes
  end
end
