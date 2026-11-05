module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  /**
   * Rendering a TanStack Query screen waits on real timers, and jest's default
   * 5000 ms is not enough when the machine is busy (a live-PostgreSQL run or an
   * Expo export alongside it). The test then times out mid-render, which
   * unmounts the tree and makes every later test in the same suite fail with
   * "Can't access .root on unmounted test renderer" — a cascade that hides the
   * real assertion. The extra headroom costs nothing when the box is idle
   * (these tests run in well under a second) and stops a loaded machine from
   * reporting a broken screen.
   */
  testTimeout: 15000,
  moduleNameMapper: {
    // The workspace installs its own React, while npm also hoists a second copy
    // to the repository root. Renderer and app must share one copy or every hook
    // call inside a component test throws "Invalid hook call".
    '^react$': '<rootDir>/node_modules/react',
    '^@autogenius/(.*)$': '<rootDir>/../../packages/$1/src',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};
