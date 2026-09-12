using System.Buffers;
using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Net.Http.Headers;

namespace Prauga.FlexDoc.AspNetCore;

/// <summary>
/// Native ASP.NET Core implementation of the canonical FlexDoc API-host execution envelope.
/// </summary>
public sealed class FlexDocHostExecution
{
    private const int MaxRequestBytes = 32 * 1024 * 1024;
    private const int MaxResponseBytes = 10 * 1024 * 1024;
    private const int MaxRedirects = 5;
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan MinimumTimeout = TimeSpan.FromMilliseconds(100);
    private static readonly TimeSpan MaximumTimeout = TimeSpan.FromSeconds(120);
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);
    private static readonly Regex HeaderNamePattern = new(
        @"^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly Regex FilePartPattern = new(
        @"^formData\[(\d+)\]$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly HashSet<string> SupportedMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS",
    };
    private static readonly HashSet<string> UnsafeHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
        "te", "trailer", "transfer-encoding", "upgrade", "host",
        "content-length", "set-cookie",
    };

    private readonly HashSet<string> _allowedOrigins;
    private readonly HttpClient _client;

    /// <summary>
    /// Creates an executor with an explicit exact HTTP(S) origin allowlist.
    /// </summary>
    public FlexDocHostExecution(IEnumerable<string> allowedOrigins)
    {
        ArgumentNullException.ThrowIfNull(allowedOrigins);

        _allowedOrigins = new HashSet<string>(StringComparer.Ordinal);
        foreach (var raw in allowedOrigins)
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            if (!TryParseHttpUri(raw, out var uri))
                throw new ArgumentException($"FlexDoc host execution allowed origin \"{raw}\" must be an absolute HTTP(S) URL.", nameof(allowedOrigins));
            if (!string.IsNullOrEmpty(uri.UserInfo)
                || (uri.AbsolutePath.Length > 0 && uri.AbsolutePath != "/")
                || !string.IsNullOrEmpty(uri.Query)
                || !string.IsNullOrEmpty(uri.Fragment))
                throw new ArgumentException(
                    $"FlexDoc host execution allowed origins cannot contain credentials, paths, queries, or fragments: {raw}",
                    nameof(allowedOrigins));
            _allowedOrigins.Add(OriginOf(uri));
        }

        if (_allowedOrigins.Count == 0)
            throw new ArgumentException("FlexDoc host execution requires at least one exact allowed origin.", nameof(allowedOrigins));

        var transport = new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            UseProxy = false,
            MaxConnectionsPerServer = 32,
            PooledConnectionIdleTimeout = TimeSpan.FromSeconds(90),
            ConnectTimeout = TimeSpan.FromSeconds(10),
            ConnectCallback = ConnectValidatedAsync,
        };
        _client = new HttpClient(transport)
        {
            Timeout = Timeout.InfiniteTimeSpan,
        };
    }

    /// <summary>Host-only capabilities implemented by this first ASP.NET Core slice.</summary>
    public IReadOnlyList<string> Capabilities { get; } = Array.Empty<string>();

    internal async Task HandleHttpAsync(HttpContext context)
    {
        if (!HttpMethods.IsPost(context.Request.Method))
        {
            await WriteJsonAsync(context, StatusCodes.Status405MethodNotAllowed, new { error = "Method not allowed." });
            return;
        }

        var marker = context.Request.Headers["X-FlexDoc-Execute"].ToString();
        if (marker != "1")
        {
            await WriteJsonAsync(context, StatusCodes.Status403Forbidden, new { error = "Missing X-FlexDoc-Execute header." });
            return;
        }

        if (context.Request.ContentLength is long length && length > MaxRequestBytes)
        {
            await WriteJsonAsync(context, StatusCodes.Status400BadRequest, new { error = "Host execution request exceeded the 32 MiB safety limit." });
            return;
        }

        try
        {
            var body = await ReadLimitedAsync(context.Request.Body, MaxRequestBytes, context.RequestAborted);
            var (envelope, files) = await ParseEnvelopeAsync(context.Request.ContentType, body, context.RequestAborted);
            var result = await ExecuteAsync(envelope, files, context.RequestAborted);
            await WriteJsonAsync(context, StatusCodes.Status200OK, result);
        }
        catch (HostExecutionException error)
        {
            await WriteJsonAsync(context, error.StatusCode, new { error = error.Message });
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The caller disconnected; there is no reliable response channel left to write.
        }
        catch
        {
            await WriteJsonAsync(context, StatusCodes.Status502BadGateway, new { error = "API host execution failed." });
        }
    }

    private async Task<Dictionary<string, object?>> ExecuteAsync(
        JsonElement envelope,
        IReadOnlyDictionary<int, UploadedFile> files,
        CancellationToken cancellationToken)
    {
        if (envelope.ValueKind != JsonValueKind.Object)
            throw BadRequest("Host execution body must be a JSON object.");

        if (StringValue(envelope, "cookieJar") == "session")
            throw BadRequest("Session cookie jars are not implemented by the ASP.NET Core host executor.");
        if (!string.IsNullOrWhiteSpace(StringValue(envelope, "certificateId")))
            throw BadRequest("Client certificates are not implemented by the ASP.NET Core host executor.");

        if (!envelope.TryGetProperty("request", out var draft) || draft.ValueKind != JsonValueKind.Object)
            throw BadRequest("Host execution body requires a canonical request draft.");

        var rawUrl = StringValue(draft, "url");
        if (string.IsNullOrWhiteSpace(rawUrl))
            throw BadRequest("Host execution requires an absolute request URL.");
        if (!TryParseHttpUri(rawUrl, out var target))
            throw BadRequest("Host execution requires an absolute HTTP(S) request URL.");
        if (!string.IsNullOrEmpty(target.UserInfo))
            throw Forbidden("Host execution URLs cannot contain embedded credentials.");

        target = AppendQuery(target, Entries(draft, "query"));

        var method = StringValue(draft, "method").Trim().ToUpperInvariant();
        if (method.Length == 0) method = "GET";
        if (!SupportedMethods.Contains(method))
            throw BadRequest($"Unsupported host execution HTTP method: {method}");

        var headers = SanitizeHeaders(Entries(draft, "headers"));
        ApplyHeaderAuth(draft, headers);

        var mode = InferBodyMode(draft);
        var prepared = await PrepareBodyAsync(draft, envelope, files, mode, cancellationToken);
        ValidateContentType(prepared.ContentType);
        if (mode == "formdata") headers.Remove("Content-Type");
        if (!string.IsNullOrEmpty(prepared.ContentType) && !headers.ContainsKey("Content-Type"))
            SetHeader(headers, "Content-Type", prepared.ContentType);

        var timeout = DurationMillis(envelope, "timeoutMs", DefaultTimeout);
        if (timeout < MinimumTimeout) timeout = MinimumTimeout;
        if (timeout > MaximumTimeout) timeout = MaximumTimeout;

        return await ExecuteWithRedirectsAsync(
            method,
            target,
            headers,
            prepared.Data,
            timeout,
            draft.TryGetProperty("auth", out var auth) ? auth.Clone() : default,
            cancellationToken);
    }

    private async Task<Dictionary<string, object?>> ExecuteWithRedirectsAsync(
        string method,
        Uri target,
        Dictionary<string, List<string>> headers,
        byte[]? body,
        TimeSpan timeout,
        JsonElement auth,
        CancellationToken outerCancellationToken)
    {
        var current = target;
        var currentHeaders = CloneHeaders(headers);
        var currentBody = body is null ? null : body.ToArray();

        for (var redirect = 0; redirect <= MaxRedirects; redirect++)
        {
            var requestUri = ApplyQueryAuth(auth, current);
            AssertAllowed(requestUri);

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(outerCancellationToken);
            timeoutCts.CancelAfter(timeout);

            using var request = new HttpRequestMessage(new HttpMethod(method), requestUri);
            if (currentBody is not null)
            {
                request.Content = new ByteArrayContent(currentBody);
            }
            ApplyHeaders(request, currentHeaders);

            var started = Stopwatch.GetTimestamp();
            HttpResponseMessage response;
            try
            {
                response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeoutCts.Token);
            }
            catch (OperationCanceledException) when (!outerCancellationToken.IsCancellationRequested && timeoutCts.IsCancellationRequested)
            {
                throw Upstream($"Host execution request timed out after {(long)timeout.TotalMilliseconds} ms.");
            }
            catch (Exception error)
            {
                var nested = FindHostExecutionException(error);
                if (nested is not null) throw nested;
                throw Upstream($"Host execution request failed: {error.Message}");
            }

            using (response)
            {
                byte[] responseBody;
                try
                {
                    await using var stream = await response.Content.ReadAsStreamAsync(timeoutCts.Token);
                    responseBody = await ReadLimitedAsync(stream, MaxResponseBytes, timeoutCts.Token, responseLimit: true);
                }
                catch (OperationCanceledException) when (!outerCancellationToken.IsCancellationRequested && timeoutCts.IsCancellationRequested)
                {
                    throw Upstream($"Host execution request timed out after {(long)timeout.TotalMilliseconds} ms.");
                }
                catch (HostExecutionException)
                {
                    throw;
                }
                catch (Exception error)
                {
                    throw Upstream($"Host execution response read failed: {error.Message}");
                }

                var elapsed = Stopwatch.GetElapsedTime(started).TotalMilliseconds;

                if (IsRedirect(response.StatusCode) && response.Headers.Location is Uri location)
                {
                    if (redirect == MaxRedirects)
                        throw Forbidden("Host execution exceeded the redirect safety limit.");

                    var next = location.IsAbsoluteUri ? location : new Uri(requestUri, location);
                    if (!string.Equals(OriginOf(next), OriginOf(requestUri), StringComparison.Ordinal))
                        throw Forbidden("Host execution does not follow cross-origin redirects.");
                    AssertAllowed(next);

                    if (response.StatusCode == HttpStatusCode.SeeOther)
                    {
                        method = "GET";
                        currentBody = null;
                        currentHeaders.Remove("Content-Type");
                    }

                    current = next;
                    continue;
                }

                var responseHeaders = new List<string[]>();
                foreach (var pair in response.Headers)
                    foreach (var value in pair.Value)
                        responseHeaders.Add(new[] { pair.Key, value });
                foreach (var pair in response.Content.Headers)
                    foreach (var value in pair.Value)
                        responseHeaders.Add(new[] { pair.Key, value });

                return new Dictionary<string, object?>
                {
                    ["status"] = (int)response.StatusCode,
                    ["statusText"] = response.ReasonPhrase ?? string.Empty,
                    ["headers"] = responseHeaders,
                    ["body"] = Encoding.UTF8.GetString(responseBody),
                    ["responseTime"] = (long)elapsed,
                };
            }
        }

        throw Forbidden("Host execution exceeded the redirect safety limit.");
    }

    private async ValueTask<Stream> ConnectValidatedAsync(
        SocketsHttpConnectionContext context,
        CancellationToken cancellationToken)
    {
        var host = context.DnsEndPoint.Host;
        var port = context.DnsEndPoint.Port;
        if (IsMetadataHost(host))
            throw Forbidden("Host execution blocks link-local and cloud metadata endpoints.");

        IPAddress[] addresses;
        if (IPAddress.TryParse(host.Trim('[', ']'), out var literal))
        {
            addresses = new[] { literal };
        }
        else
        {
            try
            {
                addresses = await Dns.GetHostAddressesAsync(host).WaitAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch
            {
                throw Upstream("Host execution could not resolve target hostname.");
            }
        }

        if (addresses.Length == 0)
            throw Upstream("Host execution could not resolve target hostname.");
        if (addresses.Any(IsMetadataAddress))
            throw Forbidden("Host execution blocks DNS resolutions to link-local and cloud metadata endpoints.");

        Exception? lastError = null;
        foreach (var address in addresses)
        {
            var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
            try
            {
                await socket.ConnectAsync(new IPEndPoint(address, port), cancellationToken);
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch (Exception error)
            {
                socket.Dispose();
                lastError = error;
            }
        }

        throw lastError ?? new SocketException((int)SocketError.HostUnreachable);
    }

    private void AssertAllowed(Uri target)
    {
        if (!IsHttpUri(target))
            throw Forbidden("Host execution only allows HTTP(S) URLs.");
        if (!string.IsNullOrEmpty(target.UserInfo))
            throw Forbidden("Host execution URLs cannot contain embedded credentials.");

        var origin = OriginOf(target);
        if (!_allowedOrigins.Contains(origin))
            throw Forbidden($"Origin {origin} is not allowed for host execution.");
        if (IsMetadataHost(target.Host))
            throw Forbidden("Host execution blocks link-local and cloud metadata endpoints.");
    }

    private static async Task<(JsonElement Envelope, IReadOnlyDictionary<int, UploadedFile> Files)> ParseEnvelopeAsync(
        string? contentType,
        byte[] body,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(contentType) || !MediaTypeHeaderValue.TryParse(contentType, out var parsed))
            throw BadRequest("Host execution Content-Type is invalid.");

        if (string.Equals(parsed.MediaType.Value, "application/json", StringComparison.OrdinalIgnoreCase))
            return (ParseJsonObject(body, "Host execution body must be valid UTF-8 JSON object."), new Dictionary<int, UploadedFile>());

        if (!string.Equals(parsed.MediaType.Value, "multipart/form-data", StringComparison.OrdinalIgnoreCase))
            throw BadRequest("Host execution requires application/json or multipart/form-data.");

        var boundary = HeaderUtilities.RemoveQuotes(parsed.Boundary).Value;
        if (string.IsNullOrWhiteSpace(boundary))
            throw BadRequest("Host execution multipart body is invalid.");

        var reader = new MultipartReader(boundary, new MemoryStream(body, writable: false));
        byte[]? descriptor = null;
        var files = new Dictionary<int, UploadedFile>();

        while (true)
        {
            MultipartSection? section;
            try
            {
                section = await reader.ReadNextSectionAsync(cancellationToken);
            }
            catch
            {
                throw BadRequest("Host execution multipart body is invalid.");
            }

            if (section is null) break;
            if (!ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var disposition))
                continue;

            var name = HeaderUtilities.RemoveQuotes(disposition.Name).Value ?? string.Empty;
            using var buffer = new MemoryStream();
            await section.Body.CopyToAsync(buffer, cancellationToken);
            var data = buffer.ToArray();

            if (name == "descriptor")
            {
                if (descriptor is not null)
                    throw BadRequest("Host execution multipart request contains multiple descriptors.");
                descriptor = data;
                continue;
            }

            var match = FilePartPattern.Match(name);
            if (!match.Success) continue;

            var index = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
            if (files.ContainsKey(index))
                throw BadRequest($"Host execution multipart request contains duplicate formData[{index}] parts.");

            var fileName = HeaderUtilities.RemoveQuotes(disposition.FileNameStar).Value
                ?? HeaderUtilities.RemoveQuotes(disposition.FileName).Value
                ?? string.Empty;
            var partType = section.ContentType ?? string.Empty;
            ValidateContentType(partType);
            files[index] = new UploadedFile(fileName, partType, data);
        }

        if (descriptor is null)
            throw BadRequest("Host execution multipart request requires a descriptor.");

        return (ParseJsonObject(descriptor, "Host execution multipart descriptor must be valid UTF-8 JSON object."), files);
    }

    private static JsonElement ParseJsonObject(byte[] data, string errorMessage)
    {
        try
        {
            _ = StrictUtf8.GetString(data);
            using var document = JsonDocument.Parse(data);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
                throw BadRequest(errorMessage);
            return document.RootElement.Clone();
        }
        catch (HostExecutionException)
        {
            throw;
        }
        catch (DecoderFallbackException)
        {
            throw BadRequest(errorMessage);
        }
        catch (JsonException)
        {
            throw BadRequest(errorMessage);
        }
    }

    private static async Task<byte[]> ReadLimitedAsync(
        Stream stream,
        int maxBytes,
        CancellationToken cancellationToken,
        bool responseLimit = false)
    {
        using var output = new MemoryStream(Math.Min(maxBytes, 64 * 1024));
        var buffer = ArrayPool<byte>.Shared.Rent(64 * 1024);
        try
        {
            var total = 0;
            while (true)
            {
                var read = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);
                if (read == 0) break;
                total += read;
                if (total > maxBytes)
                    throw responseLimit
                        ? Upstream("Host execution response exceeded the 10 MiB safety limit.")
                        : BadRequest("Host execution request exceeded the 32 MiB safety limit.");
                await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            }
            return output.ToArray();
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    private static async Task<PreparedBody> PrepareBodyAsync(
        JsonElement draft,
        JsonElement envelope,
        IReadOnlyDictionary<int, UploadedFile> files,
        string mode,
        CancellationToken cancellationToken)
    {
        var explicitType = StringValue(draft, "contentType");

        switch (mode)
        {
            case "none":
                return new PreparedBody(null, null);
            case "raw":
                return new PreparedBody(Encoding.UTF8.GetBytes(StringValue(draft, "body")), NullIfEmpty(explicitType));
            case "json":
                return new PreparedBody(
                    Encoding.UTF8.GetBytes(StringValue(draft, "body")),
                    string.IsNullOrEmpty(explicitType) ? "application/json" : explicitType);
            case "binary":
            {
                var encoded = StringValue(envelope, "bodyBase64");
                if (string.IsNullOrEmpty(encoded))
                    throw BadRequest("Binary host execution requires bodyBase64.");
                byte[] data;
                try
                {
                    data = Convert.FromBase64String(encoded);
                }
                catch (FormatException)
                {
                    throw BadRequest("Binary host execution bodyBase64 is invalid.");
                }

                if (string.IsNullOrEmpty(explicitType)
                    && draft.TryGetProperty("binary", out var binary)
                    && binary.ValueKind == JsonValueKind.Object)
                    explicitType = StringValue(binary, "contentType");
                if (string.IsNullOrEmpty(explicitType))
                    explicitType = "application/octet-stream";
                return new PreparedBody(data, explicitType);
            }
            case "urlencoded":
            {
                var pairs = Entries(draft, "urlencoded")
                    .Where(static entry => !ExplicitFalse(entry, "enabled"))
                    .Select(entry => new KeyValuePair<string, string>(StringValue(entry, "key"), StringValue(entry, "value")))
                    .Where(static pair => !string.IsNullOrWhiteSpace(pair.Key))
                    .ToList();
                using var encoded = new FormUrlEncodedContent(pairs);
                var data = await encoded.ReadAsByteArrayAsync(cancellationToken);
                return new PreparedBody(data, string.IsNullOrEmpty(explicitType) ? "application/x-www-form-urlencoded" : explicitType);
            }
            case "graphql":
            {
                if (!draft.TryGetProperty("graphql", out var graph) || graph.ValueKind != JsonValueKind.Object)
                    throw BadRequest("GraphQL body must be an object.");

                object variables = new Dictionary<string, object?>();
                var rawVariables = StringValue(graph, "variables").Trim();
                if (rawVariables.Length > 0)
                {
                    try
                    {
                        using var variableDocument = JsonDocument.Parse(rawVariables);
                        variables = variableDocument.RootElement.Clone();
                    }
                    catch (JsonException)
                    {
                        throw BadRequest("GraphQL variables must be valid JSON.");
                    }
                }

                var data = JsonSerializer.SerializeToUtf8Bytes(new Dictionary<string, object?>
                {
                    ["query"] = StringValue(graph, "query"),
                    ["variables"] = variables,
                });
                return new PreparedBody(data, string.IsNullOrEmpty(explicitType) ? "application/json" : explicitType);
            }
            case "formdata":
            {
                using var multipart = new MultipartFormDataContent();
                var entries = Entries(draft, "formData").ToList();
                for (var index = 0; index < entries.Count; index++)
                {
                    var entry = entries[index];
                    if (ExplicitFalse(entry, "enabled")) continue;
                    var key = StringValue(entry, "key");
                    if (string.IsNullOrWhiteSpace(key)) continue;

                    if (StringValue(entry, "type") == "file")
                    {
                        if (!files.TryGetValue(index, out var file))
                            throw BadRequest($"File field \"{key}\" needs an uploaded file part.");

                        var fileName = file.FileName;
                        if (string.IsNullOrEmpty(fileName)) fileName = StringValue(entry, "fileName");
                        if (string.IsNullOrEmpty(fileName)) fileName = "upload.bin";

                        var contentType = file.ContentType;
                        if (string.IsNullOrEmpty(contentType)) contentType = StringValue(entry, "contentType");
                        if (string.IsNullOrEmpty(contentType)) contentType = "application/octet-stream";
                        ValidateContentType(contentType);

                        var part = new ByteArrayContent(file.Data);
                        part.Headers.TryAddWithoutValidation("Content-Type", contentType);
                        multipart.Add(part, key, fileName);
                    }
                    else
                    {
                        multipart.Add(new StringContent(StringValue(entry, "value"), Encoding.UTF8), key);
                    }
                }

                var data = await multipart.ReadAsByteArrayAsync(cancellationToken);
                return new PreparedBody(data, multipart.Headers.ContentType?.ToString());
            }
            default:
                throw BadRequest($"Body mode {mode} is not implemented by the ASP.NET Core host executor.");
        }
    }

    private static string InferBodyMode(JsonElement draft)
    {
        var explicitMode = StringValue(draft, "bodyMode").Trim();
        if (explicitMode.Length > 0) return explicitMode;
        if (draft.TryGetProperty("binary", out _)) return "binary";
        if (draft.TryGetProperty("formData", out _)) return "formdata";
        if (draft.TryGetProperty("urlencoded", out _)) return "urlencoded";
        if (draft.TryGetProperty("graphql", out _)) return "graphql";
        if (!draft.TryGetProperty("body", out _) || StringValue(draft, "body").Length == 0) return "none";
        return StringValue(draft, "contentType").Contains("json", StringComparison.OrdinalIgnoreCase) ? "json" : "raw";
    }

    private static Dictionary<string, List<string>> SanitizeHeaders(IEnumerable<JsonElement> entries)
    {
        var headers = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in entries)
        {
            if (ExplicitFalse(entry, "enabled")) continue;
            var name = StringValue(entry, "key").Trim();
            if (name.Length == 0) continue;

            var normalized = name.ToLowerInvariant();
            if (IsUnsafeHeaderName(normalized))
                continue;

            var value = StringValue(entry, "value");
            ValidateHeader(name, value);
            AddHeader(headers, name, value);
        }
        return headers;
    }

    private static void ApplyHeaderAuth(JsonElement draft, Dictionary<string, List<string>> headers)
    {
        if (!draft.TryGetProperty("auth", out var auth) || auth.ValueKind != JsonValueKind.Object)
            return;

        var type = StringValue(auth, "type");
        switch (type)
        {
            case "":
            case "none":
            case "inherit":
                return;
            case "bearer":
            {
                var token = StringValue(auth, "token");
                if (token.Length > 0) SetHeader(headers, "Authorization", "Bearer " + token);
                return;
            }
            case "oauth2":
            {
                var token = StringValue(auth, "accessToken");
                if (token.Length > 0) SetHeader(headers, "Authorization", "Bearer " + token);
                return;
            }
            case "basic":
            {
                var credential = StringValue(auth, "username") + ":" + StringValue(auth, "password");
                SetHeader(headers, "Authorization", "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes(credential)));
                return;
            }
            case "apiKey":
            {
                var key = StringValue(auth, "key").Trim();
                if (key.Length == 0)
                    throw BadRequest("API key authentication requires a key name.");

                var location = StringValue(auth, "in");
                if (location.Length == 0) location = "header";
                switch (location)
                {
                    case "header":
                    {
                        if (IsUnsafeHeaderName(key))
                            throw BadRequest($"Unsafe host execution request header: {key}");
                        var value = StringValue(auth, "value");
                        ValidateHeader(key, value);
                        SetHeader(headers, key, value);
                        return;
                    }
                    case "query":
                        return;
                    case "cookie":
                        throw BadRequest("Cookie authentication is not implemented by the ASP.NET Core host executor.");
                    default:
                        throw BadRequest($"Unsupported API key location: {location}");
                }
            }
            default:
                throw BadRequest($"Authentication type {type} is not implemented by the ASP.NET Core host executor.");
        }
    }

    private static Uri ApplyQueryAuth(JsonElement auth, Uri target)
    {
        if (auth.ValueKind != JsonValueKind.Object
            || StringValue(auth, "type") != "apiKey"
            || StringValue(auth, "in") != "query")
            return target;

        var key = StringValue(auth, "key").Trim();
        if (key.Length == 0)
            throw BadRequest("API key authentication requires a key name.");
        return AppendQuery(target, new[] { PairElement(key, StringValue(auth, "value")) });
    }

    private static JsonElement PairElement(string key, string value)
        => JsonSerializer.SerializeToElement(new Dictionary<string, object?> { ["key"] = key, ["value"] = value });

    private static Uri AppendQuery(Uri target, IEnumerable<JsonElement> entries)
    {
        var parts = new List<string>();
        foreach (var entry in entries)
        {
            if (ExplicitFalse(entry, "enabled")) continue;
            var key = StringValue(entry, "key").Trim();
            if (key.Length == 0) continue;
            parts.Add(EncodeQuery(key) + "=" + EncodeQuery(StringValue(entry, "value")));
        }
        if (parts.Count == 0) return target;

        var builder = new UriBuilder(target);
        var existing = builder.Query;
        if (existing.StartsWith('?')) existing = existing[1..];
        builder.Query = existing.Length == 0 ? string.Join("&", parts) : existing + "&" + string.Join("&", parts);
        return builder.Uri;
    }

    private static string EncodeQuery(string value)
        => Uri.EscapeDataString(value).Replace("%20", "+", StringComparison.Ordinal);

    private static IEnumerable<JsonElement> Entries(JsonElement parent, string property)
    {
        if (!parent.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Array)
            yield break;
        foreach (var item in value.EnumerateArray())
            if (item.ValueKind == JsonValueKind.Object)
                yield return item;
    }

    private static string StringValue(JsonElement parent, string property)
        => parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(property, out var value)
            ? StringValue(value)
            : string.Empty;

    private static string StringValue(JsonElement value)
        => value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? string.Empty,
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Number => value.GetRawText(),
            JsonValueKind.Null or JsonValueKind.Undefined => string.Empty,
            _ => value.GetRawText(),
        };

    private static bool ExplicitFalse(JsonElement parent, string property)
        => parent.ValueKind == JsonValueKind.Object
            && parent.TryGetProperty(property, out var value)
            && value.ValueKind == JsonValueKind.False;

    private static TimeSpan DurationMillis(JsonElement parent, string property, TimeSpan fallback)
    {
        if (!parent.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Number)
            return fallback;
        if (!value.TryGetDouble(out var milliseconds) || !double.IsFinite(milliseconds))
            return fallback;
        if (milliseconds < MinimumTimeout.TotalMilliseconds)
            return MinimumTimeout;
        if (milliseconds > MaximumTimeout.TotalMilliseconds)
            return MaximumTimeout;
        return TimeSpan.FromMilliseconds(milliseconds);
    }

    private static void ApplyHeaders(HttpRequestMessage request, Dictionary<string, List<string>> headers)
    {
        foreach (var pair in headers)
        {
            if (pair.Key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase))
            {
                if (request.Content is not null)
                {
                    request.Content.Headers.Remove("Content-Type");
                    request.Content.Headers.TryAddWithoutValidation("Content-Type", pair.Value);
                }
                continue;
            }

            if (!request.Headers.TryAddWithoutValidation(pair.Key, pair.Value) && request.Content is not null)
                request.Content.Headers.TryAddWithoutValidation(pair.Key, pair.Value);
        }
    }

    private static Dictionary<string, List<string>> CloneHeaders(Dictionary<string, List<string>> source)
        => source.ToDictionary(static pair => pair.Key, static pair => pair.Value.ToList(), StringComparer.OrdinalIgnoreCase);

    private static void AddHeader(Dictionary<string, List<string>> headers, string name, string value)
    {
        ValidateHeader(name, value);
        if (!headers.TryGetValue(name, out var values))
        {
            values = new List<string>();
            headers[name] = values;
        }
        values.Add(value);
    }

    private static void SetHeader(Dictionary<string, List<string>> headers, string name, string value)
    {
        ValidateHeader(name, value);
        headers[name] = new List<string> { value };
    }

    private static bool IsUnsafeHeaderName(string name)
    {
        var normalized = name.Trim().ToLowerInvariant();
        return UnsafeHeaders.Contains(normalized)
            || normalized.StartsWith("proxy-", StringComparison.Ordinal)
            || normalized.StartsWith("sec-", StringComparison.Ordinal)
            || normalized is "origin" or "referer";
    }

    private static void ValidateHeader(string name, string value)
    {
        if (!HeaderNamePattern.IsMatch(name) || value.Contains('\r') || value.Contains('\n'))
            throw BadRequest($"Invalid host execution request header: {name}");
    }

    private static void ValidateContentType(string? value)
    {
        if (string.IsNullOrEmpty(value)) return;
        if (value.Contains('\r') || value.Contains('\n') || !MediaTypeHeaderValue.TryParse(value, out _))
            throw BadRequest("Invalid host execution content type.");
    }

    private static bool TryParseHttpUri(string raw, out Uri uri)
    {
        if (Uri.TryCreate(raw, UriKind.Absolute, out var parsed) && IsHttpUri(parsed))
        {
            uri = parsed;
            return true;
        }
        uri = null!;
        return false;
    }

    private static bool IsHttpUri(Uri uri)
        => uri.IsAbsoluteUri
            && (uri.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
                || uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            && !string.IsNullOrEmpty(uri.Host);

    private static string OriginOf(Uri target)
    {
        var scheme = target.Scheme.ToLowerInvariant();
        var host = target.IdnHost.ToLowerInvariant();
        if (IPAddress.TryParse(host, out var ip) && ip.AddressFamily == AddressFamily.InterNetworkV6)
            host = "[" + host.Trim('[', ']') + "]";
        var port = target.IsDefaultPort ? string.Empty : ":" + target.Port.ToString(CultureInfo.InvariantCulture);
        return scheme + "://" + host + port;
    }

    private static bool IsMetadataHost(string host)
    {
        var value = host.Trim('[', ']').ToLowerInvariant();
        if (value is "169.254.169.254" or "metadata.google.internal" or "metadata.google" or "fe80::a9fe:a9fe")
            return true;
        return IPAddress.TryParse(value, out var address) && IsMetadataAddress(address);
    }

    private static bool IsMetadataAddress(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
            return IsMetadataAddress(address.MapToIPv4());

        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            var bytes = address.GetAddressBytes();
            return bytes.Length == 4 && bytes[0] == 169 && bytes[1] == 254;
        }

        return address.AddressFamily == AddressFamily.InterNetworkV6 && address.IsIPv6LinkLocal;
    }

    private static bool IsRedirect(HttpStatusCode status)
        => status is HttpStatusCode.MovedPermanently
            or HttpStatusCode.Found
            or HttpStatusCode.SeeOther
            or HttpStatusCode.TemporaryRedirect
            or HttpStatusCode.PermanentRedirect;

    private static HostExecutionException? FindHostExecutionException(Exception error)
    {
        for (Exception? current = error; current is not null; current = current.InnerException)
            if (current is HostExecutionException hostError)
                return hostError;
        return null;
    }

    private static string? NullIfEmpty(string value) => value.Length == 0 ? null : value;

    private static HostExecutionException BadRequest(string message)
        => new(StatusCodes.Status400BadRequest, message);

    private static HostExecutionException Forbidden(string message)
        => new(StatusCodes.Status403Forbidden, message);

    private static HostExecutionException Upstream(string message)
        => new(StatusCodes.Status502BadGateway, message);

    private static async Task WriteJsonAsync(HttpContext context, int statusCode, object body)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.Headers.CacheControl = "no-store";
        await JsonSerializer.SerializeAsync(context.Response.Body, body, cancellationToken: context.RequestAborted);
    }

    private sealed record PreparedBody(byte[]? Data, string? ContentType);
    private sealed record UploadedFile(string FileName, string ContentType, byte[] Data);

    private sealed class HostExecutionException(int statusCode, string message) : Exception(message)
    {
        public int StatusCode { get; } = statusCode;
    }
}
