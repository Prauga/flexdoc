import { INestApplication } from '@nestjs/common';
import { FlexDocModuleOptions } from './interfaces';
import { generateFlexDocHTML } from './template';

export function setupFlexDoc(
  app: INestApplication,
  path: string,
  options: Omit<FlexDocModuleOptions, 'path'>
): void {
  const { spec, specUrl, options: flexDocOptions } = options;
  
  app.use(path, (req: any, res: any) => {
    const html = generateFlexDocHTML(spec, { ...flexDocOptions, specUrl });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
}