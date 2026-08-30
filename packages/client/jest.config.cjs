module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
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
