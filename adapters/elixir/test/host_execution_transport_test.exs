defmodule PraugaFlexDoc.HostExecutionTransportTest do
  use ExUnit.Case, async: false

  alias PraugaFlexDoc.HostExecution

  defp start_capture_server(test_pid) do
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
        send(test_pid, {:transport_server, self(), port})
        {:ok, socket} = :gen_tcp.accept(listener)
        {:ok, request} = read_request(socket)
        send(test_pid, {:captured_transport_request, request})
        :gen_tcp.send(socket, "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
        :gen_tcp.close(socket)
        :gen_tcp.close(listener)
      end)

    assert_receive {:transport_server, ^server, port}, 1_000
    "http://127.0.0.1:#{port}"
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

      length =
        case Integer.parse(Map.get(headers, "content-length", "0")) do
          {value, ""} -> value
          _ -> 0
        end

      {:ok, body} = recv_body(socket, rest, length)
      {:ok, %{method: method, target: target, headers: headers, body: body}}
    end
  end

  defp recv_headers(socket, accumulated) do
    case :binary.match(accumulated, "\r\n\r\n") do
      {index, 4} ->
        offset = index + 4
        {:ok, binary_part(accumulated, 0, index), binary_part(accumulated, offset, byte_size(accumulated) - offset)}

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

  test "native transport sends canonical GET bodies" do
    origin = start_capture_server(self())
    execution = HostExecution.new!([origin])

    result =
      HostExecution.handle(execution, "1", %{
        "request" => %{
          "method" => "GET",
          "url" => origin <> "/with-body",
          "bodyMode" => "raw",
          "body" => "hello",
          "contentType" => "text/plain"
        }
      })

    assert result.status == 200
    assert result.body["body"] == "ok"
    assert_receive {:captured_transport_request, request}, 1_000
    assert request.method == "GET"
    assert request.target == "/with-body"
    assert request.body == "hello"
    assert request.headers["content-type"] == "text/plain"
  end

  test "empty structured body fields do not suppress a JSON body" do
    origin = start_capture_server(self())
    execution = HostExecution.new!([origin])

    result =
      HostExecution.handle(execution, "1", %{
        "request" => %{
          "method" => "POST",
          "url" => origin <> "/json",
          "contentType" => "application/json",
          "body" => "{\"ok\":true}",
          "binary" => %{},
          "formData" => [],
          "urlencoded" => [],
          "graphql" => %{}
        }
      })

    assert result.status == 200
    assert_receive {:captured_transport_request, request}, 1_000
    assert request.body == "{\"ok\":true}"
    assert request.headers["content-type"] == "application/json"
  end

  test "rejects CRLF bearer values before transport" do
    execution = HostExecution.new!(["https://api.example.test"])

    result =
      HostExecution.handle(execution, "1", %{
        "request" => %{
          "method" => "GET",
          "url" => "https://api.example.test/resource",
          "auth" => %{"type" => "bearer", "token" => "safe\r\nX-Evil: yes"}
        }
      })

    assert result.status == 400
    assert result.body["error"] =~ "Authorization"
  end
end
