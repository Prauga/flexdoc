declare module 'prismjs' {
  const Prism: any;
  export default Prism;
}

declare module 'prismjs/components/prism-core' {
  const Prism: {
    languages: Record<string, unknown>;
    highlight(code: string, grammar: unknown, language: string): string;
    highlightElement(element: Element): void;
    highlightAll(): void;
  };
  export default Prism;
}

// Grammar modules are imported for their registration side effect only.
declare module 'prismjs/components/prism-clike';
declare module 'prismjs/components/prism-json';
declare module 'prismjs/components/prism-yaml';
declare module 'prismjs/components/prism-javascript';
declare module 'prismjs/components/prism-bash';
declare module 'prismjs/components/prism-python';
declare module 'prismjs/components/prism-go';
declare module 'prismjs/components/prism-java';
