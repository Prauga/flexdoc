import { Injectable } from '@nestjs/common';
import { FlexDocOptions } from './interfaces';
import { generateFlexDocHTML } from './template';

@Injectable()
export class FlexDocService {
  generateHTML(spec: object, options: FlexDocOptions = {}): string {
    return generateFlexDocHTML(spec, options);
  }

  generateHTMLFromUrl(specUrl: string, options: FlexDocOptions = {}): string {
    return generateFlexDocHTML(null, { ...options, specUrl });
  }
}