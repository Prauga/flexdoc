import { FlexDocOptions } from './interfaces';
import { setupFlexDoc } from './setup';
import { generateFlexDocHTML } from './template';

// Mock the template module
jest.mock('./template', () => ({
  generateFlexDocHTML: jest.fn().mockReturnValue('<html>Mocked HTML</html>'),
}));

describe('setupFlexDoc', () => {
  let mockApp: any;
  let mockReq: any;
  let mockRes: any;
  let handler: (req: any, res: any) => void;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock Express/NestJS app
    mockApp = {
      use: jest.fn().mockImplementation((path, middleware) => {
        handler = middleware;
      }),
    };

    // Mock request and response objects
    mockReq = {};
    mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
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

  it('should generate HTML with spec when middleware is called', () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
    };
    setupFlexDoc(mockApp, '/docs', { spec });

    // Call the middleware handler
    handler(mockReq, mockRes);

    expect(generateFlexDocHTML).toHaveBeenCalledWith(spec, expect.any(Object));
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(mockRes.send).toHaveBeenCalledWith('<html>Mocked HTML</html>');
  });

  it('should pass null when spec is undefined', () => {
    setupFlexDoc(mockApp, '/docs', {
      specUrl: 'https://example.com/openapi.json',
    });

    // Call the middleware handler
    handler(mockReq, mockRes);

    expect(generateFlexDocHTML).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        specUrl: 'https://example.com/openapi.json',
      })
    );
  });

  it('should pass flexDocOptions to generateFlexDocHTML', () => {
    const flexDocOptions: FlexDocOptions = {
      theme: 'dark',
    };

    setupFlexDoc(mockApp, '/docs', {
      spec: { openapi: '3.0.0' },
      options: flexDocOptions,
    });

    // Call the middleware handler
    handler(mockReq, mockRes);

    expect(generateFlexDocHTML).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining(flexDocOptions)
    );
  });
});

