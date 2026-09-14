<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use Prauga\FlexDoc\FlexDocConfig;
use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\HostExecution;

function hostCheck(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

/** @return array<string, mixed> */
function hostJson(string $body): array {
    return json_decode($body, true, flags: JSON_THROW_ON_ERROR);
}

/** @return array{0: resource, 1: string, 2: string} */
function startHostExecutionServer(): array {
    $probe = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if (!is_resource($probe)) throw new RuntimeException("Unable to reserve loopback port: {$error}");
    $name = stream_socket_get_name($probe, false);
    fclose($probe);
    if (!is_string($name) || !preg_match('/:(\d+)$/', $name, $match)) throw new RuntimeException('Unable to resolve loopback port.');
    $port = (int) $match[1];

    $router = tempnam(sys_get_temp_dir(), 'flexdoc-php-router-');
    if ($router === false) throw new RuntimeException('Unable to create PHP loopback router.');
    $log = tempnam(sys_get_temp_dir(), 'flexdoc-php-log-');
    if ($log === false) throw new RuntimeException('Unable to create PHP loopback log.');

    file_put_contents($router, <<<'PHP'
<?php
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if ($path === '/health') { echo 'ok'; return; }
if ($path === '/redirect') { header('Location: /echo'); http_response_code(302); return; }
if ($path === '/cross-origin') { header('Location: ' . (string) ($_GET['to'] ?? '')); http_response_code(302); return; }
if ($path === '/slow') { usleep(250000); header('Content-Type: text/plain'); echo 'late'; return; }
if ($path === '/large') { header('Content-Type: text/plain'); echo str_repeat('x', 10 * 1024 * 1024 + 1); return; }
if ($path === '/binary') { header('Content-Type: application/octet-stream'); echo "\xff\xfe"; return; }
if (!str_starts_with($path, '/echo')) { http_response_code(404); echo 'missing'; return; }
$headers = function_exists('getallheaders') ? getallheaders() : [];
$normalized = [];
foreach ($headers as $name => $value) $normalized[strtolower((string) $name)] = (string) $value;
$upload = null;
if (isset($_FILES['upload']) && is_array($_FILES['upload'])) {
    $tmp = $_FILES['upload']['tmp_name'] ?? null;
    $upload = [
        'name' => (string) ($_FILES['upload']['name'] ?? ''),
        'type' => (string) ($_FILES['upload']['type'] ?? ''),
        'body' => is_string($tmp) && $tmp !== '' ? (string) file_get_contents($tmp) : '',
    ];
}
header('Content-Type: application/json');
echo json_encode([
    'uri' => $_SERVER['REQUEST_URI'] ?? '',
    'method' => $_SERVER['REQUEST_METHOD'] ?? '',
    'headers' => $normalized,
    'rawBody' => (string) file_get_contents('php://input'),
    'post' => $_POST,
    'upload' => $upload,
], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
PHP);

    $command = escapeshellarg(PHP_BINARY) . ' -S 127.0.0.1:' . $port . ' ' . escapeshellarg($router);
    $descriptor = [
        0 => ['pipe', 'r'],
        1 => ['file', $log, 'a'],
        2 => ['file', $log, 'a'],
    ];
    $process = proc_open($command, $descriptor, $pipes);
    if (!is_resource($process)) throw new RuntimeException('Unable to start PHP loopback server.');
    foreach ($pipes as $pipe) if (is_resource($pipe)) fclose($pipe);

    $ready = false;
    for ($i = 0; $i < 50; $i++) {
        $socket = @stream_socket_client("tcp://127.0.0.1:{$port}", $errno, $error, 0.1);
        if (is_resource($socket)) {
            fclose($socket);
            $ready = true;
            break;
        }
        usleep(20_000);
    }
    if (!$ready) {
        proc_terminate($process);
        $details = @file_get_contents($log) ?: '';
        throw new RuntimeException("PHP loopback server did not start. {$details}");
    }

    register_shutdown_function(static function () use ($process, $router, $log): void {
        if (is_resource($process)) proc_terminate($process);
        @unlink($router);
        @unlink($log);
    });

    return [$process, "http://127.0.0.1:{$port}", $router];
}

foreach ([
    [],
    [''],
    ['https://api.example.test/path'],
    ['https://user@example.test'],
    ['https://api.example.test?x=1'],
] as $origins) {
    try {
        new HostExecution($origins);
        throw new RuntimeException('invalid origin allowlist unexpectedly succeeded');
    } catch (InvalidArgumentException) {
        // expected
    }
}

[$server, $origin] = startHostExecutionServer();
[$secondServer, $secondOrigin] = startHostExecutionServer();
$executor = new HostExecution([$origin, $secondOrigin]);

$disabled = new FlexDocHost(new FlexDocConfig(path: '/docs', tryItHostExecution: true));
$disabledOptions = hostJson((string) preg_replace('/^.*window\.__FLEXDOC_OPTIONS__=(.*?);<\/script>.*$/s', '$1', $disabled->documentation()->body));
hostCheck($disabledOptions['tryIt']['hostExecution']['available'] === false, 'disabled host execution advertised available');
hostCheck($disabled->responseForRequest('POST', '/docs/__flexdoc/execute')->status === 404, 'disabled execute route should be absent');

$host = new FlexDocHost(new FlexDocConfig(path: '/docs', tryItHostExecution: true, hostExecution: $executor));
$options = hostJson((string) preg_replace('/^.*window\.__FLEXDOC_OPTIONS__=(.*?);<\/script>.*$/s', '$1', $host->documentation()->body));
hostCheck($options['tryIt']['hostExecution'] === [
    'available' => true,
    'endpoint' => '/docs/__flexdoc/execute',
    'capabilities' => [],
], 'enabled host execution metadata');
hostCheck(!str_contains($host->documentation()->body, $origin), 'allowed origin leaked into docs HTML');

$missingMarker = $host->executeRequest(['content-type' => 'application/json'], 'not-json');
hostCheck($missingMarker->status === 403, 'marker must be enforced before JSON parsing');
hostCheck(str_contains($missingMarker->body, 'X-FlexDoc-Execute'), 'marker error message');

$malformed = $executor->handle('1', ['request' => ['method' => 'GET', 'url' => 'not an absolute URL']]);
hostCheck($malformed['status'] === 400, 'malformed URL status');
hostCheck(str_contains((string) ($malformed['body']['error'] ?? ''), 'absolute HTTP(S)'), 'malformed URL message');

$blockedOrigin = (new HostExecution([$origin]))->handle('1', [
    'request' => ['method' => 'GET', 'url' => $secondOrigin . '/echo'],
]);
hostCheck($blockedOrigin['status'] === 403, 'non-allowlisted origin must be rejected');
hostCheck(str_contains((string) ($blockedOrigin['body']['error'] ?? ''), 'not allowed'), 'blocked-origin message');

$metadata = (new HostExecution(['http://169.254.169.254']))->handle('1', [
    'request' => ['method' => 'GET', 'url' => 'http://169.254.169.254/latest/meta-data'],
]);
hostCheck($metadata['status'] === 403, 'metadata destination must be blocked');

$mappedMetadata = (new HostExecution(['http://[::ffff:169.254.169.254]']))->handle('1', [
    'request' => ['method' => 'GET', 'url' => 'http://[::ffff:169.254.169.254]/latest/meta-data'],
]);
hostCheck($mappedMetadata['status'] === 403, 'IPv4-mapped metadata destination must be blocked');

$crlfBearer = $executor->handle('1', [
    'request' => [
        'method' => 'GET',
        'url' => $origin . '/echo',
        'auth' => ['type' => 'bearer', 'token' => "safe\r\nX-Evil: yes"],
    ],
]);
hostCheck($crlfBearer['status'] === 400, 'CRLF bearer token must be rejected');

$unsafeApiKey = $executor->handle('1', [
    'request' => [
        'method' => 'GET',
        'url' => $origin . '/echo',
        'auth' => ['type' => 'apiKey', 'in' => 'header', 'key' => ' Host ', 'value' => 'evil.example'],
    ],
]);
hostCheck($unsafeApiKey['status'] === 400, 'unsafe API-key header must be rejected');

$crlfContentType = $executor->handle('1', [
    'request' => [
        'method' => 'POST',
        'url' => $origin . '/echo',
        'bodyMode' => 'raw',
        'body' => 'payload',
        'contentType' => "text/plain\r\nX-Evil: yes",
    ],
]);
hostCheck($crlfContentType['status'] === 400, 'CRLF content type must be rejected');

$encodedEnvelope = [
    'request' => [
        'method' => 'GET',
        'url' => $origin . '/echo%2Fpart?existing=a%2Fb',
        'query' => [['key' => 'next', 'value' => 'c d']],
        'headers' => [
            ['key' => 'Origin', 'value' => 'https://attacker.example'],
            ['key' => 'X-Test', 'value' => 'kept'],
            ['key' => 'Content-Type', 'value' => 'application/custom'],
        ],
    ],
];
$encoded = $executor->handle('1', $encodedEnvelope);
hostCheck($encoded['status'] === 200, 'encoded URL execution status');
$echo = hostJson((string) $encoded['body']['body']);
hostCheck(str_contains((string) $echo['uri'], '/echo%2Fpart'), 'encoded path changed');
hostCheck(str_contains((string) $echo['uri'], 'existing=a%2Fb'), 'existing encoded query changed');
hostCheck(str_contains((string) $echo['uri'], 'next=c+d'), 'canonical query missing');
hostCheck(!isset($echo['headers']['origin']), 'unsafe Origin forwarded');
hostCheck(($echo['headers']['x-test'] ?? null) === 'kept', 'custom header missing');
hostCheck(($echo['headers']['content-type'] ?? null) === 'application/custom', 'bodyless GET content-type lost');

$emptyFormData = $executor->handle('1', [
    'request' => [
        'method' => 'POST',
        'url' => $origin . '/echo',
        'formData' => [],
        'body' => '{"ok":true}',
        'contentType' => 'application/json',
    ],
]);
hostCheck($emptyFormData['status'] === 200, 'empty formData inference status');
$emptyFormEcho = hostJson((string) $emptyFormData['body']['body']);
hostCheck(($emptyFormEcho['rawBody'] ?? null) === '{"ok":true}', 'empty formData must not suppress JSON body');

$redirectEnvelope = [
    'request' => [
        'method' => 'GET',
        'url' => $origin . '/redirect',
        'auth' => ['type' => 'apiKey', 'in' => 'query', 'key' => 'token', 'value' => 'secret'],
    ],
];
$redirect = $executor->handle('1', $redirectEnvelope);
hostCheck($redirect['status'] === 200, 'redirect execution status');
$redirectEcho = hostJson((string) $redirect['body']['body']);
hostCheck(str_contains((string) $redirectEcho['uri'], 'token=secret'), 'query API key not reapplied after redirect');

$crossOrigin = $executor->handle('1', [
    'request' => [
        'method' => 'GET',
        'url' => $origin . '/cross-origin?to=' . rawurlencode($secondOrigin . '/echo'),
    ],
]);
hostCheck($crossOrigin['status'] === 403, 'cross-origin redirect must be rejected even when both origins are allowlisted');

$multipart = $executor->handle('1', [
    'request' => [
        'method' => 'POST',
        'url' => $origin . '/echo',
        'bodyMode' => 'formdata',
        'formData' => [
            ['key' => 'note', 'type' => 'text', 'value' => 'hello'],
            ['key' => 'upload', 'type' => 'file', 'fileName' => 'payload.txt'],
        ],
    ],
], [1 => ['filename' => 'payload.txt', 'contentType' => 'text/plain', 'data' => 'file-body']]);
hostCheck($multipart['status'] === 200, 'multipart execution status');
$multipartEcho = hostJson((string) $multipart['body']['body']);
hostCheck(($multipartEcho['post']['note'] ?? null) === 'hello', 'multipart text field missing');
hostCheck(($multipartEcho['upload']['name'] ?? null) === 'payload.txt', 'multipart filename missing');
hostCheck(($multipartEcho['upload']['body'] ?? null) === 'file-body', 'multipart file body missing');

$binary = $executor->handle('1', ['request' => ['method' => 'GET', 'url' => $origin . '/binary']]);
hostCheck($binary['status'] === 200, 'binary response status');
hostCheck(!array_key_exists('bodyEncoding', $binary['body']), 'native response must not invent bodyEncoding extension');
json_encode($binary['body'], JSON_THROW_ON_ERROR);

$timeout = $executor->handle('1', [
    'timeoutMs' => 100,
    'request' => ['method' => 'GET', 'url' => $origin . '/slow'],
]);
hostCheck($timeout['status'] === 502, 'deadline status');
hostCheck(str_contains((string) ($timeout['body']['error'] ?? ''), 'timed out'), 'deadline message');

$large = $executor->handle('1', ['request' => ['method' => 'GET', 'url' => $origin . '/large']]);
hostCheck($large['status'] === 502, 'response size limit status');
hostCheck(str_contains((string) ($large['body']['error'] ?? ''), '10 MiB'), 'response size limit message');

proc_terminate($server);
proc_terminate($secondServer);

echo "PHP native host-execution conformance passed.\n";
