import { FlexDocOptions } from './interfaces';
import { generateFlexDocHTML } from './template';

describe('generateFlexDocHTML', () => {
  it('should generate HTML with embedded spec when provided', () => {
    const spec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      paths: {},
    };

    const html = generateFlexDocHTML(spec);

    // Check that the HTML contains key elements
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test API</title>');
    expect(html).toContain('window.__FLEXDOC_SPEC__');
    expect(html).toContain(JSON.stringify(spec));
  });

  it('should include specUrl when provided', () => {
    const specUrl = 'https://example.com/openapi.json';

    const html = generateFlexDocHTML(null, { specUrl });

    expect(html).toContain('window.__FLEXDOC_SPEC_URL__');
    expect(html).toContain(specUrl);
  });

  it('should include theme options when provided', () => {
    const options: FlexDocOptions = {
      theme: 'dark',
      theme_: {
        colors: {
          primary: '#123456',
        },
      },
    };

    const html = generateFlexDocHTML(null, options);

    expect(html).toContain('window.__FLEXDOC_OPTIONS__');
    expect(html).toContain(JSON.stringify(options));
  });

  it('should handle null spec gracefully', () => {
    const html = generateFlexDocHTML(null);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('window.__FLEXDOC_SPEC__ = null');
  });
});

