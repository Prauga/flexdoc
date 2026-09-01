import { FlexDocOptions } from './interfaces';
import { setupFlexDoc } from './setup';
import { generateFlexDocHTML } from './template';
import { getRendererAssets } from './renderer-assets';

jest.mock('./template', () => ({
  generateFlexDocHTML: jest.fn().mockReturnValue('<html>Mocked HTML</html>'),
}));

jest.mock('./renderer-assets', () => ({
  getRendererAssets: jest.fn().mockReturnValue({
    javascript: 'window.renderer = true;',
    css: '.renderer { display: block; }',
    version: 'test-renderer-version',
  }),
}));

describe('setupFlexDoc', () => {
  let mockApp: any;
  let mockReq: any;
  let mockRes: any;
  let handlers: Map<string, (req: any, res: any) => void | Promise<void>>;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = new Map();

    mockApp = {
      use: jest.fn().mockImplementation((path, middleware) => {
        handlers.set(path, middleware);
      }),
    };

    mockReq = { headers: {} };
    mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
      end: jest.fn(),
      statusCode: 200,
    };
  });

  it('registers the page and canonical renderer asset routes', () => {
    setupFlexDoc(mockApp, '/docs', { spec: { openapi: '3.0.0' } });

    expect(handlers.has('/docs')).toBe(true);
    expect(handlers.has('/docs/__flexdoc/renderer.js')).toBe(true);
    expect(handlers.has('/docs/__flexdoc/renderer.css')).toBe(true);
  });

  it('normalizes path to include a leading slash', () => {
    setupFlexDoc(mockApp, 'docs', { spec: { openapi: '3.0.0' } });
    expect(handlers.has('/docs')).toBe(true);
  });

  it('serves the shared renderer bundle locally', async () => {
    setupFlexDoc(mockApp, '/docs', { spec: { openapi: '3.0.0' } });

    await handlers.get('/docs/__flexdoc/renderer.js')!(mockReq, mockRes);

    expect(getRendererAssets).toHaveBeenCalled();
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/javascript; charset=utf-8'
    );
    expect(mockRes.send).toHaveBeenCalledWith('window.renderer = true;');
  });

  it('generates HTML with the spec and renderer base path', async () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
    };
    setupFlexDoc(mockApp, '/docs', { spec });

    await handlers.get('/docs')!(mockReq, mockRes);

    expect(generateFlexDocHTML).toHaveBeenCalledWith(
      spec,
      expect.objectContaining({
        rendererBasePath: '/docs/__flexdoc',
        rendererVersion: 'test-renderer-version',
      })
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/html; charset=utf-8'
    );
    expect(mockRes.send).toHaveBeenCalledWith('<html>Mocked HTML</html>');
  });

  it('returns a gateway error when specUrl cannot be loaded', async () => {
    setupFlexDoc(mockApp, '/docs', {
      specUrl: 'file:///tmp/openapi.json',
    });

    await handlers.get('/docs')!(mockReq, mockRes);

    expect(generateFlexDocHTML).not.toHaveBeenCalled();
    expect(mockRes.statusCode).toBe(502);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; charset=utf-8'
    );
    expect(mockRes.end).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported OpenAPI spec URL protocol')
    );
  });

  it('passes FlexDoc options to the shared renderer host page', async () => {
    const flexDocOptions: FlexDocOptions = {
      theme: 'dark',
    };

    setupFlexDoc(mockApp, '/docs', {
      spec: { openapi: '3.0.0' },
      options: flexDocOptions,
    });

    await handlers.get('/docs')!(mockReq, mockRes);

    expect(generateFlexDocHTML).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        ...flexDocOptions,
        rendererBasePath: '/docs/__flexdoc',
        rendererVersion: 'test-renderer-version',
      })
    );
  });
});
