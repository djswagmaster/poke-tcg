module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: ['shared/**/*.js', 'server/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
