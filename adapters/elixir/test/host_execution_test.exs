defmodule PraugaFlexDoc.HostExecutionTest do
  use ExUnit.Case, async: false
  use Plug.Test

  import Plug.Conn, only: [get_resp_header: 2, put_req_header: 3]

  alias PraugaFlexDoc.{HostExecution, Plug => FlexDocPlug}

  @max_response_bytes 10 * 1024 * 1024

  defp canonical_envelope(method, target) do
    %{"request" => %{"method" => method, "url" => target}}
  end

  defp execution_error(%{body: %{"error" => error}}), do: error

  defp renderer_options(body) do
    [_, json] = Regex.run(~r/window\.__FLEXDOC_OPTIONS__=(.*?);<\/script>/, body)
    Jason.decode!(json)
  end

  defp start_server(handler) do
    parent = self()

    pid =
      spawn(fn ->
        {:ok, listener} =
          :gen_tcp.listen(0, [
            :binary,
            packet: :raw,
            active: false,
            reuseaddr: true,
            ip: {127, 0, 0, 1}
          ])

        {:ok, {{127, 0, 0, 1}, port}} = :inet.sockname(listener)
        send(parent, {:flexdoc_test_server, self(), port})
        accept_loop(listener, handler)
      end)

    assert_receive {:flexdoc_test_server, ^pid, port}, 1_000

    on_exit(fn ->
      if Process.alive?(pid), do: Process.exit(pid, :kill)
    end)

    "http://127.0.0.1:#{port}"
  end

  defp accept_loop(listener, handler) do
    case :gen_tcp.accept(listener) do
      {:ok, socket} ->
        serve(socket, handler)
        accept_loop(listener, handler)

      {:error, _reason} ->
        :ok
    end
  end

  defp serve(socket, handler) do
    case read_request(socket) do
      {:ok, request} ->
        case handler.(request) do
          {:response, status, headers, body} ->
            send_response(socket, status, headers, body)

          {:delayed_body, status, headers, delay_ms, body} ->
            body = IO.iodata_to_binary(body)
            send_response_head(socket, status, headers, byte_size(body))
            Process.sleep(delay_ms)
            :gen_tcp.send(socket, body)
        end

      _ ->
        :ok
    end
  after
    :gen_tcp.close(socket)
  end

  defp read_request(socket) do
    with {:ok, header_blob, rest} <- recv_headers(socket, <<>>),
         [request_line | header_lines] <- String.split(header_blob, "\r\n"),
         [method, target, _version] <- String.split(request_line, " ", parts: 3) do
      headers =
        Enum.reduce(header_lines, %{}, fn line, acc ->
          case String.split(line, ":", parts: 2) do
            [name, value] -> Map.put(acc, String.downcase(String.trim(name)), String.trim(value))
            _ -> acc
          end
        end)

      content_length =
        case Integer.parse(Map.get(headers, "content-length", "0")) do
          {value, ""} -> value
          _ -> 0
        end

      case recv_body(socket, rest, content_length) do
        {:ok, body} -> {:ok, %{method: method, target: target, headers: headers, body: body}}
        error -> error
      end
    else
      _ -> {:error, :invalid_request}
    end
  end

  defp recv_headers(socket, accumulated) do
    case :binary.match(accumulated, "\r\n\r\n") do
      {index, 4} ->
        header_blob = binary_part(accumulated, 0, index)
        offset = index + 4
        rest = binary_part(accumulated, offset, byte_size(accumulated) - offset)
        {:ok, header_blob, rest}

      :nomatch ->
        case :gen_tcp.recv(socket, 0, 2_000) do
          {:ok, data} -> recv_headers(socket, accumulated <> data)
          error -> error
        end
    end
  end

  defp recv_body(_socket, accumulated, length) when byte_size(accumulated) >= length do
    {:ok, binary_part(accumulated, 0, length)}
  end

  defp recv_body(socket, accumulated, length) do
    case :gen_tcp.recv(socket, length - byte_size(accumulated), 2_000) do
      {:ok, data} -> recv_body(socket, accumulated <> data, length)
      error -> error
    end
  end

  defp send_response(socket, status, headers, body) do
    body = IO.iodata_to_binary(body)
    send_response_head(socket, status, headers, byte_size(body))
    :gen_tcp.send(socket, body)
  end

  defp send_response_head(socket, status, headers, content_length) do
    headers =
      [{"Content-Length", Integer.to_string(content_length)}, {"Connection", "close"} | headers]
      |> Enum.map(fn {name, value} -> [name, ": ", value, "\r\n"] end)

    :gen_tcp.send(socket, ["HTTP/1.1 ", Integer.to_string(status), " ", status_text(status), "\r\n", headers, "\r\n"])
  end

  defp status_text(200), do: "OK"
  defp status_text(302), do: "Found"
  defp status_text(303), do: "See Other"
  defp status_text(404), do: "Not Found"
  defp status_text(_), do: "Status"

  test "requires a non-empty exact HTTP(S) origin allowlist" do
    for origins <- [
          [],
          [""],
          ["https://api.example.test/path"],
          ["https://user@example.test"],
          ["https://api.example.test?x=1"]
        ] do
      assert_raise ArgumentError, fn -> HostExecution.new!(origins) end
    end
  end

  test "Plug truthfully advertises and owns execute only with a real executor" do
    origin = start_server(fn _request -> {:response, 200, [{"Content-Type", "text/plain"}], "ok"} end)
    executor = HostExecution.new!([origin])

    opts =
      FlexDocPlug.init(
        path: "/docs",
        spec_url: "/openapi.json",
        try_it_host_execution: true,
        host_execution: executor
      )

    docs = conn(:get, "/docs") |> FlexDocPlug.call(opts)
    host = renderer_options(docs.resp_body)["tryIt"]["hostExecution"]

    assert host == %{
             "available" => true,
             "endpoint" => "/docs/__flexdoc/execute",
             "capabilities" => []
           }

    refute docs.resp_body =~ origin

    payload = canonical_envelope("GET", origin) |> Jason.encode!()

    response =
      conn(:post, "/docs/__flexdoc/execute", payload)
      |> put_req_header("content-type", "application/json")
      |> put_req_header("x-flexdoc-execute", "1")
      |> FlexDocPlug.call(opts)

    assert response.status == 200
    assert get_resp_header(response, "cache-control") == ["no-store"]
    assert Jason.decode!(response.resp_body)["body"] == "ok"

    missing_marker =
      conn(:post, "/docs/__flexdoc/execute", "not-json")
      |> put_req_header("content-type", "application/json")
      |> FlexDocPlug.call(opts)

    assert missing_marker.status == 403
    assert Jason.decode!(missing_marker.resp_body)["error"] =~ "X-FlexDoc-Execute"
  end

  test "returns canonical errors for malformed URLs and unsupported native auth" do
    executor = HostExecution.new!(["https://api.example.test"])

    malformed = HostExecution.handle(executor, "1", canonical_envelope("GET", "not an absolute URL"))
    assert malformed.status == 400
    assert execution_error(malformed) =~ "absolute HTTP(S)"

    digest = canonical_envelope("GET", "https://api.example.test")
    put_in(digest, ["request", "auth"], %{"type" => "digest", "username" => "a", "password" => "b"})
    |> then(fn envelope ->
      result = HostExecution.handle(executor, "1", envelope)
      assert result.status == 400
      assert execution_error(result) =~ "not implemented"
    end)
  end

  test "preserves encoded URLs and strips unsafe headers" do
    test_pid = self()

    origin =
      start_server(fn request ->
        send(test_pid, {:captured_request, request})
        {:response, 200, [], "ok"}
      end)

    envelope = canonical_envelope("GET", origin <> "/encoded%2Fpart?existing=a%2Fb")

    envelope =
      envelope
      |> put_in(["request", "query"], [%{"key" => "next", "value" => "c d"}])
      |> put_in(["request", "headers"], [
        %{"key" => "Origin", "value" => "https://attacker.example"},
        %{"key" => "X-Test", "value" => "kept"},
        %{"key" => "Content-Type", "value" => "application/custom"}
      ])

    result = HostExecution.handle(HostExecution.new!([origin]), "1", envelope)
    assert result.status == 200

    assert_receive {:captured_request, request}, 1_000
    assert request.target =~ "/encoded%2Fpart"
    assert request.target =~ "existing=a%2Fb"
    assert request.target =~ "next=c+d"
    refute request.target =~ "%252F"
    refute Map.has_key?(request.headers, "origin")
    assert request.headers["x-test"] == "kept"
    assert request.headers["content-type"] == "application/custom"
  end

  test "reapplies query API keys on same-origin redirects and rejects cross-origin redirects" do
    test_pid = self()

    origin =
      start_server(fn request ->
        uri = URI.parse(request.target)
        send(test_pid, {:redirect_request, uri.path, uri.query || ""})

        case uri.path do
          "/start" -> {:response, 302, [{"Location", "/finish"}], ""}
          "/finish" -> {:response, 200, [], "done"}
          _ -> {:response, 404, [], "missing"}
        end
      end)

    envelope = canonical_envelope("GET", origin <> "/start")

    envelope =
      put_in(envelope, ["request", "auth"], %{
        "type" => "apiKey",
        "in" => "query",
        "key" => "token",
        "value" => "secret"
      })

    result = HostExecution.handle(HostExecution.new!([origin]), "1", envelope)
    assert result.status == 200
    assert_receive {:redirect_request, "/start", "token=secret"}, 1_000
    assert_receive {:redirect_request, "/finish", "token=secret"}, 1_000

    second =
      start_server(fn _request ->
        send(test_pid, :cross_origin_target_called)
        {:response, 200, [], "should-not-run"}
      end)

    first = start_server(fn _request -> {:response, 302, [{"Location", second <> "/next"}], ""} end)
    cross = HostExecution.handle(HostExecution.new!([first, second]), "1", canonical_envelope("GET", first))

    assert cross.status == 403
    assert execution_error(cross) =~ "cross-origin"
    refute_receive :cross_origin_target_called, 100
  end

  test "blocks metadata destinations before connection" do
    executor = HostExecution.new!(["http://169.254.169.254"])
    result = HostExecution.handle(executor, "1", canonical_envelope("GET", "http://169.254.169.254/latest/meta-data"))

    assert result.status == 403
    assert execution_error(result) =~ "metadata"
  end

  test "supports canonical incoming and outgoing multipart envelopes" do
    test_pid = self()

    origin =
      start_server(fn request ->
        send(test_pid, {:multipart_target, request})
        {:response, 200, [], "uploaded"}
      end)

    executor = HostExecution.new!([origin])

    opts =
      FlexDocPlug.init(
        path: "/docs",
        try_it_host_execution: true,
        host_execution: executor
      )

    descriptor =
      Jason.encode!(%{
        "request" => %{
          "method" => "POST",
          "url" => origin,
          "bodyMode" => "formdata",
          "formData" => [
            %{"key" => "note", "type" => "text", "value" => "hello"},
            %{"key" => "upload", "type" => "file", "fileName" => "payload.txt"}
          ]
        }
      })

    boundary = "flexdoc-elixir-test"

    body =
      IO.iodata_to_binary([
        "--#{boundary}\r\n",
        "Content-Disposition: form-data; name=\"descriptor\"\r\n",
        "Content-Type: application/json\r\n\r\n",
        descriptor,
        "\r\n--#{boundary}\r\n",
        "Content-Disposition: form-data; name=\"formData[1]\"; filename=\"payload.txt\"\r\n",
        "Content-Type: text/plain\r\n\r\n",
        "file-body",
        "\r\n--#{boundary}--\r\n"
      ])

    response =
      conn(:post, "/docs/__flexdoc/execute", body)
      |> put_req_header("content-type", "multipart/form-data; boundary=#{boundary}")
      |> put_req_header("x-flexdoc-execute", "1")
      |> FlexDocPlug.call(opts)

    assert response.status == 200
    assert Jason.decode!(response.resp_body)["body"] == "uploaded"

    assert_receive {:multipart_target, request}, 1_000
    assert request.headers["content-type"] =~ "multipart/form-data; boundary="
    assert request.body =~ "name=\"note\""
    assert request.body =~ "hello"
    assert request.body =~ "name=\"upload\""
    assert request.body =~ "filename=\"payload.txt\""
    assert request.body =~ "file-body"
  end

  test "enforces full-request deadline and returned response-size bound" do
    slow =
      start_server(fn _request ->
        {:delayed_body, 200, [{"Content-Type", "text/plain"}], 250, "late"}
      end)

    slow_envelope = Map.put(canonical_envelope("GET", slow), "timeoutMs", 100)
    timeout = HostExecution.handle(HostExecution.new!([slow]), "1", slow_envelope)

    assert timeout.status == 502
    assert execution_error(timeout) =~ "timed out"

    large =
      start_server(fn _request ->
        {:response, 200, [], :binary.copy("x", @max_response_bytes + 1)}
      end)

    oversized = HostExecution.handle(HostExecution.new!([large]), "1", canonical_envelope("GET", large))
    assert oversized.status == 502
    assert execution_error(oversized) =~ "10 MiB"
  end
end
