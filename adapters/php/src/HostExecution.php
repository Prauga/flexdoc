<?php

declare(strict_types=1);

namespace Prauga\FlexDoc;

/**
 * Framework-neutral implementation of FlexDoc's existing API-host execution envelope.
 *
 * This first PHP slice intentionally advertises no host-only capabilities.
 */
final class HostExecution
{
    public const MAX_REQUEST_BYTES = 32 * 1024 * 1024;
    public const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

    private const DEFAULT_TIMEOUT_MS = 30_000;
    private const MIN_TIMEOUT_MS = 100;
    private const MAX_TIMEOUT_MS = 120_000;
    private const MAX_REDIRECTS = 5;

    /** @var array<string, true> */
    private array $allowedOrigins = [];

    /** @var array<string, true> */
    private const UNSAFE_HEADERS = [
        'connection' => true,
        'keep-alive' => true,
        'proxy-authenticate' => true,
        'proxy-authorization' => true,
        'te' => true,
        'trailer' => true,
        'transfer-encoding' => true,
        'upgrade' => true,
        'host' => true,
        'content-length' => true,
        'set-cookie' => true,
        'origin' => true,
        'referer' => true,
    ];

    /** @var array<string, true> */
    private const METADATA_HOSTS = [
        '169.254.169.254' => true,
        'metadata.google.internal' => true,
        'metadata.google' => true,
    ];

    /**
     * @param list<string> $allowedOrigins Exact HTTP(S) origins the host may call.
     */
    public function __construct(array $allowedOrigins)
    {
        foreach ($allowedOrigins as $raw) {
            $raw = trim((string) $raw);
            if ($raw === '') continue;
            $parts = self::parseHttpUrl($raw, "host execution allowed origin {$raw} must be an absolute HTTP(S) origin");
            if (($parts['user'] ?? null) !== null
                || ($parts['pass'] ?? null) !== null
                || !in_array($parts['path'] ?? '', ['', '/'], true)
                || isset($parts['query'])
                || isset($parts['fragment'])) {
                throw new \InvalidArgumentException("host execution allowed origins cannot contain credentials, paths, queries, or fragments: {$raw}");
            }
            $this->allowedOrigins[self::originOf($parts)] = true;
        }

        if ($this->allowedOrigins === []) {
            throw new \InvalidArgumentException('FlexDoc host execution requires at least one exact allowed origin');
        }
    }

    /** @return list<string> Host-only capabilities implemented by this first PHP slice. */
    public function capabilities(): array
    {
        return [];
    }

    /**
     * Validate the execute marker and run one already-decoded canonical envelope.
     *
     * @param mixed $envelope
     * @param array<int, array{filename?: string, contentType?: string, data: string}> $files
     * @return array{status: int, body: array<string, mixed>}
     */
    public function handle(?string $marker, mixed $envelope, array $files = []): array
    {
        if ($marker !== '1') {
            return ['status' => 403, 'body' => ['error' => 'Missing X-FlexDoc-Execute header.']];
        }

        try {
            if (!is_array($envelope)) {
                throw new HostExecutionException(400, 'Host execution body must be a JSON object.');
            }
            return ['status' => 200, 'body' => $this->execute($envelope, $files)];
        } catch (HostExecutionException $error) {
            return ['status' => $error->status, 'body' => ['error' => $error->getMessage()]];
        }
    }

    /**
     * @param array<string, mixed> $envelope
     * @param array<int, array{filename?: string, contentType?: string, data: string}> $files
     * @return array<string, mixed>
     */
    private function execute(array $envelope, array $files): array
    {
        if (($envelope['cookieJar'] ?? null) === 'session') {
            throw new HostExecutionException(400, 'Session cookie jars are not implemented by the PHP host executor.');
        }
        if (trim(self::stringValue($envelope['certificateId'] ?? null)) !== '') {
            throw new HostExecutionException(400, 'Client certificates are not implemented by the PHP host executor.');
        }

        $draft = $envelope['request'] ?? null;
        if (!is_array($draft)) {
            throw new HostExecutionException(400, 'Host execution body requires a canonical request draft.');
        }

        $rawUrl = self::stringValue($draft['url'] ?? null);
        if (trim($rawUrl) === '') {
            throw new HostExecutionException(400, 'Host execution requires an absolute request URL.');
        }
        try {
            $target = self::parseHttpUrl($rawUrl, 'Host execution requires an absolute HTTP(S) request URL.');
        } catch (\InvalidArgumentException) {
            throw new HostExecutionException(400, 'Host execution requires an absolute HTTP(S) request URL.');
        }
        if (isset($target['user']) || isset($target['pass'])) {
            throw new HostExecutionException(403, 'Host execution URLs cannot contain embedded credentials.');
        }

        $targetUrl = self::urlFromParts($target);
        $targetUrl = self::appendQueryEntries($targetUrl, self::entries($draft['query'] ?? null));

        $method = strtoupper(trim(self::stringValue($draft['method'] ?? null)));
        if ($method === '') $method = 'GET';
        if (!in_array($method, ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], true)) {
            throw new HostExecutionException(400, "Unsupported host execution HTTP method: {$method}");
        }

        $headers = self::sanitizeHeaders(self::entries($draft['headers'] ?? null));
        $headers = self::applyHeaderAuth($headers, $draft['auth'] ?? null);
        $mode = self::inferBodyMode($draft);
        [$body, $contentType] = self::prepareBody($draft, $envelope, $files, $mode);
        if ($mode === 'formdata') unset($headers['content-type']);
        if ($contentType !== null && !isset($headers['content-type'])) {
            $headers['content-type'] = [$contentType];
        }

        $timeoutMs = self::integerValue($envelope['timeoutMs'] ?? null, self::DEFAULT_TIMEOUT_MS);
        $timeoutMs = max(self::MIN_TIMEOUT_MS, min(self::MAX_TIMEOUT_MS, $timeoutMs));
        $deadline = self::monotonicMs() + $timeoutMs;

        return $this->executeWithRedirects($method, $targetUrl, $headers, $body, $draft['auth'] ?? null, $deadline, $timeoutMs, 0);
    }

    /**
     * @param array<string, list<string>> $headers
     * @return array<string, mixed>
     */
    private function executeWithRedirects(
        string $method,
        string $currentUrl,
        array $headers,
        string $body,
        mixed $auth,
        int $deadline,
        int $timeoutMs,
        int $redirectCount,
    ): array {
        if ($deadline - self::monotonicMs() <= 0) {
            throw new HostExecutionException(502, "Host execution request timed out after {$timeoutMs} ms.");
        }

        $requestUrl = self::applyQueryAuth($currentUrl, $auth);
        $target = $this->assertAllowed($requestUrl);
        $started = self::monotonicMs();
        $response = $this->performRequest($method, $target, $headers, $body, $deadline, $timeoutMs);

        $location = self::headerValue($response['headers'], 'location');
        if (self::isRedirect($response['status']) && $location !== null && $location !== '') {
            if ($redirectCount >= self::MAX_REDIRECTS) {
                throw new HostExecutionException(403, 'Host execution exceeded the redirect safety limit.');
            }

            $next = self::resolveRedirect($requestUrl, $location);
            $nextParts = self::parseHttpUrl($next, 'Host execution received an invalid redirect URL.');
            if (self::originOf($nextParts) !== self::originOf($target['parts'])) {
                throw new HostExecutionException(403, 'Host execution does not follow cross-origin redirects.');
            }
            $this->assertAllowed($next);

            if ($response['status'] === 303) {
                $method = 'GET';
                $body = '';
                unset($headers['content-type']);
            }

            return $this->executeWithRedirects(
                $method,
                $next,
                $headers,
                $body,
                $auth,
                $deadline,
                $timeoutMs,
                $redirectCount + 1,
            );
        }

        $payload = $response['body'];
        $snapshot = [
            'status' => $response['status'],
            'statusText' => $response['reason'],
            'headers' => array_map(static fn (array $pair): array => [$pair[0], $pair[1]], $response['headers']),
            'body' => self::validUtf8($payload) ? $payload : base64_encode($payload),
            'responseTime' => max(self::monotonicMs() - $started, 0),
        ];
        if (!self::validUtf8($payload)) $snapshot['bodyEncoding'] = 'base64';
        return $snapshot;
    }

    /**
     * @param array{parts: array<string, mixed>, addresses: list<string>} $target
     * @param array<string, list<string>> $headers
     * @return array{status: int, reason: string, headers: list<array{0: string, 1: string}>, body: string}
     */
    private function performRequest(
        string $method,
        array $target,
        array $headers,
        string $body,
        int $deadline,
        int $timeoutMs,
    ): array {
        $parts = $target['parts'];
        $host = (string) $parts['host'];
        $scheme = strtolower((string) $parts['scheme']);
        $port = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);
        if ($target['addresses'] === []) {
            throw new HostExecutionException(502, 'Host execution could not resolve target hostname.');
        }

        $contextOptions = [];
        if ($scheme === 'https') {
            $contextOptions['ssl'] = [
                'verify_peer' => true,
                'verify_peer_name' => true,
                'peer_name' => $host,
                'SNI_enabled' => true,
            ];
        }
        $transport = $scheme === 'https' ? 'tls' : 'tcp';
        $socket = false;
        $lastError = '';

        foreach ($target['addresses'] as $address) {
            $remainingMs = $deadline - self::monotonicMs();
            if ($remainingMs <= 0) {
                throw new HostExecutionException(502, "Host execution request timed out after {$timeoutMs} ms.");
            }
            $context = stream_context_create($contextOptions);
            $connectHost = str_contains($address, ':') ? '[' . trim($address, '[]') . ']' : $address;
            $errno = 0;
            $errstr = '';
            $candidate = @stream_socket_client(
                "{$transport}://{$connectHost}:{$port}",
                $errno,
                $errstr,
                max($remainingMs / 1000, 0.001),
                STREAM_CLIENT_CONNECT,
                $context,
            );
            if (is_resource($candidate)) {
                $socket = $candidate;
                break;
            }
            $lastError = trim($errstr) !== '' ? $errstr : "socket error {$errno}";
        }

        if (!is_resource($socket)) {
            if (self::monotonicMs() >= $deadline) {
                throw new HostExecutionException(502, "Host execution request timed out after {$timeoutMs} ms.");
            }
            $detail = $lastError !== '' ? $lastError : 'connection failed';
            throw new HostExecutionException(502, "Host execution request failed: {$detail}");
        }

        try {
            self::applyStreamDeadline($socket, $deadline, $timeoutMs);
            $path = (string) ($parts['path'] ?? '');
            if ($path === '') $path = '/';
            $requestTarget = $path;
            if (isset($parts['query']) && $parts['query'] !== '') $requestTarget .= '?' . $parts['query'];

            $requestHeaders = $headers;
            $requestHeaders['host'] = [self::hostHeader($parts)];
            $requestHeaders['connection'] = ['close'];
            $hasEntity = $body !== '' || !in_array($method, ['GET', 'HEAD'], true);
            if ($hasEntity) $requestHeaders['content-length'] = [(string) strlen($body)];

            $head = "{$method} {$requestTarget} HTTP/1.1\r\n";
            foreach ($requestHeaders as $name => $values) {
                $displayName = self::displayHeaderName($name);
                foreach ($values as $value) $head .= $displayName . ': ' . $value . "\r\n";
            }
            $head .= "\r\n";
            self::writeAll($socket, $head . ($hasEntity ? $body : ''), $deadline, $timeoutMs);

            $statusLine = self::readLine($socket, $deadline, $timeoutMs);
            if (!preg_match('/^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s+(.*))?$/', rtrim($statusLine, "\r\n"), $match)) {
                throw new HostExecutionException(502, 'Host execution received an invalid HTTP response.');
            }
            $status = (int) $match[1];
            $reason = trim((string) ($match[2] ?? ''));

            $responseHeaders = [];
            while (true) {
                $line = self::readLine($socket, $deadline, $timeoutMs);
                if ($line === "\r\n" || $line === "\n" || $line === '') break;
                $colon = strpos($line, ':');
                if ($colon === false) continue;
                $name = strtolower(trim(substr($line, 0, $colon)));
                $value = trim(substr($line, $colon + 1));
                $responseHeaders[] = [$name, $value];
            }

            $responseBody = '';
            if ($method !== 'HEAD' && !in_array($status, [204, 304], true) && !($status >= 100 && $status < 200)) {
                $transferEncoding = strtolower((string) self::headerValue($responseHeaders, 'transfer-encoding'));
                $contentLength = self::headerValue($responseHeaders, 'content-length');
                if (str_contains($transferEncoding, 'chunked')) {
                    $responseBody = self::readChunkedBody($socket, $deadline, $timeoutMs);
                } elseif ($contentLength !== null && ctype_digit(trim($contentLength))) {
                    $length = (int) trim($contentLength);
                    if ($length > self::MAX_RESPONSE_BYTES) {
                        throw new HostExecutionException(502, 'Host execution response exceeded the 10 MiB safety limit.');
                    }
                    $responseBody = self::readExact($socket, $length, $deadline, $timeoutMs);
                } else {
                    $responseBody = self::readToEof($socket, $deadline, $timeoutMs);
                }
            }

            return ['status' => $status, 'reason' => $reason, 'headers' => $responseHeaders, 'body' => $responseBody];
        } finally {
            fclose($socket);
        }
    }

    /**
     * @return array{parts: array<string, mixed>, addresses: list<string>}
     */
    private function assertAllowed(string $url): array
    {
        try {
            $parts = self::parseHttpUrl($url, 'Host execution only allows HTTP(S) URLs.');
        } catch (\InvalidArgumentException) {
            throw new HostExecutionException(403, 'Host execution only allows HTTP(S) URLs.');
        }
        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new HostExecutionException(403, 'Host execution URLs cannot contain embedded credentials.');
        }

        $origin = self::originOf($parts);
        if (!isset($this->allowedOrigins[$origin])) {
            throw new HostExecutionException(403, "Origin {$origin} is not allowed for host execution.");
        }

        $host = strtolower(trim((string) $parts['host'], '[]'));
        if (isset(self::METADATA_HOSTS[$host]) || self::isMetadataAddress($host)) {
            throw new HostExecutionException(403, 'Host execution blocks link-local and cloud metadata endpoints.');
        }

        $addresses = self::resolveAddresses($host);
        if ($addresses === []) {
            throw new HostExecutionException(502, 'Host execution could not resolve target hostname.');
        }
        foreach ($addresses as $address) {
            if (self::isMetadataAddress($address)) {
                throw new HostExecutionException(403, 'Host execution blocks DNS resolutions to link-local and cloud metadata endpoints.');
            }
        }

        return ['parts' => $parts, 'addresses' => $addresses];
    }

    /** @return list<string> */
    private static function resolveAddresses(string $host): array
    {
        if (filter_var($host, FILTER_VALIDATE_IP) !== false) return [$host];

        $addresses = [];
        $records = @dns_get_record($host, DNS_A | DNS_AAAA);
        if (is_array($records)) {
            foreach ($records as $record) {
                if (isset($record['ip'])) $addresses[] = (string) $record['ip'];
                if (isset($record['ipv6'])) $addresses[] = (string) $record['ipv6'];
            }
        }
        if ($addresses === []) {
            $ipv4 = @gethostbynamel($host);
            if (is_array($ipv4)) $addresses = array_merge($addresses, $ipv4);
        }
        return array_values(array_unique($addresses));
    }

    private static function isMetadataAddress(string $address): bool
    {
        $packed = @inet_pton(trim($address, '[]'));
        if ($packed === false) return false;
        if (strlen($packed) === 4) {
            $bytes = unpack('C4', $packed);
            return ($bytes[1] ?? -1) === 169 && ($bytes[2] ?? -1) === 254;
        }
        if (strlen($packed) === 16) {
            $first = unpack('nfirst', substr($packed, 0, 2));
            return (((int) ($first['first'] ?? 0)) & 0xffc0) === 0xfe80;
        }
        return false;
    }

    /**
     * @param list<array<string, mixed>> $entries
     * @return array<string, list<string>>
     */
    private static function sanitizeHeaders(array $entries): array
    {
        $headers = [];
        foreach ($entries as $entry) {
            if (($entry['enabled'] ?? true) === false) continue;
            $name = trim(self::stringValue($entry['key'] ?? null));
            if ($name === '') continue;
            $normalized = strtolower($name);
            if (isset(self::UNSAFE_HEADERS[$normalized]) || str_starts_with($normalized, 'proxy-') || str_starts_with($normalized, 'sec-')) continue;
            $value = self::stringValue($entry['value'] ?? null);
            if (!preg_match("/^[!#$%&'*+\\-.^_`|~0-9A-Za-z]+$/", $name) || str_contains($value, "\r") || str_contains($value, "\n")) {
                throw new HostExecutionException(400, "Invalid host execution request header: {$name}");
            }
            $headers[$normalized] ??= [];
            $headers[$normalized][] = $value;
        }
        return $headers;
    }

    /**
     * @param array<string, list<string>> $headers
     * @return array<string, list<string>>
     */
    private static function applyHeaderAuth(array $headers, mixed $raw): array
    {
        $auth = is_array($raw) ? $raw : [];
        $type = self::stringValue($auth['type'] ?? null);
        if (in_array($type, ['', 'none', 'inherit'], true)) return $headers;
        if ($type === 'bearer') {
            $token = self::stringValue($auth['token'] ?? null);
            if ($token !== '') $headers['authorization'] = ["Bearer {$token}"];
            return $headers;
        }
        if ($type === 'oauth2') {
            $token = self::stringValue($auth['accessToken'] ?? null);
            if ($token !== '') $headers['authorization'] = ["Bearer {$token}"];
            return $headers;
        }
        if ($type === 'basic') {
            $credential = self::stringValue($auth['username'] ?? null) . ':' . self::stringValue($auth['password'] ?? null);
            $headers['authorization'] = ['Basic ' . base64_encode($credential)];
            return $headers;
        }
        if ($type === 'apiKey') {
            $key = trim(self::stringValue($auth['key'] ?? null));
            if ($key === '') throw new HostExecutionException(400, 'API key authentication requires a key name.');
            $location = self::stringValue($auth['in'] ?? null) ?: 'header';
            if ($location === 'query') return $headers;
            if ($location === 'cookie') throw new HostExecutionException(400, 'Cookie authentication is not implemented by the PHP host executor.');
            if ($location !== 'header') throw new HostExecutionException(400, "Unsupported API key location: {$location}");
            if (!preg_match("/^[!#$%&'*+\\-.^_`|~0-9A-Za-z]+$/", $key)) {
                throw new HostExecutionException(400, "Invalid host execution request header: {$key}");
            }
            $headers[strtolower($key)] = [self::stringValue($auth['value'] ?? null)];
            return $headers;
        }
        throw new HostExecutionException(400, "Authentication type {$type} is not implemented by the PHP host executor.");
    }

    private static function applyQueryAuth(string $url, mixed $raw): string
    {
        $auth = is_array($raw) ? $raw : [];
        if (self::stringValue($auth['type'] ?? null) !== 'apiKey' || self::stringValue($auth['in'] ?? null) !== 'query') return $url;
        $key = trim(self::stringValue($auth['key'] ?? null));
        if ($key === '') throw new HostExecutionException(400, 'API key authentication requires a key name.');
        return self::appendQueryPair($url, $key, self::stringValue($auth['value'] ?? null));
    }

    /**
     * @param array<string, mixed> $draft
     * @param array<string, mixed> $envelope
     * @param array<int, array{filename?: string, contentType?: string, data: string}> $files
     * @return array{0: string, 1: string|null}
     */
    private static function prepareBody(array $draft, array $envelope, array $files, string $mode): array
    {
        $explicitType = self::stringValue($draft['contentType'] ?? null);
        return match ($mode) {
            'none' => ['', null],
            'raw' => [self::stringValue($draft['body'] ?? null), $explicitType !== '' ? $explicitType : null],
            'json' => [self::stringValue($draft['body'] ?? null), $explicitType !== '' ? $explicitType : 'application/json'],
            'binary' => self::prepareBinaryBody($draft, $envelope, $explicitType),
            'urlencoded' => self::prepareUrlEncodedBody($draft, $explicitType),
            'graphql' => self::prepareGraphqlBody($draft, $explicitType),
            'formdata' => self::prepareMultipartBody($draft, $files),
            default => throw new HostExecutionException(400, "Body mode {$mode} is not implemented by the PHP host executor."),
        };
    }

    /** @return array{0: string, 1: string} */
    private static function prepareBinaryBody(array $draft, array $envelope, string $explicitType): array
    {
        $encoded = self::stringValue($envelope['bodyBase64'] ?? null);
        if ($encoded === '') throw new HostExecutionException(400, 'Binary host execution requires bodyBase64.');
        $data = base64_decode($encoded, true);
        if ($data === false) throw new HostExecutionException(400, 'Binary host execution bodyBase64 is invalid.');
        $binary = is_array($draft['binary'] ?? null) ? $draft['binary'] : [];
        $contentType = $explicitType ?: (self::stringValue($binary['contentType'] ?? null) ?: 'application/octet-stream');
        return [$data, $contentType];
    }

    /** @return array{0: string, 1: string} */
    private static function prepareUrlEncodedBody(array $draft, string $explicitType): array
    {
        $pairs = [];
        foreach (self::entries($draft['urlencoded'] ?? null) as $entry) {
            if (($entry['enabled'] ?? true) === false) continue;
            $key = trim(self::stringValue($entry['key'] ?? null));
            if ($key === '') continue;
            $pairs[] = urlencode($key) . '=' . urlencode(self::stringValue($entry['value'] ?? null));
        }
        return [implode('&', $pairs), $explicitType ?: 'application/x-www-form-urlencoded'];
    }

    /** @return array{0: string, 1: string} */
    private static function prepareGraphqlBody(array $draft, string $explicitType): array
    {
        $graphql = $draft['graphql'] ?? null;
        if (!is_array($graphql)) throw new HostExecutionException(400, 'GraphQL body must be an object.');
        $variablesText = trim(self::stringValue($graphql['variables'] ?? null));
        if ($variablesText === '') {
            $variables = (object) [];
        } else {
            try {
                $variables = json_decode($variablesText, true, flags: JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                throw new HostExecutionException(400, 'GraphQL variables must be valid JSON.');
            }
        }
        return [
            json_encode(['query' => self::stringValue($graphql['query'] ?? null), 'variables' => $variables], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            $explicitType ?: 'application/json',
        ];
    }

    /**
     * @param array<int, array{filename?: string, contentType?: string, data: string}> $files
     * @return array{0: string, 1: string}
     */
    private static function prepareMultipartBody(array $draft, array $files): array
    {
        $boundary = '----flexdoc-php-' . bin2hex(random_bytes(12));
        $body = '';
        foreach (self::entries($draft['formData'] ?? null) as $index => $entry) {
            if (($entry['enabled'] ?? true) === false) continue;
            $key = trim(self::stringValue($entry['key'] ?? null));
            if ($key === '') continue;
            $body .= "--{$boundary}\r\n";
            if (self::stringValue($entry['type'] ?? null) === 'file') {
                $file = $files[$index] ?? null;
                if (!is_array($file) || !array_key_exists('data', $file)) {
                    throw new HostExecutionException(400, "Host execution multipart file formData[{$index}] is missing.");
                }
                $filename = self::stringValue($file['filename'] ?? null) ?: (self::stringValue($entry['fileName'] ?? null) ?: 'upload.bin');
                $contentType = self::stringValue($file['contentType'] ?? null) ?: (self::stringValue($entry['contentType'] ?? null) ?: 'application/octet-stream');
                $body .= 'Content-Disposition: form-data; name="' . self::quoteMultipart($key) . '"; filename="' . self::quoteMultipart($filename) . "\"\r\n";
                $body .= "Content-Type: {$contentType}\r\n\r\n";
                $body .= (string) $file['data'] . "\r\n";
            } else {
                $body .= 'Content-Disposition: form-data; name="' . self::quoteMultipart($key) . "\"\r\n\r\n";
                $body .= self::stringValue($entry['value'] ?? null) . "\r\n";
            }
        }
        $body .= "--{$boundary}--\r\n";
        return [$body, "multipart/form-data; boundary={$boundary}"];
    }

    private static function inferBodyMode(array $draft): string
    {
        $explicit = trim(self::stringValue($draft['bodyMode'] ?? null));
        if ($explicit !== '') return $explicit;
        if (array_key_exists('binary', $draft)) return 'binary';
        if (array_key_exists('formData', $draft)) return 'formdata';
        if (array_key_exists('urlencoded', $draft)) return 'urlencoded';
        if (array_key_exists('graphql', $draft)) return 'graphql';
        if (self::stringValue($draft['body'] ?? null) === '') return 'none';
        if (str_contains(strtolower(self::stringValue($draft['contentType'] ?? null)), 'json')) return 'json';
        return 'raw';
    }

    /** @param list<array<string, mixed>> $entries */
    private static function appendQueryEntries(string $url, array $entries): string
    {
        foreach ($entries as $entry) {
            if (($entry['enabled'] ?? true) === false) continue;
            $key = trim(self::stringValue($entry['key'] ?? null));
            if ($key === '') continue;
            $url = self::appendQueryPair($url, $key, self::stringValue($entry['value'] ?? null));
        }
        return $url;
    }

    private static function appendQueryPair(string $url, string $key, string $value): string
    {
        $parts = self::parseHttpUrl($url, 'Host execution requires an absolute HTTP(S) request URL.');
        $pair = urlencode($key) . '=' . urlencode($value);
        $parts['query'] = isset($parts['query']) && $parts['query'] !== '' ? $parts['query'] . '&' . $pair : $pair;
        return self::urlFromParts($parts);
    }

    private static function resolveRedirect(string $baseUrl, string $location): string
    {
        $location = trim($location);
        if ($location === '') throw new HostExecutionException(400, 'Host execution received an invalid redirect URL.');
        if (preg_match('#^https?://#i', $location)) return $location;

        $base = self::parseHttpUrl($baseUrl, 'Host execution received an invalid redirect URL.');
        $origin = self::originOf($base);
        if (str_starts_with($location, '//')) return strtolower((string) $base['scheme']) . ':' . $location;
        if (str_starts_with($location, '/')) return $origin . $location;
        if (str_starts_with($location, '?')) {
            $path = (string) ($base['path'] ?? '/');
            return $origin . ($path !== '' ? $path : '/') . $location;
        }

        $path = (string) ($base['path'] ?? '/');
        $slash = strrpos($path, '/');
        $directory = str_ends_with($path, '/') ? $path : substr($path, 0, $slash === false ? 0 : $slash + 1);
        $combined = $directory . $location;
        $query = '';
        $queryAt = strpos($combined, '?');
        if ($queryAt !== false) {
            $query = substr($combined, $queryAt);
            $combined = substr($combined, 0, $queryAt);
        }
        $segments = [];
        foreach (explode('/', $combined) as $segment) {
            if ($segment === '' || $segment === '.') continue;
            if ($segment === '..') { array_pop($segments); continue; }
            $segments[] = $segment;
        }
        return $origin . '/' . implode('/', $segments) . $query;
    }

    /** @return array<string, mixed> */
    private static function parseHttpUrl(string $url, string $message): array
    {
        $parts = @parse_url($url);
        if (!is_array($parts) || !isset($parts['scheme'], $parts['host']) || !in_array(strtolower((string) $parts['scheme']), ['http', 'https'], true) || trim((string) $parts['host']) === '') {
            throw new \InvalidArgumentException($message);
        }
        $parts['scheme'] = strtolower((string) $parts['scheme']);
        return $parts;
    }

    /** @param array<string, mixed> $parts */
    private static function originOf(array $parts): string
    {
        $scheme = strtolower((string) $parts['scheme']);
        $host = strtolower(trim((string) $parts['host'], '[]'));
        if (str_contains($host, ':')) $host = '[' . $host . ']';
        $port = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);
        $default = $scheme === 'https' ? 443 : 80;
        return $scheme . '://' . $host . ($port === $default ? '' : ':' . $port);
    }

    /** @param array<string, mixed> $parts */
    private static function urlFromParts(array $parts): string
    {
        $url = self::originOf($parts);
        $path = (string) ($parts['path'] ?? '');
        if ($path !== '') $url .= $path;
        if (isset($parts['query'])) $url .= '?' . $parts['query'];
        if (isset($parts['fragment'])) $url .= '#' . $parts['fragment'];
        return $url;
    }

    /** @param array<string, mixed> $parts */
    private static function hostHeader(array $parts): string
    {
        $scheme = strtolower((string) $parts['scheme']);
        $host = trim((string) $parts['host'], '[]');
        if (str_contains($host, ':')) $host = '[' . $host . ']';
        $port = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);
        $default = $scheme === 'https' ? 443 : 80;
        return $host . ($port === $default ? '' : ':' . $port);
    }

    /** @param list<array{0: string, 1: string}> $headers */
    private static function headerValue(array $headers, string $name): ?string
    {
        $needle = strtolower($name);
        foreach ($headers as $pair) if (strtolower($pair[0]) === $needle) return $pair[1];
        return null;
    }

    /** @return list<array<string, mixed>> */
    private static function entries(mixed $value): array
    {
        if (!is_array($value)) return [];
        return array_values(array_filter($value, 'is_array'));
    }

    private static function stringValue(mixed $value): string
    {
        if ($value === null) return '';
        if (is_string($value)) return $value;
        if (is_bool($value)) return $value ? 'true' : 'false';
        if (is_int($value) || is_float($value)) return (string) $value;
        return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private static function integerValue(mixed $value, int $fallback): int
    {
        if (is_int($value)) return $value;
        if (is_numeric($value) && (string) (int) $value === trim((string) $value)) return (int) $value;
        return $fallback;
    }

    private static function quoteMultipart(string $value): string
    {
        return str_replace(["\\", '"', "\r", "\n"], ["\\\\", '\\"', '', ''], $value);
    }

    private static function displayHeaderName(string $name): string
    {
        return implode('-', array_map('ucfirst', explode('-', strtolower($name))));
    }

    private static function isRedirect(int $status): bool
    {
        return in_array($status, [301, 302, 303, 307, 308], true);
    }

    private static function monotonicMs(): int
    {
        return intdiv(hrtime(true), 1_000_000);
    }

    /** @param resource $stream */
    private static function applyStreamDeadline($stream, int $deadline, int $timeoutMs): void
    {
        $remainingMs = $deadline - self::monotonicMs();
        if ($remainingMs <= 0) throw new HostExecutionException(502, "Host execution request timed out after {$timeoutMs} ms.");
        $seconds = intdiv($remainingMs, 1000);
        $microseconds = ($remainingMs % 1000) * 1000;
        stream_set_timeout($stream, $seconds, $microseconds);
    }

    /** @param resource $stream */
    private static function writeAll($stream, string $data, int $deadline, int $timeoutMs): void
    {
        $offset = 0;
        $length = strlen($data);
        while ($offset < $length) {
            self::applyStreamDeadline($stream, $deadline, $timeoutMs);
            $written = @fwrite($stream, substr($data, $offset));
            if ($written === false || $written === 0) {
                self::throwStreamFailure($stream, $deadline, $timeoutMs, 'Host execution request write failed.');
            }
            $offset += $written;
        }
    }

    /** @param resource $stream */
    private static function readLine($stream, int $deadline, int $timeoutMs): string
    {
        self::applyStreamDeadline($stream, $deadline, $timeoutMs);
        $line = @fgets($stream);
        if ($line === false) self::throwStreamFailure($stream, $deadline, $timeoutMs, 'Host execution response read failed.');
        return $line;
    }

    /** @param resource $stream */
    private static function readExact($stream, int $length, int $deadline, int $timeoutMs): string
    {
        $body = '';
        while (strlen($body) < $length) {
            self::applyStreamDeadline($stream, $deadline, $timeoutMs);
            $chunk = @fread($stream, min(65_536, $length - strlen($body)));
            if ($chunk === false || ($chunk === '' && !feof($stream))) {
                self::throwStreamFailure($stream, $deadline, $timeoutMs, 'Host execution response read failed.');
            }
            if ($chunk === '' && feof($stream)) break;
            $body .= $chunk;
            if (strlen($body) > self::MAX_RESPONSE_BYTES) {
                throw new HostExecutionException(502, 'Host execution response exceeded the 10 MiB safety limit.');
            }
        }
        if (strlen($body) < $length) throw new HostExecutionException(502, 'Host execution response ended before Content-Length bytes were received.');
        return $body;
    }

    /** @param resource $stream */
    private static function readToEof($stream, int $deadline, int $timeoutMs): string
    {
        $body = '';
        while (!feof($stream)) {
            self::applyStreamDeadline($stream, $deadline, $timeoutMs);
            $chunk = @fread($stream, 65_536);
            if ($chunk === false || ($chunk === '' && !feof($stream))) {
                self::throwStreamFailure($stream, $deadline, $timeoutMs, 'Host execution response read failed.');
            }
            $body .= $chunk;
            if (strlen($body) > self::MAX_RESPONSE_BYTES) {
                throw new HostExecutionException(502, 'Host execution response exceeded the 10 MiB safety limit.');
            }
        }
        return $body;
    }

    /** @param resource $stream */
    private static function readChunkedBody($stream, int $deadline, int $timeoutMs): string
    {
        $body = '';
        while (true) {
            $line = trim(self::readLine($stream, $deadline, $timeoutMs));
            $sizeText = explode(';', $line, 2)[0];
            if ($sizeText === '' || !ctype_xdigit($sizeText)) throw new HostExecutionException(502, 'Host execution received an invalid chunked response.');
            $size = hexdec($sizeText);
            if ($size === 0) {
                while (trim(self::readLine($stream, $deadline, $timeoutMs)) !== '') {}
                break;
            }
            if (strlen($body) + $size > self::MAX_RESPONSE_BYTES) {
                throw new HostExecutionException(502, 'Host execution response exceeded the 10 MiB safety limit.');
            }
            $body .= self::readExact($stream, $size, $deadline, $timeoutMs);
            $terminator = self::readExact($stream, 2, $deadline, $timeoutMs);
            if ($terminator !== "\r\n") throw new HostExecutionException(502, 'Host execution received an invalid chunked response.');
        }
        return $body;
    }

    /** @param resource $stream */
    private static function throwStreamFailure($stream, int $deadline, int $timeoutMs, string $fallback): never
    {
        $metadata = stream_get_meta_data($stream);
        if (($metadata['timed_out'] ?? false) || self::monotonicMs() >= $deadline) {
            throw new HostExecutionException(502, "Host execution request timed out after {$timeoutMs} ms.");
        }
        throw new HostExecutionException(502, $fallback);
    }

    private static function validUtf8(string $value): bool
    {
        return preg_match('//u', $value) === 1;
    }
}

/** @internal */
final class HostExecutionException extends \RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}
