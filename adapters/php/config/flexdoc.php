<?php

return [
    'path' => env('FLEXDOC_PATH', '/docs'),
    'spec_url' => env('FLEXDOC_SPEC_URL', '/openapi.json'),
    'title' => env('FLEXDOC_TITLE', 'API Reference'),
    'theme' => env('FLEXDOC_THEME', 'system'),
    'try_it_enabled' => env('FLEXDOC_TRY_IT', true),
];
