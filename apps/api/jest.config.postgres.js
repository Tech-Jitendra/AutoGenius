const base = require('./jest.config');

// Runs only the suites that require a live PostgreSQL server.
module.exports = {
  ...base,
  roots: ['<rootDir>/test'],
  testPathIgnorePatterns: ['/node_modules/'],
  testRegex: '\\.postgres\\.spec\\.ts$',
  maxWorkers: 1,
};
