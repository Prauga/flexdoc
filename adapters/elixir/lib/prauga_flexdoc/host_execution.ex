defmodule PraugaFlexDoc.HostExecution do
  @moduledoc """
  Framework-neutral implementation of FlexDoc's existing API-host execution envelope.

  This first native Elixir slice intentionally advertises no host-only capabilities.
  """

  import Bitwise, only: [band: 2]

  @max_request_bytes 32 * 1024 * 1024
  @max_response_bytes 10 * 1024 * 1024
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
    assert_allowed(execution, request_uri)
    started = System.monotonic_time(:millisecond)

    case perform_request(method, request_uri, headers, body, remaining) do
      {:ok, status, reason, response_headers, response_body} ->
        case redirect_location(status, response_headers) do
          nil ->
            if byte_size(response_body) > @max_response_bytes do
              fail(502, "Host execution response exceeded the 10 MiB safety limit.")
            end

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
            assert_allowed(execution, next)

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

      {:error, reason} ->
        fail(502, "Host execution request failed: #{format_reason(reason)}")
    end
  end

  defp perform_request(method, uri, headers, body, timeout_ms) do
    has_entity = body != <<>> or method not in ["GET", "HEAD"]

    request_headers =
      headers
      |> Enum.reject(fn {name, _} -> has_entity and name == "content-type" end)
      |> Enum.flat_map(fn {name, values} -> Enum.map(values, &{String.to_charlist(name), String.to_charlist(&1)}) end)

    url = uri |> URI.to_string() |> String.to_charlist()

    request =
      if has_entity do
        content_type = headers |> Map.get("content-type", [""]) |> List.first() |> to_string() |> String.to_charlist()
        {url, request_headers, content_type, body}
      else
        {url, request_headers}
      end

    http_options = [autoredirect: false, timeout: timeout_ms, connect_timeout: timeout_ms]
    options = [body_format: :binary]

    case :httpc.request(method_atom(method), request, http_options, options) do
      {:ok, {{_version, status, reason}, response_headers, response_body}} ->
        headers = Enum.map(response_headers, fn {name, value} -> {name |> to_string() |> String.downcase(), to_string(value)} end)
        {:ok, status, to_string(reason), headers, IO.iodata_to_binary(response_body)}

      {:error, {:failed_connect, _} = reason} -> {:error, reason}
      {:error, {:timeout, _}} -> {:error, :timeout}
      {:error, :timeout} -> {:error, :timeout}
      {:error, reason} -> {:error, reason}
    end
  rescue
    error -> {:error, Exception.message(error)}
  end

  defp method_atom("GET"), do: :get
  defp method_atom("HEAD"), do: :head
  defp method_atom("POST"), do: :post
  defp method_atom("PUT"), do: :put
  defp method_atom("PATCH"), do: :patch
  defp method_atom("DELETE"), do: :delete
  defp method_atom("OPTIONS"), do: :options

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

  defp assert_allowed(execution, %URI{} = uri) do
    unless uri.scheme in ["http", "https"] and is_binary(uri.host) do
      fail(403, "Host execution only allows HTTP(S) URLs.")
    end

    unless is_nil(uri.userinfo), do: fail(403, "Host execution URLs cannot contain embedded credentials.")
    origin = origin_of(uri)
    unless MapSet.member?(execution.allowed_origins, origin), do: fail(403, "Origin #{origin} is not allowed for host execution.")

    host = uri.host |> String.trim_leading("[") |> String.trim_trailing("]") |> String.downcase()
    if MapSet.member?(@metadata_hosts, host), do: fail(403, "Host execution blocks link-local and cloud metadata endpoints.")

    case :inet.parse_address(String.to_charlist(host)) do
      {:ok, address} ->
        if metadata_address?(address), do: fail(403, "Host execution blocks link-local and cloud metadata endpoints.")

      {:error, _} ->
        addresses = resolve_addresses(host)
        if addresses == [], do: fail(502, "Host execution could not resolve target hostname.")
        if Enum.any?(addresses, &metadata_address?/1) do
          fail(403, "Host execution blocks DNS resolutions to link-local and cloud metadata endpoints.")
        end
    end
  end

  defp resolve_addresses(host) do
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
          MapSet.member?(@unsafe_headers, normalized) -> result
          String.starts_with?(normalized, ["proxy-", "sec-"]) -> result
          !Regex.match?(~r/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/, name) -> fail(400, "Invalid host execution request header: #{name}")
          String.contains?(string_value(entry["value"]), ["\r", "\n"]) -> fail(400, "Invalid host execution request header: #{name}")
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
        key = string_value(auth["key"])
        if String.trim(key) == "", do: fail(400, "API key authentication requires a key name.")
        location = auth["in"] |> string_value() |> default_string("header")

        case location do
          "header" ->
            unless Regex.match?(~r/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/, key), do: fail(400, "Invalid host execution request header: #{key}")
            Map.put(headers, String.downcase(key), [string_value(auth["value"])])
          "query" -> headers
          "cookie" -> fail(400, "Cookie authentication is not implemented by the Elixir host executor.")
          other -> fail(400, "Unsupported API key location: #{other}")
        end

      other -> fail(400, "Authentication type #{other} is not implemented by the Elixir host executor.")
    end
  end

  defp put_bearer(headers, ""), do: headers
  defp put_bearer(headers, token), do: Map.put(headers, "authorization", ["Bearer #{token}"])

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
            content_type = file.content_type |> string_value() |> default_string(string_value(entry["contentType"])) |> default_string("application/octet-stream")

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

    cond do
      String.trim(explicit) != "" -> explicit
      Map.has_key?(draft, "binary") -> "binary"
      Map.has_key?(draft, "formData") -> "formdata"
      Map.has_key?(draft, "urlencoded") -> "urlencoded"
      Map.has_key?(draft, "graphql") -> "graphql"
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

  defp format_reason(reason) when is_binary(reason), do: reason
  defp format_reason(reason), do: inspect(reason)
  defp fail(status, message), do: throw({:execution_error, status, message})
end
