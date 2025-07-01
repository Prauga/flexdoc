import { FlexDocModuleOptions } from './interfaces';
import { generateFlexDocHTML } from './template';

// Using a more generic type to avoid version conflicts
interface AppWithUse {
  use: (path: string, handler: (req: any, res: any) => void) => void;
}

export function setupFlexDoc(
  app: AppWithUse,
  path: string,
  options: Omit<FlexDocModuleOptions, 'path'>
): void {
  const { spec, specUrl, options: flexDocOptions } = options;

  // Ensure path starts with a forward slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  app.use(normalizedPath, (req: any, res: any) => {
    const html = generateFlexDocHTML(spec || null, {
      ...flexDocOptions,
      specUrl,
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
}

