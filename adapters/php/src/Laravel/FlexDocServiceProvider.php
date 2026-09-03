<?php

declare(strict_types=1);

namespace Prauga\FlexDoc\Laravel;

use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;
use Prauga\FlexDoc\FlexDocConfig;
use Prauga\FlexDoc\FlexDocHost;

final class FlexDocServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(dirname(__DIR__, 2) . '/config/flexdoc.php', 'flexdoc');
        $this->app->singleton(FlexDocHost::class, function ($app): FlexDocHost {
            return self::hostFromConfig($app['config']->get('flexdoc', []));
        });
    }

    /** @param array<string, mixed> $config */
    public static function hostFromConfig(array $config): FlexDocHost
    {
        $tryItEnabled = filter_var(
            $config['try_it_enabled'] ?? true,
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE,
        ) ?? true;

        return new FlexDocHost(new FlexDocConfig(
            path: (string) ($config['path'] ?? '/docs'),
            specUrl: (string) ($config['spec_url'] ?? '/openapi.json'),
            title: (string) ($config['title'] ?? 'API Reference'),
            theme: (string) ($config['theme'] ?? 'system'),
            tryItEnabled: $tryItEnabled,
        ));
    }

    public function boot(Router $router): void
    {
        LaravelFlexDoc::register($router, $this->app->make(FlexDocHost::class));
    }
}
