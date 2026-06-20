/**
 * src/がネイティブESMのため、babel変換は行わずNodeのネイティブESM実行に任せる
 * （実行は `node --experimental-vm-modules` 経由。package.jsonのtestスクリプト参照）。
 * jsdomが必要なテストはファイル単位の `@jest-environment jsdom` docblockで指定する。
 */
export default {
  testEnvironment: 'node',
  transform: {},
  // e2e specs (tests/e2e/*.spec.js) are Playwright's, not Jest's. Jest's default testMatch would
  // otherwise pick up *.spec.js, so keep that directory out of the unit run.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/e2e/'],
};
