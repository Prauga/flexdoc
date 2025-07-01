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

@Module({})
export class FlexDocModule implements OnModuleInit {
  constructor(
    @Inject('FLEXDOC_OPTIONS') private readonly options: FlexDocModuleOptions,
    private readonly httpAdapterHost?: HttpAdapterHost
  ) {}

  onModuleInit() {
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

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => Promise<FlexDocModuleOptions> | FlexDocModuleOptions;
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

