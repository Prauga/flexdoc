<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use Illuminate\Container\Container;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\Request as IlluminateRequest;
use Illuminate\Routing\CallableDispatcher;
use Illuminate\Routing\Contracts\CallableDispatcher as CallableDispatcherContract;
use Illuminate\Routing\Router;
use Prauga\FlexDoc\HostExecution;
use Prauga\FlexDoc\Laravel\FlexDocServiceProvider;
use Prauga\FlexDoc\Laravel\LaravelFlexDoc;
use Prauga\FlexDoc\Symfony\FlexDocController;
use Symfony\Component\HttpFoundation\Request as SymfonyRequest;

function frameworkCheck(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

$without = FlexDocServiceProvider::hostFromConfig([
    'path' => '/docs',
    'try_it_host_execution' => true,
]);
frameworkCheck($without->executionAvailable() === false, 'Laravel must not create an executor without origins');

$with = FlexDocServiceProvider::hostFromConfig([
    'path' => '/docs',
    'try_it_host_execution' => 'true',
    'host_execution_allowed_origins' => 'https://api.example.test, https://other.example.test',
]);
frameworkCheck($with->executionAvailable() === true, 'Laravel should construct executor from configured origins');
frameworkCheck($with->config()->hostExecution instanceof HostExecution, 'Laravel executor type');

$container = new Container();
$container->instance(CallableDispatcherContract::class, new CallableDispatcher($container));
$router = new Router(new Dispatcher($container), $container);
LaravelFlexDoc::register($router, $with);
$uris = array_map(static fn ($route) => [$route->uri(), $route->methods()], $router->getRoutes()->getRoutes());
$executeRoutes = array_values(array_filter($uris, static fn (array $route): bool => $route[0] === 'docs/__flexdoc/execute'));
frameworkCheck(count($executeRoutes) === 1, 'Laravel execute route registration');
frameworkCheck(in_array('POST', $executeRoutes[0][1], true), 'Laravel execute route method');

$routerWithout = new Router(new Dispatcher($container), $container);
LaravelFlexDoc::register($routerWithout, $without);
$withoutUris = array_map(static fn ($route) => $route->uri(), $routerWithout->getRoutes()->getRoutes());
frameworkCheck(!in_array('docs/__flexdoc/execute', $withoutUris, true), 'Laravel disabled execute route must be absent');

$missingMarker = $router->dispatch(IlluminateRequest::create(
    '/docs/__flexdoc/execute',
    'POST',
    [],
    [],
    [],
    ['CONTENT_TYPE' => 'application/json'],
    'not-json',
));
frameworkCheck($missingMarker->getStatusCode() === 403, 'Laravel marker enforcement');

$symfony = new FlexDocController($with);
$symfonyResponse = $symfony->execute(SymfonyRequest::create(
    '/docs/__flexdoc/execute',
    'POST',
    [],
    [],
    [],
    ['CONTENT_TYPE' => 'application/json'],
    'not-json',
));
frameworkCheck($symfonyResponse->getStatusCode() === 403, 'Symfony marker enforcement');

echo "PHP Laravel/Symfony host-execution bindings passed.\n";
