/* eslint-disable */
module.exports = {
  default: {
    requireModule: ["tsx"],
    require: [
      "tests/acceptance/setup.ts",
      "tests/acceptance/steps/**/*.ts",
    ],
    paths: ["tests/acceptance/features/**/*.feature"],
    format: ["progress-bar"],
  },
};
