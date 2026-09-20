// Mirrors the grammars CodeBlock registers from prism-core. Keep in sync with
// the import list there; CodeBlock.highlight.test.tsx checks the real modules.
const Prism = {
  languages: {
    clike: {},
    javascript: {},
    json: {},
    yaml: {},
    bash: {},
    python: {},
    go: {},
    java: {},
  },
  highlight: jest.fn((code) => code),
  highlightElement: jest.fn(),
  highlightAll: jest.fn(),
};

module.exports = Prism;
