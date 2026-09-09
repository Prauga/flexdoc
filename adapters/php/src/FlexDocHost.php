<?php

declare(strict_types=1);

namespace Prauga\FlexDoc;

/**
 * Framework-neutral FlexDoc host serving the HTML shell, packaged assets, and optional native execute transport.
 */
final class FlexDocHost
{
    private string $javascript;
    private string $css;
    private string $fingerprint;

    /**
     * Create a FlexDoc host and load its canonical renderer assets.
     *
     * @param FlexDocConfig $config Renderer and route configuration for the host.
     * @param string|null $assetsDir Optional asset directory override for development/testing.
     */
    public function __construct(
        private readonly FlexDocConfig $config = new FlexDocConfig(),
        ?string $assetsDir = null,
    ) {
        $directory = $assetsDir ?? dirname(__DIR__) . '/assets';
        $this->javascript = $this->readAsset($directory . '/flexdoc.standalone.js');
        $this->css = $this->readAsset($directory . '/flexdoc.standalone.css');
        $this->fingerprint = substr(hash('sha256', $this->javascript . "\0" . $this->css), 0, 16);
    }

    /** @return FlexDocConfig Configured host settings. */
    public function config(): FlexDocConfig { return $this->config; }

    /** Whether this host can truthfully own the native execute route. */
    public function executionAvailable(): bool
    {
        return $this->config->tryItHostExecution && $this->config->hostExecution instanceof HostExecution;
    }

    /**
     * Match a GET request path and return the docs shell, renderer asset, or 404 response.
     */
    public function responseForPath(string $path): FlexDocResponse
    {
        return $this->responseForRequest('GET', $path);
    }

    /**
     * Match a framework-neutral request, including the optional native execute route.
     *
     * Multipart callers should pass parsed form fields and uploaded file parts. Files are keyed by
     * canonical `formData` index and contain `filename`, `contentType`, and raw `data`.
     *
     * @param array<string, string> $headers Request headers.
     * @param array<string, mixed> $formFields Parsed multipart form fields.
     * @param array<int, array{filename?: string, contentType?: string, data: string}> $files Parsed canonical file parts.
     */
    public function responseForRequest(
        string $method,
        string $path,
        array $headers = [],
        string $body = '',
        array $formFields = [],
        array $files = [],
    ): FlexDocResponse {
        $executePath = $this->config->path . '/__flexdoc/execute';
        if ($path === $executePath) {
            if (strtoupper($method) !== 'POST' || !$this->executionAvailable()) {
                return new FlexDocResponse(404, 'text/plain; charset=utf-8', 'Not Found');
            }
            return $this->executeRequest($headers, $body, $formFields, $files);
        }

        if (strtoupper($method) !== 'GET') return new FlexDocResponse(404, 'text/plain; charset=utf-8', 'Not Found');
        if ($path === $this->config->path || $path === $this->config->path . '/') return $this->documentation();
        if ($path === $this->config->path . '/__flexdoc/renderer.js') return $this->rendererJavaScript();
        if ($path === $this->config->path . '/__flexdoc/renderer.css') return $this->rendererCss();
        return new FlexDocResponse(404, 'text/plain; charset=utf-8', 'Not Found');
    }

    /**
     * Consume the canonical JSON or framework-parsed multipart execute envelope.
     *
     * @param array<string, string> $headers Request headers.
     * @param array<string, mixed> $formFields Parsed multipart form fields.
     * @param array<int, array{filename?: string, contentType?: string, data: string}> $files Uploaded canonical file parts.
     */
    public function executeRequest(array $headers, string $body = '', array $formFields = [], array $files = []): FlexDocResponse
    {
        if (!$this->executionAvailable()) return new FlexDocResponse(404, 'text/plain; charset=utf-8', 'Not Found');

        $marker = self::requestHeader($headers, 'x-flexdoc-execute');
        if ($marker !== '1') return self::executionJson(403, ['error' => 'Missing X-FlexDoc-Execute header.']);

        $contentType = self::requestHeader($headers, 'content-type');
        if ($contentType === null) return self::executionJson(400, ['error' => 'Host execution requires application/json or multipart/form-data.']);
        $mediaType = strtolower(trim(explode(';', $contentType, 2)[0]));

        $totalBytes = strlen($body);
        foreach ($formFields as $value) if (is_string($value)) $totalBytes += strlen($value);
        foreach ($files as $file) if (is_array($file) && isset($file['data']) && is_string($file['data'])) $totalBytes += strlen($file['data']);
        if ($totalBytes > HostExecution::MAX_REQUEST_BYTES) {
            return self::executionJson(400, ['error' => 'Host execution request exceeded the 32 MiB safety limit.']);
        }

        try {
            if ($mediaType === 'application/json') {
                $envelope = self::decodeJsonObject($body, 'Host execution body must be valid UTF-8 JSON object.');
                $files = [];
            } elseif ($mediaType === 'multipart/form-data') {
                $descriptor = $formFields['descriptor'] ?? null;
                if (!is_string($descriptor)) {
                    return self::executionJson(400, ['error' => 'Host execution multipart request requires a descriptor.']);
                }
                $envelope = self::decodeJsonObject($descriptor, 'Host execution multipart descriptor must be valid UTF-8 JSON object.');
            } else {
                return self::executionJson(400, ['error' => 'Host execution requires application/json or multipart/form-data.']);
            }
        } catch (\JsonException) {
            $message = $mediaType === 'multipart/form-data'
                ? 'Host execution multipart descriptor must be valid UTF-8 JSON object.'
                : 'Host execution body must be valid UTF-8 JSON object.';
            return self::executionJson(400, ['error' => $message]);
        }

        $result = $this->config->hostExecution->handle($marker, $envelope, $files);
        return self::executionJson($result['status'], $result['body']);
    }

    /** @return FlexDocResponse No-cache HTML documentation shell. */
    public function documentation(): FlexDocResponse
    {
        $tryIt = ['enabled' => $this->config->tryItEnabled];
        if ($this->config->tryItDefaultServer !== null) $tryIt['defaultServer'] = $this->config->tryItDefaultServer;
        if ($this->config->tryItCredentials !== null) $tryIt['credentials'] = $this->config->tryItCredentials;
        if ($this->config->tryItApiClientPersistenceKey !== null) $tryIt['apiClientPersistenceKey'] = $this->config->tryItApiClientPersistenceKey;
        if ($this->config->tryItHostExecution) {
            $tryIt['hostExecution'] = [
                'available' => $this->executionAvailable(),
                'endpoint' => $this->config->path . '/__flexdoc/execute',
                'capabilities' => $this->executionAvailable() ? $this->config->hostExecution->capabilities() : [],
            ];
        }

        $options = [
            'contractVersion' => '1',
            'title' => $this->config->title,
            'theme' => $this->config->theme,
            'tryIt' => $tryIt,
        ];
        if ($this->config->expand !== null) $options['expand'] = $this->config->expand;

        $title = htmlspecialchars($this->config->title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $path = htmlspecialchars($this->config->path, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $specUrl = self::safeJson($this->config->specUrl);
        $optionsJson = self::safeJson($options);
        $version = $this->fingerprint;
        $html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>' . $title . '</title><link rel="stylesheet" href="' . $path . '/__flexdoc/renderer.css?v=' . $version . '"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__=' . $specUrl . ';window.__FLEXDOC_OPTIONS__=' . $optionsJson . ';</script><script src="' . $path . '/__flexdoc/renderer.js?v=' . $version . '"></script><script>(async function(){const root=document.getElementById(\'flexdoc-root\');try{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error(\'Unable to load OpenAPI specification: HTTP \'+response.status);const spec=await response.json();const config={spec:spec,options:window.__FLEXDOC_OPTIONS__||{},baseUri:baseUri};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}catch(error){root.textContent=error instanceof Error?error.message:String(error);}})();</script></body></html>';
        return new FlexDocResponse(200, 'text/html; charset=utf-8', $html, 'no-cache');
    }

    /** @return FlexDocResponse Immutable packaged renderer JavaScript asset. */
    public function rendererJavaScript(): FlexDocResponse
    {
        return new FlexDocResponse(200, 'application/javascript; charset=utf-8', $this->javascript, 'public, max-age=31536000, immutable');
    }

    /** @return FlexDocResponse Immutable packaged renderer CSS asset. */
    public function rendererCss(): FlexDocResponse
    {
        return new FlexDocResponse(200, 'text/css; charset=utf-8', $this->css, 'public, max-age=31536000, immutable');
    }

    private function readAsset(string $path): string
    {
        $content = @file_get_contents($path);
        if ($content === false) throw new \RuntimeException("Packaged FlexDoc renderer asset is missing: {$path}");
        return $content;
    }

    private static function safeJson(mixed $value): string
    {
        return json_encode($value, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    /** @param array<string, string> $headers */
    private static function requestHeader(array $headers, string $name): ?string
    {
        foreach ($headers as $key => $value) if (strtolower($key) === strtolower($name)) return $value;
        return null;
    }

    /** @return array<string, mixed> */
    private static function decodeJsonObject(string $json, string $message): array
    {
        $object = json_decode($json, false, flags: JSON_THROW_ON_ERROR);
        if (!is_object($object)) throw new \JsonException($message);
        /** @var array<string, mixed> $decoded */
        $decoded = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        return $decoded;
    }

    /** @param array<string, mixed> $payload */
    private static function executionJson(int $status, array $payload): FlexDocResponse
    {
        return new FlexDocResponse(
            $status,
            'application/json; charset=utf-8',
            json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            'no-store',
        );
    }
}
