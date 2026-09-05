<?php

declare(strict_types=1);

namespace Prauga\FlexDoc;

final class FlexDocHost
{
    private string $javascript;
    private string $css;
    private string $fingerprint;

    public function __construct(
        private readonly FlexDocConfig $config = new FlexDocConfig(),
        ?string $assetsDir = null,
    ) {
        $directory = $assetsDir ?? dirname(__DIR__) . '/assets';
        $this->javascript = $this->readAsset($directory . '/flexdoc.standalone.js');
        $this->css = $this->readAsset($directory . '/flexdoc.standalone.css');
        $this->fingerprint = substr(hash('sha256', $this->javascript . "\0" . $this->css), 0, 16);
    }

    public function config(): FlexDocConfig { return $this->config; }

    public function responseForPath(string $path): FlexDocResponse
    {
        if ($path === $this->config->path || $path === $this->config->path . '/') return $this->documentation();
        if ($path === $this->config->path . '/__flexdoc/renderer.js') return $this->rendererJavaScript();
        if ($path === $this->config->path . '/__flexdoc/renderer.css') return $this->rendererCss();
        return new FlexDocResponse(404, 'text/plain; charset=utf-8', 'Not Found');
    }

    public function documentation(): FlexDocResponse
    {
        $tryIt = ['enabled' => $this->config->tryItEnabled];
        if ($this->config->tryItDefaultServer !== null) $tryIt['defaultServer'] = $this->config->tryItDefaultServer;
        if ($this->config->tryItCredentials !== null) $tryIt['credentials'] = $this->config->tryItCredentials;
        if ($this->config->tryItApiClientPersistenceKey !== null) $tryIt['apiClientPersistenceKey'] = $this->config->tryItApiClientPersistenceKey;

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

    public function rendererJavaScript(): FlexDocResponse
    {
        return new FlexDocResponse(200, 'application/javascript; charset=utf-8', $this->javascript, 'public, max-age=31536000, immutable');
    }

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
}
