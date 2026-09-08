import { Injectable } from '@nestjs/common';
import { FlexDocOptions } from './interfaces';
import { generateFlexDocHTML } from './template';

/** Programmatic HTML generation for NestJS consumers of FlexDoc. */
@Injectable()
export class FlexDocService {
  /**
   * Generate documentation HTML from an inline OpenAPI document.
   * @param spec Parsed OpenAPI document embedded into the generated page.
   * @param options Renderer configuration serialized into the page.
   * @returns Self-contained FlexDoc host HTML that loads the packaged renderer.
   */
  generateHTML(spec: object, options: FlexDocOptions = {}): string {
    return generateFlexDocHTML(spec as Record<string, unknown>, options);
  }

  /**
   * Generate documentation HTML that loads its OpenAPI document from a URL.
   * @param specUrl URL resolved by the generated page when it boots the renderer.
   * @param options Renderer configuration serialized into the page.
   * @returns Self-contained FlexDoc host HTML configured for the remote spec URL.
   */
  generateHTMLFromUrl(specUrl: string, options: FlexDocOptions = {}): string {
    return generateFlexDocHTML(null, { ...options, specUrl });
  }
}
