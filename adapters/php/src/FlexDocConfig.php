<?php

declare(strict_types=1);

namespace Prauga\FlexDoc;

/**
 * FlexDoc renderer configuration.
 *
 * Normalizes {@see $path} on construction and validates theme and Try It credential values.
 */
final readonly class FlexDocConfig
{
    /** Normalized docs mount path. */
    public string $path;

    /**
     * @param string $path Docs mount path.
     * @param string $specUrl OpenAPI document URL resolved by the browser bootstrap page.
     * @param string $title Page and renderer title.
     * @param string $theme Renderer theme preset: `system`, `light`, or `dark`.
     * @param bool $tryItEnabled Whether the Try It client is enabled.
     * @param string|array<int, string>|null $expand Optional expansion preset or section list.
     * @param string|null $tryItDefaultServer Optional default server URL for Try It requests.
     * @param string|null $tryItCredentials Optional fetch credentials mode: `omit`, `same-origin`, or `include`.
     * @param string|false|null $tryItApiClientPersistenceKey Optional persistence key, or `false` to disable.
     * @param bool $tryItHostExecution Emits host-execution protocol metadata; execution is not implemented by this adapter.
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
        public bool $tryItHostExecution = false,
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
