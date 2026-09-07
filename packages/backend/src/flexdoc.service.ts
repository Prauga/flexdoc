import { Injectable } from '@nestjs/common';
import { FlexDocOptions } from './interfaces';
import { generateFlexDocHTML } from './template';

/** Programmatic HTML generation for NestJS consumers of FlexDoc. */
@Injectable()
export class FlexDocService {
  /** Generate documentation HTML from an inline OpenAPI document. */
  generateHTML(spec: object, options: FlexDocOptions = {}): string {
    return generateFlexDocHTML(spec as Record<string, unknown>, options);
  }

  /** Generate documentation HTML by loading an OpenAPI document from a URL. */
  generateHTMLFromUrl(specUrl: string, options: FlexDocOptions = {}): string {
    return generateFlexDocHTML(null, { ...options, specUrl });
  }
}
