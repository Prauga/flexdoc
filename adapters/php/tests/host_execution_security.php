<?php

declare(strict_types=1);

namespace Prauga\FlexDoc {
    /** @var int */
    $securityDnsLookups = 0;

    /**
     * Deterministic test resolver for the synthetic redirect host used below.
     * Production HostExecution calls this unqualified function from this namespace.
     *
     * @return array<int, array<string, mixed>>|false
     */
    function dns_get_record(string $hostname, int $type): array|false
    {
        global $securityDnsLookups;
        if ($hostname === 'flexdoc-security-redirect.test') {
            $securityDnsLookups++;
            return [[
                'host' => $hostname,
                'class' => 'IN',
                'ttl' => 60,
                'type' => 'A',
                'ip' => '127.0.0.1',
            ]];
        }
        return \dns_get_record($hostname, $type);
    }
}

namespace {
    require dirname(__DIR__) . '/vendor/autoload.php';

    use Prauga\FlexDoc\HostExecution;

    function securityCheck(bool $condition, string $name): void
    {
        if (!$condition) throw new RuntimeException("Security conformance failed: {$name}");
    }

    /** @return array{0: resource, 1: int, 2: string, 3: string} */
    function startSecurityRedirectServer(): array
    {
        $probe = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
        if (!is_resource($probe)) throw new RuntimeException("Unable to reserve loopback port: {$error}");
        $name = stream_socket_get_name($probe, false);
        fclose($probe);
        if (!is_string($name) || !preg_match('/:(\d+)$/', $name, $match)) {
            throw new RuntimeException('Unable to resolve loopback port.');
        }
        $port = (int) $match[1];

        $router = tempnam(sys_get_temp_dir(), 'flexdoc-php-security-router-');
        $log = tempnam(sys_get_temp_dir(), 'flexdoc-php-security-log-');
        if ($router === false || $log === false) throw new RuntimeException('Unable to create security test files.');
        file_put_contents($router, <<<'PHP'
<?php
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if ($path === '/redirect') {
    header('Location: /done');
    http_response_code(302);
    return;
}
if ($path === '/done') {
    header('Content-Type: text/plain');
    echo 'ok';
    return;
}
http_response_code(404);
echo 'missing';
PHP);

        $command = escapeshellarg(PHP_BINARY) . ' -S 127.0.0.1:' . $port . ' ' . escapeshellarg($router);
        $descriptor = [
            0 => ['pipe', 'r'],
            1 => ['file', $log, 'a'],
            2 => ['file', $log, 'a'],
        ];
        $process = proc_open($command, $descriptor, $pipes);
        if (!is_resource($process)) throw new RuntimeException('Unable to start security redirect server.');
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
            throw new RuntimeException("Security redirect server did not start. {$details}");
        }

        return [$process, $port, $router, $log];
    }

    $metadata = (new HostExecution(['http://169.254.169.254']))->handle('1', [
        'request' => ['method' => 'GET', 'url' => 'http://169.254.169.254/latest/meta-data'],
    ]);
    securityCheck($metadata['status'] === 403, 'literal cloud metadata target is blocked');
    securityCheck(
        str_contains((string) ($metadata['body']['error'] ?? ''), 'metadata'),
        'literal cloud metadata rejection is named',
    );

    $mappedMetadata = (new HostExecution(['http://[::ffff:169.254.169.254]']))->handle('1', [
        'request' => ['method' => 'GET', 'url' => 'http://[::ffff:169.254.169.254]/latest/meta-data'],
    ]);
    securityCheck($mappedMetadata['status'] === 403, 'IPv4-mapped metadata target is blocked');

    [$server, $port, $router, $log] = startSecurityRedirectServer();
    try {
        $origin = "http://flexdoc-security-redirect.test:{$port}";
        $executor = new HostExecution([$origin]);
        $result = $executor->handle('1', [
            'request' => [
                'method' => 'GET',
                'url' => $origin . '/redirect',
            ],
        ]);

        securityCheck($result['status'] === 200, 'same-origin redirect succeeds');
        securityCheck(($result['body']['body'] ?? null) === 'ok', 'redirect response body is preserved');
        securityCheck(
            $GLOBALS['securityDnsLookups'] === 2,
            'every redirect hop receives a fresh DNS validation; got ' . $GLOBALS['securityDnsLookups'] . ' lookups',
        );
    } finally {
        proc_terminate($server);
        @unlink($router);
        @unlink($log);
    }

    echo "PHP host-execution security conformance passed.\n";
}
