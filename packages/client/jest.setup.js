// Import jest-dom matchers
require('@testing-library/jest-dom');

// Mock for ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

