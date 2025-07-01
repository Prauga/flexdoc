// Mock for Prism.js
const Prism = {
  languages: {
    javascript: {},
    json: {},
    yaml: {},
    bash: {},
    markup: {},
    css: {},
  },
  highlight: jest.fn((code, language) => code),
  highlightAll: jest.fn(),
};

module.exports = Prism;

