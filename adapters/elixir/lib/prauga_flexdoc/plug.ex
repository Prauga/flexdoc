defmodule PraugaFlexDoc.Plug do
  @moduledoc """
  A self-contained Plug serving FlexDoc and its version-matched renderer assets.

  ## Example

      plug PraugaFlexDoc.Plug,
        path: "/docs",
        spec_url: "/openapi.json",
        title: "My API"

  See `PraugaFlexDoc.Config` for the full list of supported options.
  """
  @behaviour Plug
  import Plug.Conn

  alias PraugaFlexDoc.{Config, HostExecution}

  @assets Path.expand("../../assets", __DIR__)
  @javascript File.read!(Path.join(@assets, "flexdoc.standalone.js"))
  @css File.read!(Path.join(@assets, "flexdoc.standalone.css"))
  @fingerprint :crypto.hash(:sha256, @javascript <> <<0>> <> @css) |> binary_part(0, 8) |> Base.encode16(case: :lower)

  @impl Plug
  @doc """
  Initializes the plug from FlexDoc keyword options.

  Returns a validated `PraugaFlexDoc.Config` used by `call/2`.
  """
  def init(opts), do: Config.new(opts)

  @impl Plug
  @doc """
  Serves the documentation shell, renderer assets, and optional native execute route.

  Requests outside the configured FlexDoc subtree receive a `404` response. The
  returned connection is sent/complete for all matched and unmatched paths.
  """
  def call(conn, %Config{} = config) do
    execute_path = config.path <> "/__flexdoc/execute"

    cond do
      conn.request_path == execute_path and conn.method == "POST" and execution_available?(config) -> execute(conn, config)
      conn.request_path == execute_path -> send_resp(conn, 404, "Not Found")
      conn.request_path == config.path or conn.request_path == config.path <> "/" -> docs(conn, config)
      conn.request_path == config.path <> "/__flexdoc/renderer.js" -> asset(conn, @javascript, "application/javascript; charset=utf-8")
      conn.request_path == config.path <> "/__flexdoc/renderer.css" -> asset(conn, @css, "text/css; charset=utf-8")
      true -> send_resp(conn, 404, "Not Found")
    end
  end

  defp execute(conn, config) do
    with {:ok, raw, conn} <- read_execution_body(conn, <<>>),
         {:ok, envelope, files} <- decode_execution_envelope(raw, get_req_header(conn, "content-type") |> List.first()) do
      marker = get_req_header(conn, "x-flexdoc-execute") |> List.first()
      result = HostExecution.handle(config.host_execution, marker, envelope, files)
      execution_json(conn, result.status, result.body)
    else
      {:error, message, conn} -> execution_json(conn, 400, %{"error" => message})
      {:error, message} -> execution_json(conn, 400, %{"error" => message})
    end
  end

  defp read_execution_body(conn, accumulated) do
    remaining = HostExecution.max_request_bytes() + 1 - byte_size(accumulated)

    if remaining <= 0 do
      {:error, "Host execution request exceeded the 32 MiB safety limit.", conn}
    else
      case read_body(conn, length: remaining, read_length: min(1_048_576, remaining), read_timeout: 15_000) do
        {:ok, data, conn} ->
          body = accumulated <> data
          if byte_size(body) > HostExecution.max_request_bytes(), do: {:error, "Host execution request exceeded the 32 MiB safety limit.", conn}, else: {:ok, body, conn}

        {:more, data, conn} ->
          body = accumulated <> data
          if byte_size(body) > HostExecution.max_request_bytes(), do: {:error, "Host execution request exceeded the 32 MiB safety limit.", conn}, else: read_execution_body(conn, body)

        {:error, _reason} -> {:error, "Unable to read host execution request body.", conn}
      end
    end
  end

  defp decode_execution_envelope(raw, content_type) when is_binary(content_type) do
    media_type = content_type |> String.split(";", parts: 2) |> hd() |> String.trim() |> String.downcase()

    case media_type do
      "application/json" ->
        case Jason.decode(raw) do
          {:ok, value} when is_map(value) -> {:ok, value, %{}}
          _ -> {:error, "Host execution body must be valid UTF-8 JSON object."}
        end

      "multipart/form-data" -> parse_multipart_envelope(raw, content_type)
      _ -> {:error, "Host execution requires application/json or multipart/form-data."}
    end
  end

  defp decode_execution_envelope(_raw, _content_type), do: {:error, "Host execution requires application/json or multipart/form-data."}

  defp parse_multipart_envelope(raw, content_type) do
    with {:ok, boundary} <- multipart_boundary(content_type),
         {:ok, descriptor, files} <- multipart_parts(raw, boundary),
         {:ok, envelope} <- decode_descriptor(descriptor) do
      {:ok, envelope, files}
    end
  end

  defp multipart_boundary(content_type) do
    case Regex.run(~r/boundary=(?:"([^"]+)"|([^;]+))/i, content_type) do
      [_, quoted, unquoted] ->
        boundary = if quoted != "", do: quoted, else: String.trim(unquoted)
        if boundary == "", do: {:error, "Host execution multipart body is invalid."}, else: {:ok, boundary}

      [_, quoted] when quoted != "" -> {:ok, quoted}
      _ -> {:error, "Host execution multipart body is invalid."}
    end
  end

  defp multipart_parts(raw, boundary) do
    delimiter = "--" <> boundary

    parts =
      raw
      |> :binary.split(delimiter, [:global])
      |> Enum.drop(1)

    Enum.reduce_while(parts, {:ok, nil, %{}}, fn segment, {:ok, descriptor, files} ->
      segment = trim_prefix(segment, "\r\n")

      cond do
        segment == <<>> -> {:cont, {:ok, descriptor, files}}
        String.starts_with?(segment, "--") -> {:halt, finish_multipart(descriptor, files)}
        true ->
          segment = trim_suffix(segment, "\r\n")

          case :binary.split(segment, "\r\n\r\n", [:global]) do
            [header_blob, data] -> parse_multipart_part(header_blob, data, descriptor, files)
            [header_blob | rest] when rest != [] -> parse_multipart_part(header_blob, Enum.join(rest, "\r\n\r\n"), descriptor, files)
            _ -> {:halt, {:error, "Host execution multipart body is invalid."}}
          end
      end
    end)
    |> case do
      {:ok, descriptor, files} -> finish_multipart(descriptor, files)
      other -> other
    end
  rescue
    _ -> {:error, "Host execution multipart body is invalid."}
  end

  defp parse_multipart_part(header_blob, data, descriptor, files) do
    headers =
      header_blob
      |> String.split("\r\n")
      |> Enum.reduce(%{}, fn line, acc ->
        case String.split(line, ":", parts: 2) do
          [name, value] -> Map.put(acc, String.downcase(String.trim(name)), String.trim(value))
          _ -> acc
        end
      end)

    disposition = Map.get(headers, "content-disposition", "")
    name = capture_disposition(disposition, "name")
    filename = capture_disposition(disposition, "filename")

    cond do
      name == "descriptor" and !is_nil(descriptor) ->
        {:halt, {:error, "Host execution multipart request contains multiple descriptors."}}

      name == "descriptor" ->
        {:cont, {:ok, data, files}}

      true ->
        case Regex.run(~r/^formData\[(\d+)\]$/, name) do
          [_, index_text] ->
            index = String.to_integer(index_text)

            if Map.has_key?(files, index) do
              {:halt, {:error, "Host execution multipart request contains duplicate formData[#{index}] parts."}}
            else
              file = %{
                filename: filename,
                content_type: Map.get(headers, "content-type", ""),
                data: data
              }

              {:cont, {:ok, descriptor, Map.put(files, index, file)}}
            end

          _ -> {:cont, {:ok, descriptor, files}}
        end
    end
  end

  defp finish_multipart(nil, _files), do: {:error, "Host execution multipart request requires a descriptor."}
  defp finish_multipart(descriptor, files), do: {:ok, descriptor, files}

  defp decode_descriptor(descriptor) do
    case Jason.decode(descriptor) do
      {:ok, value} when is_map(value) -> {:ok, value}
      _ -> {:error, "Host execution multipart descriptor must be valid UTF-8 JSON object."}
    end
  end

  defp capture_disposition(disposition, field) do
    case Regex.run(Regex.compile!("\\b#{field}=\\\"([^\\\"]*)\\\""), disposition) do
      [_, value] -> value
      _ -> ""
    end
  end

  defp trim_prefix(value, prefix) do
    if String.starts_with?(value, prefix), do: binary_part(value, byte_size(prefix), byte_size(value) - byte_size(prefix)), else: value
  end

  defp trim_suffix(value, suffix) do
    if String.ends_with?(value, suffix), do: binary_part(value, 0, byte_size(value) - byte_size(suffix)), else: value
  end

  defp execution_json(conn, status, payload) do
    body = Jason.encode!(payload)

    conn
    |> put_resp_content_type("application/json", "utf-8")
    |> put_resp_header("cache-control", "no-store")
    |> send_resp(status, body)
  end

  defp docs(conn, config) do
    try_it =
      %{enabled: config.try_it_enabled}
      |> maybe_put(:defaultServer, config.try_it_default_server)
      |> maybe_put(:credentials, config.try_it_credentials)
      |> maybe_put(:apiClientPersistenceKey, config.try_it_api_client_persistence_key)
      |> maybe_put_host_execution(config)

    options =
      %{
        contractVersion: "1",
        title: config.title,
        theme: config.theme,
        tryIt: try_it
      }
      |> maybe_put(:expand, config.expand)

    html = """
    <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>#{escape_html(config.title)}</title><link rel="stylesheet" href="#{config.path}/__flexdoc/renderer.css?v=#{@fingerprint}"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__=#{safe_json(config.spec_url)};window.__FLEXDOC_OPTIONS__=#{safe_json(options)};</script><script src="#{config.path}/__flexdoc/renderer.js?v=#{@fingerprint}"></script><script>(async function(){const root=document.getElementById('flexdoc-root');try{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={spec:spec,options:window.__FLEXDOC_OPTIONS__||{},baseUri:baseUri};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}catch(error){root.textContent=error instanceof Error?error.message:String(error);}})();</script></body></html>
    """

    conn
    |> put_resp_content_type("text/html", "utf-8")
    |> put_resp_header("cache-control", "no-cache")
    |> send_resp(200, html)
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp execution_available?(%{try_it_host_execution: true, host_execution: %HostExecution{}}), do: true
  defp execution_available?(_config), do: false

  defp maybe_put_host_execution(map, %{try_it_host_execution: true, path: path} = config) do
    Map.put(map, :hostExecution, %{
      available: execution_available?(config),
      endpoint: path <> "/__flexdoc/execute",
      capabilities: if(execution_available?(config), do: HostExecution.capabilities(config.host_execution), else: [])
    })
  end

  defp maybe_put_host_execution(map, _config), do: map

  defp asset(conn, body, content_type) do
    conn
    |> put_resp_header("content-type", content_type)
    |> put_resp_header("cache-control", "public, max-age=31536000, immutable")
    |> send_resp(200, body)
  end

  defp safe_json(value) do
    value
    |> Jason.encode!()
    |> String.replace("<", "\\u003c")
    |> String.replace(">", "\\u003e")
    |> String.replace("&", "\\u0026")
    |> String.replace(<<0xE2, 0x80, 0xA8>>, "\\u2028")
    |> String.replace(<<0xE2, 0x80, 0xA9>>, "\\u2029")
  end

  defp escape_html(value) do
    value
    |> to_string()
    |> String.replace("&", "&amp;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
    |> String.replace("\"", "&quot;")
    |> String.replace("'", "&#39;")
  end
end
