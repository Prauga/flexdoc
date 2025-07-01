import { Module, DynamicModule } from '@nestjs/common';
import { FlexDocService } from './flexdoc.service';
import { FlexDocModuleOptions } from './interfaces';

@Module({})
export class FlexDocModule {
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
