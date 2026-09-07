<?php

declare(strict_types=1);

namespace Prauga\FlexDoc;

/** HTTP response produced by {@see FlexDocHost}. */
final readonly class FlexDocResponse
{
    /**
     * @param int $status HTTP status code.
     * @param string $contentType Response content type.
     * @param string $body Response body.
     * @param string|null $cacheControl Optional Cache-Control header value.
     */
    public function __construct(
        public int $status,
        public string $contentType,
        public string $body,
        public ?string $cacheControl = null,
    ) {}

    /** @return array<string, string> Response headers including Content-Type and Content-Length. */
    public function headers(): array
    {
        $headers = ['Content-Type' => $this->contentType, 'Content-Length' => (string) strlen($this->body)];
        if ($this->cacheControl !== null) $headers['Cache-Control'] = $this->cacheControl;
        return $headers;
    }
}
