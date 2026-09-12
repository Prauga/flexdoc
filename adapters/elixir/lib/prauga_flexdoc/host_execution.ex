defmodule PraugaFlexDoc.HostExecution do
  @moduledoc """
  Framework-neutral implementation of FlexDoc's existing API-host execution envelope.

  This first native Elixir slice intentionally advertises no host-only capabilities.
  """

  import Bitwise, only: [band: 2, bsr: 2]

  @max_request_bytes 32 * 1024 * 1024
  @max_response_bytes 10 * 1024 * 1024
  @max_response_header_bytes 64 * 1024
  @default_timeout_ms 30_000
  @min_timeout_ms 100
  @max_timeout_ms 120_000
  @max_redirects 5
  @methods ~w(GET HEAD POST PUT PATCH DELETE OPTIONS)
  @unsafe_headers MapSet.new(~w(
    connection keep-alive proxy-authenticate proxy-authorization te trailer
    transfer-encoding upgrade host content-length set-cookie origin referer
  ))
  @metadata_hosts MapSet.new(~w(169.254.169.254 metadata.google.internal metadata.google))

  defstruct allowed_origins: MapSet.new()

  @type t :: %__MODULE__{allowed_origins: MapSet.t(String.t())}
  @type uploaded_file :: %{filename: String.t(), content_type: String.t(), data: binary()}
  @type result :: %{status: pos_integer(), body: map()}

  def max_request_bytes, do: @max_request_bytes
  def capabilities(_execution), do: []

  @doc "Creates a native executor from a non-empty exact HTTP(S) origin allowlist."
  @spec new!([String.t()]) :: t()
  def new!(allowed_origins) do
    normalized =
      allowed_origins
      |> List.wrap()
      |> Enum.map(&to_string/1)
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))
      |> Enum.map(fn raw ->
        uri = parse_http_uri!(raw, "host execution allowed origin #{inspect(raw)} must be an absolute HTTP(S) origin")

        unless is_nil(uri.userinfo) and uri.path in [nil, "", "/"] and is_nil(uri.query) and is_nil(uri.fragment) do
          raise ArgumentError,
                "host execution allowed origins cannot contain credentials, paths, queries, or fragments: #{raw}"
        end

        origin_of(uri)
      end)
      |> MapSet.new()

    if MapSet.size(normalized) == 0 do
      raise ArgumentError, "FlexDoc host execution requires at least one exact allowed origin"
    end

    %__MODULE__{allowed_origins: normalized}
  end

  @doc "Validates the marker and executes one canonical FlexDoc request envelope."
  @spec handle(t(), String.t() | nil, term(), %{optional(non_neg_integer()) => uploaded_file()}) :: result()
  def handle(execution, marker, envelope, files \\ %{}) do
    if marker != "1" do
      %{status: 403, body: %{"error" => "Missing X-FlexDoc-Execute header."}}
    else
      try do
        %{status: 200, body: execute(execution, envelope, files)}
      catch
        {:execution_error, status, message} -> %{status: status, body: %{"error" => message}}
      end
    end
  end

  defp execute(execution, envelope, files) when is_map(envelope) do
    if envelope["cookieJar"] == "session" do
      fail(400, "Session cookie jars are not implemented by the Elixir host executor.")
    end

    if String.trim(string_value(envelope["certificateId"])) != "" do
      fail(400, "Client certificates are not implemented by the Elixir host executor.")
    end

    draft = envelope["request"]
    unless is_map(draft), do: fail(400, "Host execution body requires a canonical request draft.")

    raw_url = string_value(draft["url"])
    if String.trim(raw_url) == "", do: fail(400, "Host execution requires an absolute request URL.")
    target = parse_request_uri(raw_url)
    unless is_nil(target.userinfo), do: fail(403, "Host execution URLs cannot contain embedded credentials.")
    target = append_query(target, entries(draft["query"]))

    method = draft["method"] |> string_value() |> String.trim() |> String.upcase() |> default_method()
    unless method in @methods, do: fail(400, "Unsupported host execution HTTP method: #{method}")

    headers = draft["headers"] |> entries() |> sanitize_headers() |> apply_header_auth(draft["auth"])
    mode = infer_body_mode(draft)
    {body, content_type} = prepare_body(draft, envelope, files, mode)
    content_type = validate_content_type(content_type)
    headers = if mode == "formdata", do: Map.delete(headers, "content-type"), else: headers
    headers = if content_type && !Map.has_key?(headers, "content-type"), do: Map.put(headers, "content-type", [content_type]), else: headers

    timeout_ms = envelope["timeoutMs"] |> integer_value(@default_timeout_ms) |> max(@min_timeout_ms) |> min(@max_timeout_ms)
    deadline = System.monotonic_time(:millisecond) + timeout_ms
    execute_with_redirects(execution, method, target, headers, body, draft["auth"], deadline, timeout_ms, 0)
  end

  defp execute(_execution, _envelope, _files), do: fail(400, "Host execution body must be a JSON object.")

  defp execute_with_redirects(execution, method, current, headers, body, auth, deadline, timeout_ms, redirect_count) do
    remaining = deadline - System.monotonic_time(:millisecond)
    if remaining <= 0, do: fail(502, "Host execution request timed out after #{timeout_ms} ms.")

    request_uri = apply_query_auth(current, auth)
    validated_addresses = assert_allowed(execution, request_uri, remaining, timeout_ms)
    remaining = deadline - System.monotonic_time(:millisecond)
    if remaining <= 0, do: fail(502, "Host execution request timed out after #{timeout_ms} ms.")
    started = System.monotonic_time(:millisecond)

    case perform_request(method, request_uri, headers, body, remaining, validated_addresses) do
      {:ok, status, reason, response_headers, response_body} ->
        case redirect_location(status, response_headers) do
          nil ->
            %{
              "status" => status,
              "statusText" => reason,
              "headers" => Enum.map(response_headers, fn {name, value} -> [name, value] end),
              "body" => ensure_utf8(response_body),
              "responseTime" => max(System.monotonic_time(:millisecond) - started, 0)
            }

          location ->
            if redirect_count >= @max_redirects do
              fail(403, "Host execution exceeded the redirect safety limit.")
            end

            next = resolve_redirect(request_uri, location)
            if origin_of(next) != origin_of(request_uri), do: fail(403, "Host execution does not follow cross-origin redirects.")

            {next_method, next_body, next_headers} =
              if status == 303 do
                {"GET", <<>>, Map.delete(headers, "content-type")}
              else
                {method, body, headers}
              end

            execute_with_redirects(
              execution,
              next_method,
              next,
              next_headers,
              next_body,
              auth,
              deadline,
              timeout_ms,
              redirect_count + 1
            )
        end

      {:error, :timeout} ->
        fail(502, "Host execution request timed out after #{timeout_ms} ms.")

      {:error, :response_too_large} ->
        fail(502, "Host execution response exceeded the 10 MiB safety limit.")

      {:error, reason} ->
        fail(502, "Host execution request failed: #{format_reason(reason)}")
    end
  end

  defp perform_request(method, uri, headers, body, timeout_ms, validated_addresses) do
    deadline = System.monotonic_time(:millisecond) + timeout_ms
    request_headers = Enum.flat_map(headers, fn {name, values} -> Enum.map(values, &{name, &1}) end)
    request_target = request_target(uri)
    request_body = if body == <<>>, do: nil, else: body

    with {:ok, conn} <- connect_validated(uri, validated_addresses, deadline),
         {:ok, conn, request_ref} <- Mint.HTTP.request(conn, method, request_target, request_headers, request_body) do
      receive_response(conn, request_ref, deadline, %{status: nil, headers: [], chunks: [], size: 0, done: false})
    else
      {:error, reason} -> if(timeout_reason?(reason), do: {:error, :timeout}, else: {:error, reason})
      {:error, conn, reason} ->
        close_connection(conn)
        if(timeout_reason?(reason), do: {:error, :timeout}, else: {:error, reason})
    end
  rescue
    error -> {:error, error}
  end

  defp connect_validated(uri, addresses, deadline) do
    Enum.reduce_while(addresses, {:error, :econnrefused}, fn address, _last_error ->
      remaining = deadline - System.monotonic_time(:millisecond)

      if remaining <= 0 do
        {:halt, {:error, :timeout}}
      else
        opts = [
          hostname: uri.host,
          mode: :passive,
          protocols: [:http1],
          max_header_list_size: @max_response_header_bytes,
          transport_opts: transport_options(uri, address, remaining)
        ]

        case Mint.HTTP.connect(scheme_atom(uri.scheme), address, uri.port || default_port(uri.scheme), opts) do
          {:ok, conn} -> {:halt, {:ok, conn}}
          {:error, reason} ->
            if timeout_reason?(reason), do: {:halt, {:error, :timeout}}, else: {:cont, {:error, reason}}
        end
      end
    end)
  end

  defp transport_options(uri, address, timeout_ms) do
    family = if tuple_size(address) == 8, do: [inet6: true], else: []
    common = [timeout: timeout_ms] ++ family

    if uri.scheme == "https" do
      [cacerts: :public_key.cacerts_get(), verify: :verify_peer] ++ common
    else
      common
    end
  end

  defp receive_response(conn, request_ref, deadline, state) do
    if state.done do
      response = finalize_response(state)
      close_connection(conn)
      response
    else
      remaining = deadline - System.monotonic_time(:millisecond)

      if remaining <= 0 do
        close_connection(conn)
        {:error, :timeout}
      else
        case Mint.HTTP.recv(conn, 0, remaining) do
          {:ok, next_conn, responses} ->
            case collect_responses(state, request_ref, responses) do
              {:ok, next_state} -> receive_response(next_conn, request_ref, deadline, next_state)
              {:error, reason} ->
                close_connection(next_conn)
                {:error, reason}
            end

          {:error, next_conn, reason, responses} ->
            result = collect_responses(state, request_ref, responses)

            case result do
              {:ok, %{done: true} = next_state} ->
                response = finalize_response(next_state)
                close_connection(next_conn)
                response

              {:error, collect_reason} ->
                close_connection(next_conn)
                {:error, collect_reason}

              {:ok, _next_state} ->
                close_connection(next_conn)
                if(timeout_reason?(reason), do: {:error, :timeout}, else: {:error, reason})
            end
        end
      end
    end
  end

  defp collect_responses(state, request_ref, responses) do
    Enum.reduce_while(responses, {:ok, state}, fn response, {:ok, current} ->
      case response do
        {:status, ^request_ref, status} ->
          next = if status >= 200, do: %{current | status: status, headers: [], chunks: [], size: 0}, else: current
          {:cont, {:ok, next}}

        {:headers, ^request_ref, headers} ->
          normalized = Enum.map(headers, fn {name, value} -> {String.downcase(to_string(name)), to_string(value)} end)
          {:cont, {:ok, %{current | headers: current.headers ++ normalized}}}

        {:data, ^request_ref, data} ->
          binary = IO.iodata_to_binary(data)
          size = current.size + byte_size(binary)

          if size > @max_response_bytes do
            {:halt, {:error, :response_too_large}}
          else
            {:cont, {:ok, %{current | chunks: [current.chunks, binary], size: size}}}
          end

        {:done, ^request_ref} ->
          {:halt, {:ok, %{current | done: true}}}

        _ ->
          {:cont, {:ok, current}}
      end
    end)
  end

  defp finalize_response(%{status: status, headers: headers, chunks: chunks}) when is_integer(status) do
    {:ok, status, status_text(status), headers, IO.iodata_to_binary(chunks)}
  end

  defp finalize_response(_state), do: {:error, :invalid_response}

  defp close_connection(conn) do
    Mint.HTTP.close(conn)
    :ok
  rescue
    _ -> :ok
  end

  defp request_target(uri) do
    path = if uri.path in [nil, ""], do: "/", else: uri.path
    if uri.query in [nil, ""], do: path, else: path <> "?" <> uri.query
  end

  defp status_text(status) do
    Plug.Conn.Status.reason_phrase(status)
  rescue
    _ -> ""
  end

  defp scheme_atom("https"), do: :https
  defp scheme_atom(_), do: :http
  defp default_port("https"), do: 443
  defp default_port(_), do: 80

  defp timeout_reason?(:timeout), do: true
  defp timeout_reason?(%Mint.TransportError{reason: :timeout}), do: true
  defp timeout_reason?(_), do: false

  defp redirect_location(status, headers) when status in 300..399 do
    headers
    |> Enum.find_value(fn
      {"location", value} -> value
      _ -> nil
    end)
  end

  defp redirect_location(_status, _headers), do: nil

  defp resolve_redirect(base, location) do
    case URI.parse(location) do
      %URI{scheme: nil} = relative -> URI.merge(base, relative)
      %URI{} = absolute -> absolute
    end
  rescue
    _ -> fail(400, "Host execution received an invalid redirect URL.")
  end

  defp assert_allowed(execution, %URI{} = uri, timeout_ms, total_timeout_ms) do
    unless uri.scheme in ["http", "https"] and is_binary(uri.host) do
      fail(403, "Host execution only allows HTTP(S) URLs.")
    end

    unless is_nil(uri.userinfo), do: fail(403, "Host execution URLs cannot contain embedded credentials.")
    origin = origin_of(uri)
    unless MapSet.member?(execution.allowed_origins, origin), do: fail(403, "Origin #{origin} is not allowed for host execution.")

    host = uri.host |> String.trim_leading("[") |> String.trim_trailing("]") |> String.downcase()
    if MapSet.member?(@metadata_hosts, host), do: fail(403, "Host execution blocks link-local and cloud metadata endpoints.")

    addresses =
      case :inet.parse_address(String.to_charlist(host)) do
        {:ok, address} -> [address]
        {:error, _} -> resolve_addresses(host, timeout_ms, total_timeout_ms)
      end

    if addresses == [], do: fail(502, "Host execution could not resolve target hostname.")

    if Enum.any?(addresses, &metadata_address?/1) do
      fail(403, "Host execution blocks DNS resolutions to link-local and cloud metadata endpoints.")
    end

    addresses
  end

  defp resolve_addresses(host, timeout_ms, total_timeout_ms) do
    task = Task.async(fn -> do_resolve_addresses(host) end)

    case Task.yield(task, timeout_ms) || Task.shutdown(task, :brutal_kill) do
      {:ok, addresses} -> addresses
      nil -> fail(502, "Host execution request timed out after #{total_timeout_ms} ms.")
      {:exit, _reason} -> []
    end
  end

  defp do_resolve_addresses(host) do
    char_host = String.to_charlist(host)

    [
      case :inet.getaddrs(char_host, :inet) do
        {:ok, values} -> values
        _ -> []
      end,
      case :inet.getaddrs(char_host, :inet6) do
        {:ok, values} -> values
        _ -> []
      end
    ]
    |> List.flatten()
    |> Enum.uniq()
  end

  defp metadata_address?({169, 254, _, _}), do: true

  defp metadata_address?({0, 0, 0, 0, 0, 0xFFFF, high, _low}) do
    band(bsr(high, 8), 0xFF) == 169 and band(high, 0xFF) == 254
  end

  defp metadata_address?({first, _, _, _, _, _, _, _}), do: band(first, 0xFFC0) == 0xFE80
  defp metadata_address?(_), do: false

  defp parse_request_uri(raw) do
    parse_http_uri!(raw, "Host execution requires an absolute HTTP(S) request URL.")
  rescue
    ArgumentError -> fail(400, "Host execution requires an absolute HTTP(S) request URL.")
  end

  defp parse_http_uri!(raw, message) do
    uri = URI.parse(raw)
    unless uri.scheme in ["http", "https"] and is_binary(uri.host), do: raise(ArgumentError, message)
    uri
  rescue
    _ -> raise ArgumentError, message
  end

  defp origin_of(uri) do
    default_port = if uri.scheme == "https", do: 443, else: 80
    port = uri.port || default_port
    host = if String.contains?(uri.host, ":") and !String.starts_with?(uri.host, "["), do: "[#{uri.host}]", else: uri.host
    suffix = if port == default_port, do: "", else: ":#{port}"
    "#{String.downcase(uri.scheme)}://#{String.downcase(host)}#{suffix}"
  end

  defp append_query(uri, values) do
    encoded =
      values
      |> Enum.filter(&entry_enabled?/1)
      |> Enum.filter(&(String.trim(string_value(&1["key"])) != ""))
      |> Enum.map(fn entry -> URI.encode_www_form(string_value(entry["key"])) <> "=" <> URI.encode_www_form(string_value(entry["value"])) end)

    if encoded == [] do
      uri
    else
      %{uri | query: [uri.query | encoded] |> Enum.reject(&(&1 in [nil, ""])) |> Enum.join("&")}
    end
  end

  defp sanitize_headers(values) do
    Enum.reduce(values, %{}, fn entry, result ->
      if entry_enabled?(entry) do
        name = entry["key"] |> string_value() |> String.trim()
        normalized = String.downcase(name)

        cond do
          name == "" -> result
          unsafe_header_name?(normalized) -> result
          !Regex.match?(~r/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/, name) -> fail(400, "Invalid host execution request header: #{name}")
          invalid_header_value?(string_value(entry["value"])) -> fail(400, "Invalid host execution request header: #{name}")
          true -> Map.update(result, normalized, [string_value(entry["value"])], &(&1 ++ [string_value(entry["value"])]))
        end
      else
        result
      end
    end)
  end

  defp apply_header_auth(headers, raw) do
    auth = if is_map(raw), do: raw, else: %{}

    case string_value(auth["type"]) do
      type when type in ["", "none", "inherit"] -> headers
      "bearer" -> put_bearer(headers, string_value(auth["token"]))
      "oauth2" -> put_bearer(headers, string_value(auth["accessToken"]))
      "basic" -> Map.put(headers, "authorization", ["Basic " <> Base.encode64(string_value(auth["username"]) <> ":" <> string_value(auth["password"]))])
      "apiKey" ->
        key = auth["key"] |> string_value() |> String.trim()
        if key == "", do: fail(400, "API key authentication requires a key name.")
        location = auth["in"] |> string_value() |> default_string("header")

        case location do
          "header" ->
            normalized = String.downcase(key)
            value = string_value(auth["value"])

            cond do
              unsafe_header_name?(normalized) -> fail(400, "Unsafe host execution request header: #{key}")
              !Regex.match?(~r/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/, key) -> fail(400, "Invalid host execution request header: #{key}")
              invalid_header_value?(value) -> fail(400, "Invalid host execution request header: #{key}")
              true -> Map.put(headers, normalized, [value])
            end

          "query" -> headers
          "cookie" -> fail(400, "Cookie authentication is not implemented by the Elixir host executor.")
          other -> fail(400, "Unsupported API key location: #{other}")
        end

      other -> fail(400, "Authentication type #{other} is not implemented by the Elixir host executor.")
    end
  end

  defp put_bearer(headers, ""), do: headers

  defp put_bearer(headers, token) do
    if invalid_header_value?(token), do: fail(400, "Invalid host execution request header: Authorization")
    Map.put(headers, "authorization", ["Bearer #{token}"])
  end

  defp apply_query_auth(uri, raw) do
    auth = if is_map(raw), do: raw, else: %{}

    if string_value(auth["type"]) == "apiKey" and string_value(auth["in"]) == "query" do
      key = string_value(auth["key"])
      if String.trim(key) == "", do: fail(400, "API key authentication requires a key name.")
      encoded = URI.encode_www_form(key) <> "=" <> URI.encode_www_form(string_value(auth["value"]))
      %{uri | query: [uri.query, encoded] |> Enum.reject(&(&1 in [nil, ""])) |> Enum.join("&")}
    else
      uri
    end
  end

  defp prepare_body(draft, envelope, files, mode) do
    explicit_type = string_value(draft["contentType"])

    case mode do
      "none" -> {<<>>, nil}
      "raw" -> {string_value(draft["body"]), non_empty(explicit_type)}
      "json" -> {string_value(draft["body"]), default_string(explicit_type, "application/json")}
      "binary" ->
        encoded = string_value(envelope["bodyBase64"])
        if encoded == "", do: fail(400, "Binary host execution requires bodyBase64.")

        case Base.decode64(encoded) do
          {:ok, data} ->
            nested = if is_map(draft["binary"]), do: string_value(draft["binary"]["contentType"]), else: ""
            {data, explicit_type |> default_string(default_string(nested, "application/octet-stream"))}
          :error -> fail(400, "Binary host execution bodyBase64 is invalid.")
        end

      "urlencoded" ->
        pairs =
          draft["urlencoded"]
          |> entries()
          |> Enum.filter(&entry_enabled?/1)
          |> Enum.filter(&(String.trim(string_value(&1["key"])) != ""))
          |> Enum.map(fn entry -> URI.encode_www_form(string_value(entry["key"])) <> "=" <> URI.encode_www_form(string_value(entry["value"])) end)

        {Enum.join(pairs, "&"), default_string(explicit_type, "application/x-www-form-urlencoded")}

      "graphql" ->
        graph = draft["graphql"]
        unless is_map(graph), do: fail(400, "GraphQL body must be an object.")
        variables_text = string_value(graph["variables"])

        variables =
          if String.trim(variables_text) == "" do
            %{}
          else
            case Jason.decode(variables_text) do
              {:ok, value} -> value
              _ -> fail(400, "GraphQL variables must be valid JSON.")
            end
          end

        {Jason.encode!(%{"query" => string_value(graph["query"]), "variables" => variables}), default_string(explicit_type, "application/json")}

      "formdata" -> build_multipart(draft, files)
      other -> fail(400, "Body mode #{other} is not implemented by the Elixir host executor.")
    end
  end

  defp build_multipart(draft, files) do
    boundary = "----flexdoc-elixir-" <> (:crypto.strong_rand_bytes(12) |> Base.encode16(case: :lower))

    body =
      draft["formData"]
      |> entries()
      |> Enum.with_index()
      |> Enum.reduce([], fn {entry, index}, output ->
        if entry_enabled?(entry) and String.trim(string_value(entry["key"])) != "" do
          key = string_value(entry["key"])

          if string_value(entry["type"]) == "file" do
            file = files[index] || fail(400, "Host execution multipart file formData[#{index}] is missing.")
            filename = file.filename |> string_value() |> default_string(string_value(entry["fileName"])) |> default_string("upload.bin")

            content_type =
              file.content_type
              |> string_value()
              |> default_string(string_value(entry["contentType"]))
              |> default_string("application/octet-stream")
              |> validate_content_type()

            [output, "--#{boundary}\r\n", "Content-Disposition: form-data; name=\"#{quote_multipart(key)}\"; filename=\"#{quote_multipart(filename)}\"\r\n", "Content-Type: #{content_type}\r\n\r\n", file.data, "\r\n"]
          else
            [output, "--#{boundary}\r\n", "Content-Disposition: form-data; name=\"#{quote_multipart(key)}\"\r\n\r\n", string_value(entry["value"]), "\r\n"]
          end
        else
          output
        end
      end)

    {IO.iodata_to_binary([body, "--#{boundary}--\r\n"]), "multipart/form-data; boundary=#{boundary}"}
  end

  defp infer_body_mode(draft) do
    explicit = string_value(draft["bodyMode"])
    binary = draft["binary"]
    graphql = draft["graphql"]

    cond do
      String.trim(explicit) != "" -> explicit
      is_map(binary) and string_value(binary["fileName"]) != "" -> "binary"
      is_list(draft["formData"]) and length(draft["formData"]) > 0 -> "formdata"
      is_list(draft["urlencoded"]) and length(draft["urlencoded"]) > 0 -> "urlencoded"
      is_map(graphql) and (string_value(graphql["query"]) != "" or string_value(graphql["variables"]) != "") -> "graphql"
      string_value(draft["body"]) == "" -> "none"
      String.contains?(String.downcase(string_value(draft["contentType"])), "json") -> "json"
      true -> "raw"
    end
  end

  defp entries(value) when is_list(value), do: Enum.filter(value, &is_map/1)
  defp entries(_), do: []
  defp entry_enabled?(entry), do: entry["enabled"] != false

  defp string_value(nil), do: ""
  defp string_value(value) when is_binary(value), do: value
  defp string_value(value) when is_boolean(value) or is_number(value), do: to_string(value)
  defp string_value(value) when is_atom(value), do: Atom.to_string(value)
  defp string_value(value), do: Jason.encode!(value)

  defp integer_value(value, _fallback) when is_integer(value), do: value
  defp integer_value(value, fallback) do
    case Integer.parse(string_value(value)) do
      {number, ""} -> number
      _ -> fallback
    end
  end

  defp default_method(""), do: "GET"
  defp default_method(value), do: value
  defp default_string("", fallback), do: fallback
  defp default_string(nil, fallback), do: fallback
  defp default_string(value, _fallback), do: value
  defp non_empty(""), do: nil
  defp non_empty(nil), do: nil
  defp non_empty(value), do: value

  defp unsafe_header_name?(normalized) do
    MapSet.member?(@unsafe_headers, normalized) or
      String.starts_with?(normalized, ["proxy-", "sec-"])
  end

  defp invalid_header_value?(value), do: String.contains?(value, ["\r", "\n"])

  defp validate_content_type(nil), do: nil

  defp validate_content_type(value) do
    if invalid_header_value?(value), do: fail(400, "Invalid host execution content type.")
    value
  end

  defp quote_multipart(value) do
    value
    |> to_string()
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace(["\r", "\n"], "")
  end

  defp ensure_utf8(data) when is_binary(data) do
    if String.valid?(data), do: data, else: :unicode.characters_to_binary(data, :latin1, :utf8)
  rescue
    _ -> String.replace_invalid(data, "�")
  end

  defp format_reason(%{__exception__: true} = error), do: Exception.message(error)
  defp format_reason(reason) when is_binary(reason), do: reason
  defp format_reason(reason), do: inspect(reason)
  defp fail(status, message), do: throw({:execution_error, status, message})
end
