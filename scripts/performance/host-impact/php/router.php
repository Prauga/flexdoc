<?php

declare(strict_types=1);

$root = dirname(__DIR__, 4);
require $root . '/adapters/php/vendor/autoload.php';

use Prauga\FlexDoc\FlexDocConfig;
use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\HostExecution;

$mode = getenv('FLEXDOC_BENCH_MODE') ?: 'baseline';
$port = (int) (getenv('FLEXDOC_BENCH_PORT') ?: '5810');
$origin = getenv('FLEXDOC_BENCH_ORIGIN') ?: "http://127.0.0.1:{$port}";
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

function json_response(array $payload): void {
    header('Content-Type: application/json');
    echo json_encode($payload, JSON_THROW_ON_ERROR);
}

if ($path === '/health') {
    json_response(['ok' => true]);
    return;
}

if ($path === '/target') {
    json_response(['ok' => true, 'runtime' => 'php-native']);
    return;
}

if ($path === '/openapi.json') {
    json_response([
        'openapi' => '3.0.3',
        'info' => ['title' => 'FlexDoc host-impact benchmark', 'version' => '1.0.0'],
        'paths' => ['/target' => ['get' => ['responses' => ['200' => ['description' => 'ok']]]]],
    ]);
    return;
}

if ($mode !== 'baseline' && ($path === '/docs' || str_starts_with($path, '/docs/'))) {
    $executor = $mode === 'host' ? new HostExecution([$origin]) : null;
    $host = new FlexDocHost(new FlexDocConfig(
        path: '/docs',
        specUrl: '/openapi.json',
        title: 'FlexDoc host-impact benchmark',
        tryItEnabled: true,
        tryItDefaultServer: $origin,
        tryItHostExecution: $mode === 'host',
        hostExecution: $executor,
    ));

    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $body = file_get_contents('php://input') ?: '';
    $response = $host->responseForRequest($_SERVER['REQUEST_METHOD'] ?? 'GET', $path, $headers, $body);
    http_response_code($response->status);
    foreach ($response->headers() as $name => $value) header($name . ': ' . $value);
    echo $response->body;
    return;
}

http_response_code(404);
header('Content-Type: text/plain');
echo 'Not Found';
