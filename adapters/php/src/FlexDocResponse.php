<?php

declare(strict_types=1);

namespace Prauga\FlexDoc;

final readonly class FlexDocResponse
{
    public function __construct(
        public int $status,
        public string $contentType,
        public string $body,
        public ?string $cacheControl = null,
    ) {}

    public function headers(): array
    {
        $headers = ['Content-Type' => $this->contentType, 'Content-Length' => (string) strlen($this->body)];
        if ($this->cacheControl !== null) $headers['Cache-Control'] = $this->cacheControl;
        return $headers;
    }
}
