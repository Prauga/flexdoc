import { BuiltRequest } from './request-builder';

export type CodeSampleLanguage = 'curl' | 'javascript' | 'python' | 'go' | 'java';

const q = (value: string) => JSON.stringify(value);

export function generateCodeSample(request: BuiltRequest, language: CodeSampleLanguage): string {
  const headers = Object.entries(request.headers);
  if (language === 'curl') {
    const parts = [`curl -X ${request.method} ${q(request.url)}`];
    for (const [name, value] of headers) parts.push(`  -H ${q(`${name}: ${value}`)}`);
    if (request.body) parts.push(`  --data-raw ${q(request.body)}`);
    return parts.join(' \\\n');
  }

  if (language === 'javascript') {
    const init: any = { method: request.method };
    if (headers.length) init.headers = request.headers;
    if (request.body) init.body = request.body;
    return `const response = await fetch(${q(request.url)}, ${JSON.stringify(init, null, 2)});\nconst data = await response.json();`;
  }

  if (language === 'python') {
    const lines = ['import requests', '', `url = ${q(request.url)}`];
    if (headers.length) lines.push(`headers = ${JSON.stringify(request.headers, null, 2)}`);
    if (request.body) lines.push(`body = ${q(request.body)}`);
    lines.push(`response = requests.request(${q(request.method)}, url${headers.length ? ', headers=headers' : ''}${request.body ? ', data=body' : ''})`, 'print(response.text)');
    return lines.join('\n');
  }

  if (language === 'go') {
    const body = request.body ? `strings.NewReader(${q(request.body)})` : 'nil';
    const lines = ['package main', '', 'import (', '  "fmt"', '  "io"', '  "net/http"'];
    if (request.body) lines.push('  "strings"');
    lines.push(')', '', 'func main() {', `  req, _ := http.NewRequest(${q(request.method)}, ${q(request.url)}, ${body})`);
    for (const [name, value] of headers) lines.push(`  req.Header.Set(${q(name)}, ${q(value)})`);
    lines.push('  res, err := http.DefaultClient.Do(req)', '  if err != nil { panic(err) }', '  defer res.Body.Close()', '  data, _ := io.ReadAll(res.Body)', '  fmt.Println(string(data))', '}');
    return lines.join('\n');
  }

  const lines = ['import java.net.URI;', 'import java.net.http.*;', '', 'var client = HttpClient.newHttpClient();', 'var builder = HttpRequest.newBuilder()', `    .uri(URI.create(${q(request.url)}))`];
  for (const [name, value] of headers) lines.push(`    .header(${q(name)}, ${q(value)})`);
  const publisher = request.body ? `HttpRequest.BodyPublishers.ofString(${q(request.body)})` : 'HttpRequest.BodyPublishers.noBody()';
  lines.push(`    .method(${q(request.method)}, ${publisher});`, 'var response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());', 'System.out.println(response.body());');
  return lines.join('\n');
}

export function languageLabel(language: CodeSampleLanguage): string {
  return ({ curl: 'cURL', javascript: 'JavaScript', python: 'Python', go: 'Go', java: 'Java' })[language];
}
