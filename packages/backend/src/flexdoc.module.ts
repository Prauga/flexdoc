import {
  Module,
  DynamicModule,
  OnModuleInit,
  Inject,
  INestApplication,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { setupFlexDoc } from './setup';
import { FlexDocService } from './flexdoc.service';
import { FlexDocModuleOptions } from './interfaces';

/** NestJS module that registers FlexDoc routes on the underlying HTTP adapter. */
@Module({})
export class FlexDocModule implements OnModuleInit {
  /**
   * Create the NestJS module instance used by Nest's dependency injector.
   * @param options Resolved FlexDoc mount configuration registered by `forRoot` or `forRootAsync`.
   * @param httpAdapterHost NestJS adapter host used to reach the underlying Express/Fastify application.
   */
  constructor(
    @Inject('FLEXDOC_OPTIONS') private readonly options: FlexDocModuleOptions,
    private readonly httpAdapterHost?: HttpAdapterHost
  ) {}

  /** Register FlexDoc routes on the active NestJS HTTP adapter after module initialization. */
  onModuleInit(): void {
    if (!this.httpAdapterHost) {
      console.warn(
        'HttpAdapterHost not available. FlexDoc routes will not be registered.'
      );
      return;
    }

    // Get the underlying HTTP framework instance (Express/Fastify)
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    if (!httpAdapter) {
      console.warn(
        'HTTP Adapter not available. FlexDoc routes will not be registered.'
      );
      return;
    }

    // Get the native app instance (Express/Fastify app)
    const app = httpAdapter.getInstance();

    // Set up FlexDoc routes
    setupFlexDoc(app, this.options.path, {
      spec: this.options.spec,
      specUrl: this.options.specUrl,
      options: this.options.options,
    });
  }

  /**
   * Register FlexDoc with static NestJS module options.
   * @param options Documentation path, OpenAPI source, and renderer/backend options.
   * @returns Dynamic NestJS module exporting `FlexDocService`.
   */
  static forRoot(options: FlexDocModuleOptions): DynamicModule {
    return {
      module: FlexDocModule,
      providers: [
        FlexDocService,
        {
          provide: 'FLEXDOC_OPTIONS',
          useValue: options,
        },
      ],
      exports: [FlexDocService],
    };
  }

  /**
   * Register FlexDoc with options produced by a NestJS factory.
   * @param options Async factory configuration and optional dependency-injection tokens.
   * @returns Dynamic NestJS module exporting `FlexDocService`.
   */
  static forRootAsync(options: {
    /** Factory that returns or resolves the FlexDoc mount configuration. */
    useFactory: (
      ...args: any[]
    ) => Promise<FlexDocModuleOptions> | FlexDocModuleOptions;
    /** NestJS provider tokens injected into `useFactory` in order. */
    inject?: any[];
  }): DynamicModule {
    return {
      module: FlexDocModule,
      providers: [
        FlexDocService,
        {
          provide: 'FLEXDOC_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [FlexDocService],
    };
  }
}

