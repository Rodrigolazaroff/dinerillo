import next from "eslint-config-next";

// eslint-config-next ya viene en formato flat. Envolverlo con FlatCompat
// (lo que genera create-next-app) explota con "Converting circular structure
// to JSON" en ESLint 9.39.
export default [
  ...next,
  { ignores: [".next/**", "node_modules/**", ".test-build/**"] },
];
