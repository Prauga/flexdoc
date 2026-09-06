import { FlexDocOptions } from './interfaces';
import { generateFlexDocHTML } from './template';

describe('generateFlexDocHTML', () => {
  it('should generate HTML with embedded spec when provided', () => {
    const spec = { openapi: '3.1.0', info: { title: 'Test API', version: '1.0.0' }, paths: {} };
    const html = generateFlexDocHTML(spec);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test API</title>');
    expect(html).toContain('window.__FLEXDOC_SPEC__');
    expect(html).toContain(JSON.stringify(spec));
    expect(html).toContain('contractVersion');
  });

  it('should include specUrl when provided', () => {
    const specUrl = 'https://example.com/openapi.json';
    const html = generateFlexDocHTML(null, { specUrl });
    expect(html).toContain('window.__FLEXDOC_SPEC_URL__');
    expect(html).toContain(specUrl);
  });

  it('should include renderer theme and product options', () => {
    const options: FlexDocOptions = { theme: 'dark', tryIt: { enabled: true }, codeSamples: { languages: ['curl', 'go'] } };
    const html = generateFlexDocHTML(null, options);
    expect(html).toContain('window.__FLEXDOC_OPTIONS__');
    expect(html).toContain('"theme":"dark"');
    expect(html).toContain('"tryIt":{"enabled":true}');
  });

  it('cache-busts immutable renderer assets when their version changes', () => {
    const html = generateFlexDocHTML(null, {
      rendererBasePath: '/docs/__flexdoc',
      rendererVersion: 'abc123',
    });
    expect(html).toContain('/docs/__flexdoc/renderer.css?v=abc123');
    expect(html).toContain('/docs/__flexdoc/renderer.js?v=abc123');
  });

  it('never exposes route authentication secrets to the browser', () => {
    const html = generateFlexDocHTML(null, { auth: { type: 'basic', secretKey: 'super-secret-do-not-ship' } });
    expect(html).not.toContain('super-secret-do-not-ship');
    expect(html).not.toContain('secretKey');
  });


  it('never exposes host execution certificate material and only serializes explicit public capabilities', () => {
    const html = generateFlexDocHTML(null, {
      tryIt: {
        hostExecution: {
          clientCertificates: [{ id: 'private-cert', name: 'Private cert', cert: 'PEM-CERT-SECRET', key: 'PEM-KEY-SECRET', passphrase: 'pass-secret' }],
          allowedOrigins: ['https://api.example.test'],
        },
      },
      hostExecutionPublic: {
        available: true,
        endpoint: '/docs/__flexdoc/execute',
        cookiesEndpoint: '/docs/__flexdoc/cookies',
        capabilities: ['cookies', 'clientCertificates'],
        clientCertificates: [{ id: 'private-cert', name: 'Private cert' }],
      },
    });
    expect(html).not.toContain('PEM-CERT-SECRET');
    expect(html).not.toContain('PEM-KEY-SECRET');
    expect(html).not.toContain('pass-secret');
    expect(html).not.toContain('allowedOrigins');
    expect(html).toContain('"available":true');
    expect(html).toContain('"endpoint":"/docs/__flexdoc/execute"');
    expect(html).toContain('"id":"private-cert"');
    expect(html).toContain('"name":"Private cert"');
  });

  it('should handle null spec gracefully', () => {
    const html = generateFlexDocHTML(null);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('window.__FLEXDOC_SPEC__ = null');
  });
});
