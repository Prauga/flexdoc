<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use Illuminate\Container\Container;
use Illuminate\Events\Dispatcher;
use Illuminate\Routing\CallableDispatcher;
use Illuminate\Routing\Contracts\CallableDispatcher as CallableDispatcherContract;
use Illuminate\Routing\Router;
use Prauga\FlexDoc\FlexDocHost;
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
frameworkCheck(
    FlexDocServiceProvider::middlewareFromConfig('auth, verified') === ['auth', 'verified'],
    'Laravel middleware string normalization',
);
frameworkCheck(
    FlexDocServiceProvider::middlewareFromConfig(['auth', ' verified ', '', 42]) === ['auth', 'verified'],
    'Laravel middleware array normalization',
);

$container = new Container();
$container->instance(CallableDispatcherContract::class, new CallableDispatcher($container));
$router = new Router(new Dispatcher($container), $container);
LaravelFlexDoc::register($router, $with, ['auth']);
$routes = $router->getRoutes()->getRoutes();
$executeRoute = null;
$docsRoute = null;
foreach ($routes as $route) {
    if ($route->uri() === 'docs/__flexdoc/execute') $executeRoute = $route;
    if ($route->uri() === 'docs' && in_array('GET', $route->methods(), true)) $docsRoute = $route;
}
frameworkCheck($executeRoute !== null, 'Laravel execute route registration');
frameworkCheck(in_array('POST', $executeRoute->methods(), true), 'Laravel execute route method');
frameworkCheck(in_array('auth', $executeRoute->gatherMiddleware(), true), 'Laravel execute route middleware');
frameworkCheck($docsRoute !== null && in_array('auth', $docsRoute->gatherMiddleware(), true), 'Laravel docs route middleware');

$routerWithout = new Router(new Dispatcher($container), $container);
LaravelFlexDoc::register($routerWithout, $without, ['auth']);
$withoutUris = array_map(static fn ($route) => $route->uri(), $routerWithout->getRoutes()->getRoutes());
frameworkCheck(!in_array('docs/__flexdoc/execute', $withoutUris, true), 'Laravel disabled execute route must be absent');

$manualGuarded = false;
try {
    LaravelFlexDoc::register(new Router(new Dispatcher($container), $container), $with);
} catch (LogicException $exception) {
    $manualGuarded = $exception->getMessage() === 'FlexDoc host execution requires non-empty flexdoc.middleware; the origin allowlist is not authentication.';
}
frameworkCheck($manualGuarded, 'Laravel manual registration must fail closed without middleware');

$bootContainer = new Container();
$bootContainer->instance('config', new class {
    public function get(string $key, mixed $default = null): mixed {
        if ($key === 'flexdoc') return ['try_it_host_execution' => true, 'middleware' => []];
        return $default;
    }
});
$bootContainer->instance(FlexDocHost::class, $with);
$bootContainer->instance(CallableDispatcherContract::class, new CallableDispatcher($bootContainer));
$bootRouter = new Router(new Dispatcher($bootContainer), $bootContainer);
$provider = new FlexDocServiceProvider($bootContainer);
$bootGuarded = false;
try {
    $provider->boot($bootRouter);
} catch (LogicException $exception) {
    $bootGuarded = $exception->getMessage() === 'FlexDoc host execution requires non-empty flexdoc.middleware; the origin allowlist is not authentication.';
}
frameworkCheck($bootGuarded, 'Laravel ServiceProvider must fail closed without middleware');

$symfonyGuarded = false;
try {
    new FlexDocController($with);
} catch (LogicException $exception) {
    $symfonyGuarded = $exception->getMessage() === 'FlexDoc Symfony host execution requires hostExecutionProtected=true after configuring firewall/access_control; the origin allowlist is not authentication.';
}
frameworkCheck($symfonyGuarded, 'Symfony host execution must fail closed without explicit protection acknowledgement');

$symfony = new FlexDocController($with, true);
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

$disabledSymfony = new FlexDocController($without);
frameworkCheck($disabledSymfony instanceof FlexDocController, 'Symfony disabled host execution must not require protection acknowledgement');

echo "PHP Laravel/Symfony host-execution bindings passed.\n";
