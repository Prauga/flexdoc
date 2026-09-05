<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use Illuminate\Container\Container;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\Request;
use Illuminate\Routing\CallableDispatcher;
use Illuminate\Routing\Contracts\CallableDispatcher as CallableDispatcherContract;
use Illuminate\Routing\Router;
use Prauga\FlexDoc\FlexDocConfig;
use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\Laravel\FlexDocServiceProvider;
use Prauga\FlexDoc\Laravel\LaravelFlexDoc;
use Prauga\FlexDoc\Symfony\FlexDocController;

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

/** @return array<string, mixed> */
function rendererOptions(string $html): array {
    $prefix = 'window.__FLEXDOC_OPTIONS__=';
    $start = strpos($html, $prefix);
    check($start !== false, 'renderer options start');
    $start += strlen($prefix);
    $end = strpos($html, ';</script>', $start);
    check($end !== false, 'renderer options end');
    return json_decode(substr($html, $start, $end - $start), true, flags: JSON_THROW_ON_ERROR);
}

$host = new FlexDocHost(new FlexDocConfig('/reference', '/openapi.json?x=</script>', 'PHP </script><script>alert(1)</script>'));
$docs = $host->responseForPath('/reference');
check($docs->status === 200, 'docs status');
check(str_contains($docs->body, 'PHP &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;'), 'title escaping');
check(!str_contains($docs->body, '"/openapi.json?x=</script>"'), 'spec JSON escaping');
check($docs->cacheControl === 'no-cache', 'docs cache');
$options = rendererOptions($docs->body);
check(!array_key_exists('expand', $options), 'expand omitted by default');
check($options['tryIt'] === ['enabled' => true], 'Try It optional fields omitted');
check($host->rendererJavaScript()->body === file_get_contents(dirname(__DIR__) . '/assets/flexdoc.standalone.js'), 'JS parity');
check($host->rendererCss()->body === file_get_contents(dirname(__DIR__) . '/assets/flexdoc.standalone.css'), 'CSS parity');
check($host->responseForPath('/missing')->status === 404, '404 route');

foreach (['documentation', ['parameters', 'tryIt']] as $expand) {
    $configured = new FlexDocHost(new FlexDocConfig(
        path: '/configured',
        specUrl: '/openapi.json',
        title: 'Configured',
        expand: $expand,
        tryItDefaultServer: 'https://gateway.example.test',
        tryItCredentials: 'include',
        tryItApiClientPersistenceKey: false,
    ));
    $configuredOptions = rendererOptions($configured->documentation()->body);
    check($configuredOptions['expand'] === $expand, 'expand serialization');
    check($configuredOptions['tryIt']['enabled'] === true, 'Try It enabled retained');
    check($configuredOptions['tryIt']['defaultServer'] === 'https://gateway.example.test', 'default server');
    check($configuredOptions['tryIt']['credentials'] === 'include', 'credentials');
    check($configuredOptions['tryIt']['apiClientPersistenceKey'] === false, 'persistence false is boolean');
}

$providerHost = FlexDocServiceProvider::hostFromConfig([
    'path' => '/provider-docs',
    'spec_url' => '/openapi.json',
    'title' => 'Provider API',
    'theme' => 'system',
    'try_it_enabled' => 'false',
    'expand' => ['parameters', 'tryIt'],
    'try_it_default_server' => 'https://gateway.example.test',
    'try_it_credentials' => 'same-origin',
    'try_it_api_client_persistence_key' => 'false',
]);
check($providerHost->config()->tryItEnabled === false, 'Laravel service provider parses string false');
check($providerHost->config()->expand === ['parameters', 'tryIt'], 'Laravel forwards expansion list');
check($providerHost->config()->tryItApiClientPersistenceKey === false, 'Laravel forwards persistence false');

$blankCredentialsHost = FlexDocServiceProvider::hostFromConfig([
    'try_it_credentials' => '   ',
]);
check($blankCredentialsHost->config()->tryItCredentials === null, 'Laravel treats blank credentials as unset');

$container = new Container();
$container->instance(CallableDispatcherContract::class, new CallableDispatcher($container));
$router = new Router(new Dispatcher($container), $container);
LaravelFlexDoc::register($router, $host);

$docsResponse = $router->dispatch(Request::create('/reference', 'GET'));
$slashResponse = $router->dispatch(Request::create('/reference/', 'GET'));
check($docsResponse->getStatusCode() === 200, 'Laravel docs route');
check($slashResponse->getStatusCode() === 200, 'Laravel trailing-slash docs route');
check(str_contains((string) $slashResponse->getContent(), 'PHP &lt;/script&gt;'), 'Laravel trailing-slash docs body');

$uris = array_map(static fn ($route) => $route->uri(), $router->getRoutes()->getRoutes());
check(in_array('reference/__flexdoc/renderer.js', $uris, true), 'Laravel JS route');
check(in_array('reference/__flexdoc/renderer.css', $uris, true), 'Laravel CSS route');

$symfony = new FlexDocController($host);
check($symfony->documentation()->getStatusCode() === 200, 'Symfony docs response');
$cacheControl = $symfony->rendererJavaScript()->headers->get('Cache-Control') ?? '';
$cacheDirectives = array_map('trim', explode(',', $cacheControl));
check(
    in_array('public', $cacheDirectives, true)
    && in_array('max-age=31536000', $cacheDirectives, true)
    && in_array('immutable', $cacheDirectives, true),
    'Symfony cache header'
);

echo "PHP FlexDoc host, renderer options, Laravel config/routes, and Symfony controller passed.\n";
