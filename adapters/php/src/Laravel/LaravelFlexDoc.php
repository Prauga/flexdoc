<?php

declare(strict_types=1);

namespace Prauga\FlexDoc\Laravel;

use Illuminate\Http\Request;
use Illuminate\Http\Response as IlluminateResponse;
use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\FlexDocResponse;

/** Registers FlexDoc routes on a Laravel router. */
final class LaravelFlexDoc
{
    /** Register docs, renderer assets, and the optional native execute route. */
    public static function register(object $router, FlexDocHost $host): void
    {
        $base = ltrim($host->config()->path, '/');
        $router->get($base, static fn () => self::response($host->documentation()));
        $router->get($base . '/__flexdoc/renderer.js', static fn () => self::response($host->rendererJavaScript()));
        $router->get($base . '/__flexdoc/renderer.css', static fn () => self::response($host->rendererCss()));

        if ($host->executionAvailable()) {
            $router->post($base . '/__flexdoc/execute', static function (Request $request) use ($host): IlluminateResponse {
                return self::response($host->executeRequest(
                    self::headers($request),
                    $request->getContent(),
                    $request->request->all(),
                    self::files($request->allFiles()),
                ));
            });
        }
    }

    /** @return array<string, string> */
    private static function headers(Request $request): array
    {
        $headers = [];
        foreach ($request->headers->all() as $name => $values) if ($values !== []) $headers[$name] = (string) $values[0];
        return $headers;
    }

    /** @param array<string, mixed> $uploaded @return array<int, array{filename: string, contentType: string, data: string}> */
    private static function files(array $uploaded): array
    {
        $parts = $uploaded['formData'] ?? [];
        if (!is_array($parts)) return [];
        $result = [];
        foreach ($parts as $index => $file) {
            if (!is_object($file)) continue;
            $path = method_exists($file, 'getRealPath') ? $file->getRealPath() : false;
            if (!is_string($path) || $path === '') continue;
            $data = @file_get_contents($path);
            if ($data === false) continue;
            $result[(int) $index] = [
                'filename' => method_exists($file, 'getClientOriginalName') ? (string) $file->getClientOriginalName() : 'upload.bin',
                'contentType' => method_exists($file, 'getClientMimeType') ? (string) $file->getClientMimeType() : 'application/octet-stream',
                'data' => $data,
            ];
        }
        return $result;
    }

    private static function response(FlexDocResponse $response): IlluminateResponse
    {
        return new IlluminateResponse($response->body, $response->status, $response->headers());
    }
}
