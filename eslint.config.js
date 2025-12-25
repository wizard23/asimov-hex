import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "cache/**",
      "public/**",
      "docs/**",
      "scripts/**",
      "shell/**",
      "src/core/utils/solver.ts",
      "src/core/utils/solver-cairo-pentagons-sorted.test.ts",
      "src/core/utils/solver-cairo-pentagons-unsorted.test.ts"
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  }
);
