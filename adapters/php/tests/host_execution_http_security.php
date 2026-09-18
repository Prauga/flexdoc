<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use Closure;
use Illuminate\Container\Container;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\CallableDispatcher;
use Illuminate\Routing\Contracts\CallableDispatcher as CallableDispatcherContract;
use Illuminate\Routing\Router;
use Prauga\FlexDoc\FlexDocConfig;
use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\HostExecution;
use Prauga\FlexDoc\Laravel\LaravelFlexDoc;

final class FlexDocHttpSecurityAuthMiddleware
{
    public function handle(Request $request, Closure $next): mixed
    {
        if ($request->headers->get('Authorization') !== 'Bearer flexdoc-test') {
            return new Response('unauthorized', 401);
        }
        return $next($request);
    }
}

final class FlexDocHttpSecurityAdmissionMiddleware
{
    public function handle(Request $request, Closure $next): mixed
    {
        if ($request->headers->get('X-FlexDoc-Test-Admission') === 'reject') {
            return new Response('busy', 429, ['Retry-After' => '1']);
        }
        return $next($request);
    }
}

function httpSecurityCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException("PHP HTTP security conformance failed: {$message}");
}

/** @param array<string, string> $server */
function executeRequest(
    Router $router,
    string $body,
    array $server = [],
    string $method = 'POST',
): Response {
    $defaults = [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_AUTHORIZATION' => 'Bearer flexdoc-test',
        'HTTP_X_FLEXDOC_EXECUTE' => '1',
    ];
    /** @var Response $response */
    $response = $router->dispatch(Request::create(
        '/docs/__flexdoc/execute',
        $method,
        [],
        [],
        [],
        array_replace($defaults, $server),
        $body,
    ));
    return $response;
}

function jsonError(Response $response): string
{
    $decoded = json_decode((string) $response->getContent(), true, flags: JSON_THROW_ON_ERROR);
    return (string) ($decoded['error'] ?? '');
}

$host = new FlexDocHost(new FlexDocConfig(
    path: '/docs',
    specUrl: '/openapi.json',
    tryItHostExecution: true,
    hostExecution: new HostExecution([
        'https://api.example.test',
        'http://169.254.169.254',
    ]),
));

$container = new Container();
$container->instance(CallableDispatcherContract::class, new CallableDispatcher($container));
$router = new Router(new Dispatcher($container), $container);
$router->aliasMiddleware('flexdoc.test.auth', FlexDocHttpSecurityAuthMiddleware::class);
$router->aliasMiddleware('flexdoc.test.admission', FlexDocHttpSecurityAdmissionMiddleware::class);
LaravelFlexDoc::register($router, $host, ['flexdoc.test.auth', 'flexdoc.test.admission']);

$missingAuth = executeRequest(
    $router,
    'not-json',
    [
        'HTTP_AUTHORIZATION' => '',
        'HTTP_X_FLEXDOC_TEST_ADMISSION' => 'reject',
        'HTTP_X_FLEXDOC_EXECUTE' => '',
    ],
);
httpSecurityCheck($missingAuth->getStatusCode() === 401, 'authentication must run before admission and execute parsing');

$admissionRejected = executeRequest(
    $router,
    'not-json',
    [
        'HTTP_X_FLEXDOC_TEST_ADMISSION' => 'reject',
        'HTTP_X_FLEXDOC_EXECUTE' => '',
    ],
);
httpSecurityCheck($admissionRejected->getStatusCode() === 429, 'admission must reject before FlexDoc execute parsing');
httpSecurityCheck($admissionRejected->headers->get('Retry-After') === '1', 'admission rejection Retry-After');

$missingMarker = executeRequest(
    $router,
    'not-json',
    ['HTTP_X_FLEXDOC_EXECUTE' => ''],
);
httpSecurityCheck($missingMarker->getStatusCode() === 403, 'execute route requires protocol marker');
httpSecurityCheck(jsonError($missingMarker) === 'Missing X-FlexDoc-Execute header.', 'marker rejection is canonical');
httpSecurityCheck($missingMarker->headers->get('Cache-Control') === 'no-store', 'marker rejection is no-store');

$outsideAllowlist = executeRequest(
    $router,
    json_encode([
        'request' => ['method' => 'GET', 'url' => 'https://blocked.example/private'],
    ], JSON_THROW_ON_ERROR),
);
httpSecurityCheck($outsideAllowlist->getStatusCode() === 403, 'outside origin is rejected at HTTP boundary');
httpSecurityCheck(str_contains(jsonError($outsideAllowlist), 'not allowed'), 'outside-origin rejection is named');

$metadata = executeRequest(
    $router,
    json_encode([
        'request' => ['method' => 'GET', 'url' => 'http://169.254.169.254/latest/meta-data/'],
    ], JSON_THROW_ON_ERROR),
);
httpSecurityCheck($metadata->getStatusCode() === 403, 'metadata destination is rejected at HTTP boundary');
httpSecurityCheck(str_contains(jsonError($metadata), 'metadata'), 'metadata rejection is named');

$wrongMedia = executeRequest(
    $router,
    '{}',
    ['CONTENT_TYPE' => 'text/plain'],
);
httpSecurityCheck($wrongMedia->getStatusCode() === 400, 'unsupported execute media type is rejected');
httpSecurityCheck(
    str_contains(jsonError($wrongMedia), 'application/json or multipart/form-data'),
    'media-type rejection is canonical',
);

$oversized = executeRequest(
    $router,
    str_repeat('x', HostExecution::MAX_REQUEST_BYTES + 1),
);
httpSecurityCheck($oversized->getStatusCode() === 400, 'oversized execute body is rejected at HTTP boundary');
httpSecurityCheck(str_contains(jsonError($oversized), '32 MiB safety limit'), 'bounded-body rejection is canonical');

$wrongMethod = executeRequest($router, '{}', [], 'GET');
httpSecurityCheck($wrongMethod->getStatusCode() === 405 || $wrongMethod->getStatusCode() === 404, 'non-POST execute method is fail-closed');

echo "PHP execute-route HTTP security conformance passed.\n";
