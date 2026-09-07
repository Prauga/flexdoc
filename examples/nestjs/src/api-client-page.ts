export function apiClientPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>FlexDoc NestJS API Client</title>
  <link rel="stylesheet" href="/docs/__flexdoc/renderer.css" />
  <style>html,body,#api-client{height:100%;margin:0}body{overflow:hidden;background:#030712;color:#f9fafb;font-family:system-ui,sans-serif}.showcase-header{box-sizing:border-box;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid #374151}.showcase-header a{color:#93c5fd}#api-client{height:calc(100% - 56px)}</style>
</head>
<body>
  <header class="showcase-header"><strong>FlexDoc NestJS API Client</strong><a href="/docs">API documentation</a></header>
  <main id="api-client"></main>
  <script src="/docs/__flexdoc/renderer.js"></script>
  <script>
    const origin = window.location.origin;
    window.FlexDocStandalone.mountApiClient(document.getElementById('api-client'), {
      theme: 'dark',
      persistenceKey: 'flexdoc-nestjs-3-api-client',
      initialRequest: { method: 'GET', url: origin + '/pets' },
      serverOptions: [{ url: origin, description: 'Current NestJS host' }],
      hostExecution: { available: true, endpoint: '/docs/__flexdoc/execute', cookiesEndpoint: '/docs/__flexdoc/cookies', capabilities: ['cookies','digest','hawk','oauth1','awsv4'] }
    });
  </script>
</body>
</html>`;
}
