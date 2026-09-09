<?php

declare(strict_types=1);

namespace Prauga\FlexDoc\Laravel;

use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;
use Prauga\FlexDoc\FlexDocConfig;
use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\HostExecution;

/** Laravel service provider that binds FlexDocHost and registers FlexDoc routes. */
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
        $tryItEnabled = filter_var($config['try_it_enabled'] ?? true, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true;
        $persistenceKey = $config['try_it_api_client_persistence_key'] ?? null;
        if (is_string($persistenceKey) && strtolower($persistenceKey) === 'false') $persistenceKey = false;
        $credentials = isset($config['try_it_credentials']) ? trim((string) $config['try_it_credentials']) : null;
        if ($credentials === '') $credentials = null;
        $hostExecutionEnabled = filter_var($config['try_it_host_execution'] ?? false, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;

        $executor = $config['host_execution'] ?? null;
        if (!$executor instanceof HostExecution) {
            $executor = null;
            $origins = $config['host_execution_allowed_origins'] ?? [];
            if (is_string($origins)) $origins = preg_split('/\s*,\s*/', trim($origins), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            if ($hostExecutionEnabled && is_array($origins) && $origins !== []) {
                $executor = new HostExecution(array_values(array_map('strval', $origins)));
            }
        }

        return new FlexDocHost(new FlexDocConfig(
            path: (string) ($config['path'] ?? '/docs'),
            specUrl: (string) ($config['spec_url'] ?? '/openapi.json'),
            title: (string) ($config['title'] ?? 'API Reference'),
            theme: (string) ($config['theme'] ?? 'system'),
            tryItEnabled: $tryItEnabled,
            expand: $config['expand'] ?? null,
            tryItDefaultServer: isset($config['try_it_default_server']) ? (string) $config['try_it_default_server'] : null,
            tryItCredentials: $credentials,
            tryItApiClientPersistenceKey: $persistenceKey === false ? false : (isset($persistenceKey) ? (string) $persistenceKey : null),
            tryItHostExecution: $hostExecutionEnabled,
            hostExecution: $executor,
        ));
    }

    public function boot(Router $router): void
    {
        LaravelFlexDoc::register($router, $this->app->make(FlexDocHost::class));
    }
}
