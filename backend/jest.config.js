module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/index.js',
    '!src/__tests__/**',
  ],
  clearMocks: true,
  setupFiles: ['./src/__tests__/setup.js'],
  testTimeout: 10000,
};
