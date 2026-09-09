<?php

declare(strict_types=1);

namespace Prauga\FlexDoc\Symfony;

use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\FlexDocResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/** Symfony controller that serves FlexDoc routes from a shared {@see FlexDocHost}. */
final class FlexDocController
{
    public function __construct(private readonly FlexDocHost $host) {}

    public function documentation(): Response { return $this->response($this->host->documentation()); }
    public function rendererJavaScript(): Response { return $this->response($this->host->rendererJavaScript()); }
    public function rendererCss(): Response { return $this->response($this->host->rendererCss()); }

    /** Consume the canonical native execute envelope. */
    public function execute(Request $request): Response
    {
        return $this->response($this->host->executeRequest(
            self::headers($request),
            $request->getContent(),
            $request->request->all(),
            self::files($request->files->all()),
        ));
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

    private function response(FlexDocResponse $response): Response
    {
        return new Response($response->body, $response->status, $response->headers());
    }
}
