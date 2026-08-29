import { FlexDocOptions } from './interfaces';
import { setupFlexDoc } from './setup';
import { generateFlexDocHTML } from './template';

jest.mock('./template', () => ({
  generateFlexDocHTML: jest.fn().mockReturnValue('<html>Mocked HTML</html>'),
}));

describe('setupFlexDoc', () => {
  let mockApp: any;
  let mockReq: any;
  let mockRes: any;
  let handler: (req: any, res: any) => void | Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockApp = {
      use: jest.fn().mockImplementation((_path, middleware) => {
        handler = middleware;
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

  it('should register middleware at the specified path', () => {
    setupFlexDoc(mockApp, '/docs', { spec: { openapi: '3.0.0' } });
    expect(mockApp.use).toHaveBeenCalledWith('/docs', expect.any(Function));
  });

  it('should normalize path to include leading slash', () => {
    setupFlexDoc(mockApp, 'docs', { spec: { openapi: '3.0.0' } });
    expect(mockApp.use).toHaveBeenCalledWith('/docs', expect.any(Function));
  });

  it('should generate HTML with spec when middleware is called', async () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
    };
    setupFlexDoc(mockApp, '/docs', { spec });

    await handler(mockReq, mockRes);

    expect(generateFlexDocHTML).toHaveBeenCalledWith(spec, expect.any(Object));
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(mockRes.send).toHaveBeenCalledWith('<html>Mocked HTML</html>');
  });

  it('should return a gateway error when specUrl cannot be loaded', async () => {
    setupFlexDoc(mockApp, '/docs', {
      specUrl: 'file:///tmp/openapi.json',
    });

    await handler(mockReq, mockRes);

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

  it('should pass flexDocOptions to generateFlexDocHTML', async () => {
    const flexDocOptions: FlexDocOptions = {
      theme: 'dark',
    };

    setupFlexDoc(mockApp, '/docs', {
      spec: { openapi: '3.0.0' },
      options: flexDocOptions,
    });

    await handler(mockReq, mockRes);

    expect(generateFlexDocHTML).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining(flexDocOptions)
    );
  });
});
