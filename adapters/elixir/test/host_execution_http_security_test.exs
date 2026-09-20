defmodule PraugaFlexDoc.HostExecutionHttpSecurityTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias PraugaFlexDoc.HostExecution
  alias PraugaFlexDoc.Plug, as: FlexDocPlug

  defp opts(origins) do
    execution = HostExecution.new!(origins)

    FlexDocPlug.init(
      path: "/docs",
      try_it_host_execution: true,
      host_execution_protected: true,
      host_execution: execution
    )
  end

  defp post_json(opts, request, marker \\ "1") do
    conn(:post, "/docs/__flexdoc/execute", Jason.encode!(%{"request" => request}))
    |> put_req_header("content-type", "application/json")
    |> maybe_marker(marker)
    |> FlexDocPlug.call(opts)
  end

  defp maybe_marker(conn, nil), do: conn
  defp maybe_marker(conn, marker), do: put_req_header(conn, "x-flexdoc-execute", marker)

  defp json_error(conn), do: Jason.decode!(conn.resp_body)["error"]

  defp start_redirect_server(test_pid) do
    server =
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
        send(test_pid, {:redirect_server, self(), port})
        {:ok, socket} = :gen_tcp.accept(listener)
        _ = :gen_tcp.recv(socket, 0, 2_000)

        :ok =
          :gen_tcp.send(
            socket,
            "HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/latest/meta-data/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
          )

        :gen_tcp.close(socket)
        :gen_tcp.close(listener)
      end)

    assert_receive {:redirect_server, ^server, port}, 1_000
    "http://127.0.0.1:#{port}"
  end

  test "requires protocol marker before parsing the request body" do
    opts = opts(["https://api.example.test"])

    response =
      conn(:post, "/docs/__flexdoc/execute", "not-json")
      |> put_req_header("content-type", "application/json")
      |> FlexDocPlug.call(opts)

    assert response.status == 403
    assert get_resp_header(response, "cache-control") == ["no-store"]
    assert json_error(response) == "Missing X-FlexDoc-Execute header."
  end

  test "rejects targets outside the exact origin allowlist" do
    response =
      post_json(
        opts(["https://api.example.test"]),
        %{"method" => "GET", "url" => "https://other.example.test/private"}
      )

    assert response.status == 403
    assert json_error(response) =~ "not allowed"
  end

  test "rejects metadata target even when its origin is explicitly allowlisted" do
    response =
      post_json(
        opts(["http://169.254.169.254"]),
        %{"method" => "GET", "url" => "http://169.254.169.254/latest/meta-data/"}
      )

    assert response.status == 403
    assert json_error(response) =~ "metadata"
  end

  test "rejects cross-origin redirect before following metadata target" do
    origin = start_redirect_server(self())

    response =
      post_json(
        opts([origin]),
        %{"method" => "GET", "url" => origin <> "/redirect"}
      )

    assert response.status == 403
    assert json_error(response) =~ "cross-origin"
  end

  test "enforces request size, method, and media type at Plug boundary" do
    opts = opts(["https://api.example.test"])

    oversized = :binary.copy("x", HostExecution.max_request_bytes() + 1)

    size_response =
      conn(:post, "/docs/__flexdoc/execute", oversized)
      |> put_req_header("content-type", "application/json")
      |> put_req_header("x-flexdoc-execute", "1")
      |> FlexDocPlug.call(opts)

    assert size_response.status == 400
    assert json_error(size_response) =~ "32 MiB safety limit"

    method_response = conn(:get, "/docs/__flexdoc/execute") |> FlexDocPlug.call(opts)
    assert method_response.status == 404

    media_response =
      conn(:post, "/docs/__flexdoc/execute", "{}")
      |> put_req_header("content-type", "text/plain")
      |> put_req_header("x-flexdoc-execute", "1")
      |> FlexDocPlug.call(opts)

    assert media_response.status == 400
    assert json_error(media_response) =~ "application/json or multipart/form-data"
  end
end
