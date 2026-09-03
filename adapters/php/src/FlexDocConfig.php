<?php

declare(strict_types=1);

namespace Prauga\FlexDoc;

final readonly class FlexDocConfig
{
    public string $path;

    public function __construct(
        string $path = '/docs',
        public string $specUrl = '/openapi.json',
        public string $title = 'API Reference',
        public string $theme = 'system',
        public bool $tryItEnabled = true,
    ) {
        $normalized = '/' . trim($path, '/');
        $this->path = $normalized === '/' ? '/docs' : $normalized;
        if (!in_array($theme, ['system', 'light', 'dark'], true)) {
            throw new \InvalidArgumentException('FlexDoc theme must be system, light, or dark.');
        }
    }
}
