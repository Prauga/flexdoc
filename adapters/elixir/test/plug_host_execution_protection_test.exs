defmodule PraugaFlexDoc.PlugHostExecutionProtectionTest do
  use ExUnit.Case, async: true

  alias PraugaFlexDoc.HostExecution
  alias PraugaFlexDoc.Plug, as: FlexDocPlug

  test "enabled host execution requires explicit protection acknowledgement" do
    execution = HostExecution.new!(["https://api.example.test"])

    assert_raise ArgumentError,
                 "FlexDoc Plug host execution requires host_execution_protected: true after configuring application auth/middleware; the origin allowlist is not authentication.",
                 fn ->
                   FlexDocPlug.init(
                     try_it_host_execution: true,
                     host_execution: execution
                   )
                 end
  end

  test "enabled host execution accepts explicit protection acknowledgement" do
    execution = HostExecution.new!(["https://api.example.test"])

    config =
      FlexDocPlug.init(
        try_it_host_execution: true,
        host_execution_protected: true,
        host_execution: execution
      )

    assert config.host_execution_protected == true
  end

  test "enabled but unavailable host execution does not require protection acknowledgement" do
    config = FlexDocPlug.init(try_it_host_execution: true)
    assert config.try_it_host_execution == true
    assert config.host_execution == nil
    assert config.host_execution_protected == false
  end
end
