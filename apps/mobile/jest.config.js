module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
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
