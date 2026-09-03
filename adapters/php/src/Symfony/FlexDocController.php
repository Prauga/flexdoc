<?php

declare(strict_types=1);

namespace Prauga\FlexDoc\Symfony;

use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\FlexDocResponse;
use Symfony\Component\HttpFoundation\Response;

final class FlexDocController
{
    public function __construct(private readonly FlexDocHost $host) {}

    public function documentation(): Response { return $this->response($this->host->documentation()); }
    public function rendererJavaScript(): Response { return $this->response($this->host->rendererJavaScript()); }
    public function rendererCss(): Response { return $this->response($this->host->rendererCss()); }

    private function response(FlexDocResponse $response): Response
    {
        return new Response($response->body, $response->status, $response->headers());
    }
}
