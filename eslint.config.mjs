import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Expo app has its own lint/typecheck setup (mobile/eslint.config.js).
    "mobile/**",
    "camera-dataset/**",
    "camera-yolo/**",
    "db-export/**",
    "coverage/**",
  ]),

  // Everyday correctness for every file.
  {
    rules: {
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-debugger": "error",
      "no-implicit-coercion": ["error", { allow: ["!!"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // Type-aware rules: the ones that catch real bugs (forgotten awaits,
  // promises passed where a callback is expected, non-exhaustive switches).
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: true, allowDefaultCaseForExhaustiveSwitch: true },
      ],
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },

  // Tests and one-off scripts may log and use looser patterns.
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "scripts/**", "lib/db/seed.ts"],
    rules: { "no-console": "off" },
  },
]);

export default eslintConfig;
