module.exports = {
  preset: 'ts-jest',
  testEnvironment: '@happy-dom/jest-environment',
  moduleNameMapper: {
    // The core package is intentionally ESM-only. Client Jest runs through
    // ts-jest/CommonJS, so exercise the same core TypeScript implementation
    // directly instead of asking Jest to execute the built ESM files.
    '^\\.\\./\\.\\./\\.\\./\\.\\./core/dist/(.*)\\.js$': '<rootDir>/../../core/src/$1.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.cjs',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.cjs',
    '^prismjs$': '<rootDir>/__mocks__/prismjs.cjs',
    '^prismjs/components/.*$': '<rootDir>/__mocks__/prismjs.cjs',
    '^prismjs/themes/.*$': '<rootDir>/__mocks__/styleMock.cjs',
  },
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.cjs',
    '<rootDir>/src/setupTests.ts',
  ],
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: ['**/__tests__/**/*.{ts,tsx}', '**/*.{spec,test}.{ts,tsx}'],
};
