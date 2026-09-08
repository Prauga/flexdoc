<?php

declare(strict_types=1);

namespace Prauga\FlexDoc\Symfony;

use Prauga\FlexDoc\FlexDocHost;
use Prauga\FlexDoc\FlexDocResponse;
use Symfony\Component\HttpFoundation\Response;

/** Symfony controller that serves FlexDoc routes from a shared {@see FlexDocHost}. */
final class FlexDocController
{
    /**
     * Create a Symfony controller backed by a configured FlexDoc host.
     *
     * @param FlexDocHost $host Host used to generate docs and renderer responses.
     */
    public function __construct(private readonly FlexDocHost $host) {}

    /** @return Response HTML documentation shell response. */
    public function documentation(): Response { return $this->response($this->host->documentation()); }

    /** @return Response Packaged renderer JavaScript response. */
    public function rendererJavaScript(): Response { return $this->response($this->host->rendererJavaScript()); }

    /** @return Response Packaged renderer CSS response. */
    public function rendererCss(): Response { return $this->response($this->host->rendererCss()); }

    private function response(FlexDocResponse $response): Response
    {
        return new Response($response->body, $response->status, $response->headers());
    }
}
