import { FlexDocModule } from './flexdoc.module';
import { setupFlexDoc } from './setup';

// NestJS 12 is ESM-only. This unit test exercises FlexDoc's module metadata and
// initialization behavior, not Nest's decorator/runtime implementation, so keep
// the Jest CommonJS test isolated from the framework runtime. Real NestJS 12
// compatibility is validated by building the NestJS example in CI.
jest.mock('@nestjs/common', () => ({
  Module: () => <T extends Function>(target: T) => target,
  Inject: () => () => undefined,
  Injectable: () => <T extends Function>(target: T) => target,
}));

jest.mock('@nestjs/core', () => ({
  HttpAdapterHost: class HttpAdapterHost {},
}));

jest.mock('./setup', () => ({
  setupFlexDoc: jest.fn(),
}));

describe('FlexDocModule', () => {
  let app: any;
  let mockHttpAdapterHost: any;

  beforeEach(() => {
    app = { use: jest.fn() };
    mockHttpAdapterHost = {
      httpAdapter: {
        getInstance: jest.fn().mockReturnValue(app),
      },
    };
    jest.clearAllMocks();
  });

  describe('forRoot', () => {
    it('registers static options and installs FlexDoc on module init', () => {
      const options = {
        path: '/api-docs',
        spec: { openapi: '3.0.0' },
      };

      const dynamicModule = FlexDocModule.forRoot(options);
      const optionsProvider = (dynamicModule.providers as any[]).find(
        (provider) => provider.provide === 'FLEXDOC_OPTIONS'
      );

      expect(optionsProvider.useValue).toBe(options);

      const module = new FlexDocModule(options, mockHttpAdapterHost);
      module.onModuleInit();

      expect(setupFlexDoc).toHaveBeenCalledWith(
        app,
        '/api-docs',
        expect.objectContaining({ spec: { openapi: '3.0.0' } })
      );
    });
  });

  describe('forRootAsync', () => {
    it('registers an async options factory and installs its result', async () => {
      const options = {
        path: '/api-docs',
        spec: { openapi: '3.0.0' },
      };
      const useFactory = jest.fn().mockResolvedValue(options);

      const dynamicModule = FlexDocModule.forRootAsync({ useFactory });
      const optionsProvider = (dynamicModule.providers as any[]).find(
        (provider) => provider.provide === 'FLEXDOC_OPTIONS'
      );
      const resolvedOptions = await optionsProvider.useFactory();

      expect(useFactory).toHaveBeenCalled();
      const module = new FlexDocModule(resolvedOptions, mockHttpAdapterHost);
      module.onModuleInit();

      expect(setupFlexDoc).toHaveBeenCalledWith(
        app,
        '/api-docs',
        expect.objectContaining({ spec: { openapi: '3.0.0' } })
      );
    });

    it('preserves dependency injection metadata for the options factory', async () => {
      const mockServiceToken = 'MockService';
      const mockService = {
        getSpec: jest.fn().mockReturnValue({ openapi: '3.0.0' }),
      };
      const useFactory = (service: typeof mockService) => ({
        path: '/api-docs',
        spec: service.getSpec(),
      });

      const dynamicModule = FlexDocModule.forRootAsync({
        useFactory,
        inject: [mockServiceToken],
      });
      const optionsProvider = (dynamicModule.providers as any[]).find(
        (provider) => provider.provide === 'FLEXDOC_OPTIONS'
      );

      expect(optionsProvider.inject).toEqual([mockServiceToken]);
      const resolvedOptions = await optionsProvider.useFactory(mockService);
      const module = new FlexDocModule(resolvedOptions, mockHttpAdapterHost);
      module.onModuleInit();

      expect(mockService.getSpec).toHaveBeenCalled();
      expect(setupFlexDoc).toHaveBeenCalledWith(
        app,
        '/api-docs',
        expect.objectContaining({ spec: { openapi: '3.0.0' } })
      );
    });
  });
});
