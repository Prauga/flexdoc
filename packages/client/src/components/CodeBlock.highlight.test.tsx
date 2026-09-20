// The repo-wide react manual mock runs effects during render, before refs are
// attached, which cannot observe ref-scoped highlighting. Use real React here.
jest.unmock('react');

import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import path from 'node:path';
import PrismMock from 'prismjs';
import { CodeBlock } from './CodeBlock';

// CodeBlock loads prism-core plus individual grammars instead of the `prismjs`
// default bundle, which ships unused markup/css grammars and a duplicate
// javascript grammar. Dropping prism-clike, or registering a grammar before the
// one it extends, degrades highlighting to plain text without failing the build,
// so the real modules are exercised here rather than the Jest Prism mock.
describe('CodeBlock grammar registration', () => {
  const grammars = ['clike', 'json', 'yaml', 'javascript', 'bash', 'python', 'go', 'java'];

  it('registers every grammar CodeBlock highlights', () => {
    const resolve = (name: string) =>
      path.join(__dirname, '../../../../node_modules/prismjs/components', `${name}.js`);
    // Absolute paths bypass the `^prismjs/components/.*$` moduleNameMapper.
    const Prism = jest.requireActual(resolve('prism-core'));
    (globalThis as { Prism?: unknown }).Prism = Prism;
    for (const grammar of grammars) jest.requireActual(resolve(`prism-${grammar}`));

    for (const grammar of grammars) {
      expect(Prism.languages[grammar]).toBeDefined();
    }
    expect(Prism.highlight('func main() {}', Prism.languages.go, 'go')).toContain('token keyword');
    expect(Prism.highlight('public class Main {}', Prism.languages.java, 'java')).toContain('token keyword');
  });
});

describe('CodeBlock highlighting scope', () => {
  beforeEach(() => {
    (PrismMock.highlightElement as jest.Mock).mockClear();
    (PrismMock.highlightAll as jest.Mock).mockClear();
  });

  it('highlights only its own block', () => {
    const { container } = render(<CodeBlock code='{"ok":true}' language='json' />);
    const element = container.querySelector('code.language-json');

    expect(PrismMock.highlightElement).toHaveBeenCalledTimes(1);
    expect(PrismMock.highlightElement).toHaveBeenCalledWith(element);
    expect(PrismMock.highlightAll).not.toHaveBeenCalled();
  });
});
