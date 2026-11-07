const base = require('./jest.config');

// Runs only the suites that require a live PostgreSQL server.
module.exports = {
  ...base,
  roots: ['<rootDir>/test'],
  testPathIgnorePatterns: ['/node_modules/'],
  testRegex: '\\.postgres\\.spec\\.ts$',
  // One suite at a time, and only with `--runInBand` on the command line (see
  // the test:postgres script): `maxWorkers: 1` still recycles a child worker
  // between suites, and on Windows that recycle aborts the run (0xC0000409,
  // exit 3221226505) with no output at all — which is how interrupted runs
  // used to leave `pg-hist-*` fixtures behind, since the abort happens before
  // any cleanup hook gets a turn.
  maxWorkers: 1,
};
