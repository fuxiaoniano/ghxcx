module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true, module: 'commonjs' }, diagnostics: false }]
  },
  transformIgnorePatterns: ['/node_modules/(?!\\.pnpm/|(?:htmlparser2|domhandler|domutils|dom-serializer|domelementtype|entities)/)'],
  collectCoverageFrom: ['src/**/*.ts'],
  testEnvironment: 'node'
};
