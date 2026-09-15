defmodule PraugaFlexDoc.HostExecutionSecurityTest do
  use ExUnit.Case, async: true

  alias PraugaFlexDoc.HostExecution

  defp envelope(target, request_overrides \\ %{}) do
    %{
      "request" =>
        Map.merge(
          %{"method" => "GET", "url" => target},
          request_overrides
        )
    }
  end

  test "rejects unsafe API-key header names before transport" do
    execution = HostExecution.new!(["https://api.example.test"])

    result =
      HostExecution.handle(
        execution,
        "1",
        envelope("https://api.example.test/resource", %{
          "auth" => %{"type" => "apiKey", "in" => "header", "key" => "Host", "value" => "evil.example"}
        })
      )

    assert result.status == 400
    assert result.body["error"] =~ "header"
  end

  test "rejects CRLF in API-key header values before transport" do
    execution = HostExecution.new!(["https://api.example.test"])

    result =
      HostExecution.handle(
        execution,
        "1",
        envelope("https://api.example.test/resource", %{
          "auth" => %{"type" => "apiKey", "in" => "header", "key" => "X-Api-Key", "value" => "secret\r\nX-Evil: yes"}
        })
      )

    assert result.status == 400
    assert result.body["error"] =~ "header"
  end

  test "blocks IPv4-mapped IPv6 metadata destinations" do
    target = "http://[::ffff:169.254.169.254]/latest/meta-data"
    execution = HostExecution.new!(["http://[::ffff:169.254.169.254]"])

    result = HostExecution.handle(execution, "1", envelope(target))

    assert result.status == 403
    assert result.body["error"] =~ "metadata"
  end

  test "rejects CRLF in multipart file content types before transport" do
    execution = HostExecution.new!(["https://api.example.test"])

    request = %{
      "method" => "POST",
      "url" => "https://api.example.test/upload",
      "bodyMode" => "formdata",
      "formData" => [
        %{"key" => "upload", "type" => "file", "enabled" => true, "fileName" => "payload.txt"}
      ]
    }

    files = %{
      0 => %{
        filename: "payload.txt",
        content_type: "text/plain\r\nX-Evil: yes",
        data: "payload"
      }
    }

    result = HostExecution.handle(execution, "1", %{"request" => request}, files)

    assert result.status == 400
    assert result.body["error"] =~ "content type"
  end
end
