const path = require('path');

const ts = (jestRules) => ({
  files: jestRules ? '**/__tests__/**/*.ts' : '*.ts',
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  settings: {
    'import/external-module-folders': ['./node_modules', './node_modules/@types'],
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.d.ts', '.tsx'],
        moduleDirectory: [
          'node_modules',
          'node_modules/@types',
          path.resolve(path.join(__dirname, 'node_modules')),
          path.resolve(path.join(__dirname, 'node_modules', '@types')),
          'src',
        ],
      },
    },
  },
  extends: [
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'prettier',
  ].concat(jestRules ? ['plugin:jest/all'] : []),
  rules: {
    'no-param-reassign': 'off',
    'arrow-body-style': ['error', 'always'],
    'jest/no-conditional-expect': 'off',
    'jest/prefer-to-be': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
});

module.exports = {
  root: true,
  plugins: ['tsc', 'prettier', 'import', 'jest'],
  overrides: [
    {
      files: '*.js',
      extends: ['eslint-config-airbnb/base', 'prettier'],
    },
    ts(),
    ts(true),
  ],
};
