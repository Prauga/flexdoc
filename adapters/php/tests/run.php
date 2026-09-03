<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use Illuminate\Container\Container;
use Illuminate\Events\Dispatcher;
use Illuminate\Routing\Router;
use Prauga\FlexDoc\FlexDocConfig;
use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\Laravel\LaravelFlexDoc;
use Prauga\FlexDoc\Symfony\FlexDocController;

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

$host = new FlexDocHost(new FlexDocConfig('/reference', '/openapi.json', 'PHP <API>'));
$docs = $host->responseForPath('/reference');
check($docs->status === 200, 'docs status');
check(str_contains($docs->body, 'PHP &lt;API&gt;'), 'title escaping');
check(str_contains($docs->body, 'window.__FLEXDOC_SPEC_URL__="/openapi.json"'), 'spec URL');
check($docs->cacheControl === 'no-cache', 'docs cache');
check($host->rendererJavaScript()->body === file_get_contents(dirname(__DIR__) . '/assets/flexdoc.standalone.js'), 'JS parity');
check($host->rendererCss()->body === file_get_contents(dirname(__DIR__) . '/assets/flexdoc.standalone.css'), 'CSS parity');
check($host->responseForPath('/missing')->status === 404, '404 route');

$container = new Container();
$router = new Router(new Dispatcher($container), $container);
LaravelFlexDoc::register($router, $host);
$uris = array_map(static fn ($route) => $route->uri(), $router->getRoutes()->getRoutes());
check(in_array('reference', $uris, true), 'Laravel docs route');
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

echo "PHP FlexDoc host, Laravel routes, and Symfony controller passed.\n";
