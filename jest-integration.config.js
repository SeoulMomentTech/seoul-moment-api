module.exports = {
  displayName: 'integration',
  testMatch: ['**/test/**/*.spec.ts'],
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testTimeout: 60000,
  transform: {
    '^.+\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(@faker-js/faker)/)'],
  moduleNameMapper: {
    '^@app/database(|/.*)$': '<rootDir>/libs/database/src/$1',
    '^@app/config(|/.*)$': '<rootDir>/libs/config/src/$1',
    '^@app/repository(|/.*)$': '<rootDir>/libs/repository/src/$1',
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@app/external(|/.*)$': '<rootDir>/libs/external/src/$1',
    '^@app/http(|/.*)$': '<rootDir>/libs/http/src/$1',
    '^@app/cache(|/.*)$': '<rootDir>/libs/cache/src/$1',
    '^@app/auth(|/.*)$': '<rootDir>/libs/auth/src/$1',
    '^@app/socket(|/.*)$': '<rootDir>/libs/socket/src/$1',
    '^apps/(.*)$': '<rootDir>/apps/$1',
    '^libs/(.*)$': '<rootDir>/libs/$1',
  },
};
