import { Test } from '@nestjs/testing';
import { FlexDocModule } from './flexdoc.module';
import { setupFlexDoc } from './setup';
import { HttpAdapterHost } from '@nestjs/core';

// Mock the setup function
jest.mock('./setup', () => ({
  setupFlexDoc: jest.fn(),
}));

describe('FlexDocModule', () => {
  let app: any;
  let mockHttpAdapterHost: any;

  beforeEach(() => {
    app = {
      use: jest.fn(),
    };

    mockHttpAdapterHost = {
      httpAdapter: {
        getInstance: jest.fn().mockReturnValue(app),
      },
    };

    jest.clearAllMocks();
  });

  describe('forRoot', () => {
    it('should register FlexDocModule with static options', async () => {
      const options = {
        path: '/api-docs',
        spec: { openapi: '3.0.0' },
      };

      const moduleRef = await Test.createTestingModule({
        imports: [FlexDocModule.forRoot(options)],
        providers: [
          {
            provide: HttpAdapterHost,
            useValue: mockHttpAdapterHost,
          },
        ],
      }).compile();

      const module = moduleRef.get(FlexDocModule);
      expect(module).toBeDefined();

      // Call onModuleInit to trigger setupFlexDoc
      const onModuleInitHook = moduleRef.get(FlexDocModule);
      onModuleInitHook.onModuleInit();

      // Verify setupFlexDoc was called with correct params
      expect(setupFlexDoc).toHaveBeenCalledWith(
        expect.anything(),
        '/api-docs',
        expect.objectContaining({ spec: { openapi: '3.0.0' } })
      );
    });
  });

  describe('forRootAsync', () => {
    it('should register FlexDocModule with async options', async () => {
      const options = {
        path: '/api-docs',
        spec: { openapi: '3.0.0' },
      };

      const moduleRef = await Test.createTestingModule({
        imports: [
          FlexDocModule.forRootAsync({
            useFactory: () => options,
          }),
        ],
        providers: [
          {
            provide: HttpAdapterHost,
            useValue: mockHttpAdapterHost,
          },
        ],
      }).compile();

      const module = moduleRef.get(FlexDocModule);
      expect(module).toBeDefined();

      // Call onModuleInit to trigger setupFlexDoc
      const onModuleInitHook = moduleRef.get(FlexDocModule);
      onModuleInitHook.onModuleInit();

      // Verify setupFlexDoc was called with correct params
      expect(setupFlexDoc).toHaveBeenCalledWith(
        expect.anything(),
        '/api-docs',
        expect.objectContaining({ spec: { openapi: '3.0.0' } })
      );
    });

    it('should inject dependencies into the options factory', async () => {
      const mockServiceToken = 'MockService';
      const mockService = {
        getSpec: jest.fn().mockReturnValue({ openapi: '3.0.0' }),
      };

      const moduleRef = await Test.createTestingModule({
        providers: [
          {
            provide: mockServiceToken,
            useValue: mockService,
          },
          {
            provide: HttpAdapterHost,
            useValue: mockHttpAdapterHost,
          },
        ],
        imports: [
          FlexDocModule.forRootAsync({
            useFactory: (service: typeof mockService) => ({
              path: '/api-docs',
              spec: service.getSpec(),
            }),
            inject: [mockServiceToken],
          }),
        ],
      }).compile();

      const module = moduleRef.get(FlexDocModule);
      expect(module).toBeDefined();

      // Call onModuleInit to trigger setupFlexDoc
      const onModuleInitHook = moduleRef.get(FlexDocModule);
      onModuleInitHook.onModuleInit();

      // Verify the mock service was used
      expect(mockService.getSpec).toHaveBeenCalled();
      expect(setupFlexDoc).toHaveBeenCalledWith(
        expect.anything(),
        '/api-docs',
        expect.objectContaining({ spec: { openapi: '3.0.0' } })
      );
    });
  });
});

