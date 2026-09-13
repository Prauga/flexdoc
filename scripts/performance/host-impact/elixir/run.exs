defmodule FlexDocHostImpact do
  @behaviour Plug
  import Plug.Conn

  def init(config), do: config

  def call(conn, config) do
    path = conn.request_path

    cond do
      path == "/health" -> json(conn, %{"ok" => true})
      path == "/target" -> json(conn, %{"ok" => true, "runtime" => "elixir-plug"})
      path == "/openapi.json" -> json(conn, openapi())
      config != nil and (path == "/docs" or String.starts_with?(path, "/docs/")) ->
        PraugaFlexDoc.Plug.call(conn, config)
      true -> send_resp(conn, 404, "Not Found")
    end
  end

  defp json(conn, payload) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(payload))
  end

  defp openapi do
    %{
      "openapi" => "3.0.3",
      "info" => %{"title" => "FlexDoc host-impact benchmark", "version" => "1.0.0"},
      "paths" => %{
        "/target" => %{
          "get" => %{"responses" => %{"200" => %{"description" => "ok"}}}
        }
      }
    }
  end
end

mode = System.get_env("FLEXDOC_BENCH_MODE", "baseline")
port = System.get_env("FLEXDOC_BENCH_PORT", "5810") |> String.to_integer()
origin = System.get_env("FLEXDOC_BENCH_ORIGIN", "http://127.0.0.1:#{port}")

config =
  if mode == "baseline" do
    nil
  else
    options = [
      path: "/docs",
      spec_url: "/openapi.json",
      title: "FlexDoc host-impact benchmark",
      try_it_default_server: origin
    ]

    options =
      if mode == "host" do
        options ++ [
          try_it_host_execution: true,
          host_execution: PraugaFlexDoc.HostExecution.new!([origin])
        ]
      else
        options
      end

    PraugaFlexDoc.Plug.init(options)
  end

{:ok, _pid} = Plug.Cowboy.http(FlexDocHostImpact, config,
  ip: {127, 0, 0, 1},
  port: port,
  protocol_options: [idle_timeout: 60_000]
)

Process.sleep(:infinity)
