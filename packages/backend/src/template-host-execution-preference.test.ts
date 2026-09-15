import { generateFlexDocHTML } from './template';
import type { FlexDocOptions } from './interfaces';

type HostPreferenceOptions = FlexDocOptions & {
  tryIt?: NonNullable<FlexDocOptions['tryIt']> & {
    hostExecution?: boolean | (Exclude<NonNullable<NonNullable<FlexDocOptions['tryIt']>['hostExecution']>, boolean> & { preferHostExecution?: boolean });
  };
};

function rendererOptions(html: string): Record<string, any> {
  const match = html.match(/window\.__FLEXDOC_OPTIONS__ = (.*);/);
  if (!match) throw new Error('renderer options were not serialized');
  return JSON.parse(match[1]);
}

describe('host execution renderer preference', () => {
  const hostExecutionPublic = {
    available: true,
    endpoint: '/docs/__flexdoc/execute',
    capabilities: [],
  };

  it('serializes an explicit false preference', () => {
    const options: HostPreferenceOptions = {
      tryIt: { hostExecution: { enabled: true, preferHostExecution: false } },
    };
    const rendered = rendererOptions(generateFlexDocHTML(null, {
      ...options,
      hostExecutionPublic,
    }));

    expect(rendered.tryIt.hostExecution.preferHostExecution).toBe(false);
  });

  it('defaults the serialized preference to true', () => {
    const rendered = rendererOptions(generateFlexDocHTML(null, {
      tryIt: { hostExecution: true },
      hostExecutionPublic,
    }));

    expect(rendered.tryIt.hostExecution.preferHostExecution).toBe(true);
  });
});
