<?php

declare(strict_types=1);

namespace Prauga\FlexDoc\Symfony;

use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\FlexDocResponse;
use Symfony\Component\HttpFoundation\Response;

/** Symfony controller that serves FlexDoc routes from a shared {@see FlexDocHost}. */
final class FlexDocController
{
    public function __construct(private readonly FlexDocHost $host) {}

    /** Serve the HTML docs shell. */
    public function documentation(): Response { return $this->response($this->host->documentation()); }

    /** Serve the packaged renderer JavaScript asset. */
    public function rendererJavaScript(): Response { return $this->response($this->host->rendererJavaScript()); }

    /** Serve the packaged renderer CSS asset. */
    public function rendererCss(): Response { return $this->response($this->host->rendererCss()); }

    private function response(FlexDocResponse $response): Response
    {
        return new Response($response->body, $response->status, $response->headers());
    }
}
