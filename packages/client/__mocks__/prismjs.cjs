const Prism = {
  languages: {
    javascript: {},
    json: {},
    yaml: {},
    bash: {},
    markup: {},
    css: {},
  },
  highlight: jest.fn((code) => code),
  highlightAll: jest.fn(),
};

module.exports = Prism;
