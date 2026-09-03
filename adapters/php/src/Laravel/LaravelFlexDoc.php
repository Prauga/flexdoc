<?php

declare(strict_types=1);

namespace Prauga\FlexDoc\Laravel;

use Illuminate\Http\Response as IlluminateResponse;
use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\FlexDocResponse;

final class LaravelFlexDoc
{
    public static function register(object $router, FlexDocHost $host): void
    {
        $base = ltrim($host->config()->path, '/');
        $documentation = static fn () => self::response($host->documentation());

        $router->get($base, $documentation);
        $router->get($base . '/', $documentation);
        $router->get($base . '/__flexdoc/renderer.js', static fn () => self::response($host->rendererJavaScript()));
        $router->get($base . '/__flexdoc/renderer.css', static fn () => self::response($host->rendererCss()));
    }

    private static function response(FlexDocResponse $response): IlluminateResponse
    {
        return new IlluminateResponse($response->body, $response->status, $response->headers());
    }
}
