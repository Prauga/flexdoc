<?php

declare(strict_types=1);

namespace Prauga\FlexDoc;

final readonly class FlexDocConfig
{
    public string $path;

    /**
     * @param string|array<int, string>|null $expand
     * @param string|false|null $tryItApiClientPersistenceKey
     */
    public function __construct(
        string $path = '/docs',
        public string $specUrl = '/openapi.json',
        public string $title = 'API Reference',
        public string $theme = 'system',
        public bool $tryItEnabled = true,
        public string|array|null $expand = null,
        public ?string $tryItDefaultServer = null,
        public ?string $tryItCredentials = null,
        public string|false|null $tryItApiClientPersistenceKey = null,
    ) {
        $normalized = '/' . trim($path, '/');
        $this->path = $normalized === '/' ? '/docs' : $normalized;
        if (!in_array($theme, ['system', 'light', 'dark'], true)) {
            throw new \InvalidArgumentException('FlexDoc theme must be system, light, or dark.');
        }
        if ($tryItCredentials !== null && !in_array($tryItCredentials, ['omit', 'same-origin', 'include'], true)) {
            throw new \InvalidArgumentException('FlexDoc Try It credentials must be omit, same-origin, or include.');
        }
    }
}
