# frozen_string_literal: true

require "minitest/autorun"
require_relative "../lib/prauga/flexdoc"

class FlexDocRackHostExecutionProtectionTest < Minitest::Test
  def enabled_host
    executor = Prauga::FlexDoc::HostExecution.new(allowed_origins: ["https://api.example.test"])
    Prauga::FlexDoc::Host.new(
      Prauga::FlexDoc::Config.new(try_it_host_execution: true),
      host_execution: executor
    )
  end

  def test_enabled_host_execution_requires_explicit_protection_acknowledgement
    error = assert_raises(ArgumentError) do
      Prauga::FlexDoc::RackApp.new(enabled_host)
    end

    assert_equal(
      "FlexDoc Rack host execution requires host_execution_protected: true after configuring application auth/middleware; the origin allowlist is not authentication.",
      error.message
    )
  end

  def test_enabled_host_execution_accepts_explicit_protection_acknowledgement
    app = Prauga::FlexDoc::RackApp.new(enabled_host, host_execution_protected: true)
    assert_instance_of Prauga::FlexDoc::RackApp, app
  end

  def test_disabled_host_execution_does_not_require_protection_acknowledgement
    host = Prauga::FlexDoc::Host.new(Prauga::FlexDoc::Config.new(try_it_host_execution: true))
    app = Prauga::FlexDoc::RackApp.new(host)
    assert_instance_of Prauga::FlexDoc::RackApp, app
  end
end
