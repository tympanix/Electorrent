import eslint from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export default [
    {
        ignores: ["app/**", "node_modules/**"],
    },
    eslint.configs.recommended,
    ...typescriptEslint.configs["flat/recommended"],
    {
        languageOptions: {
            ecmaVersion: 2020,
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            sourceType: "module",
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-this-alias": "off",
            "preserve-caught-error": "off",
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            }],
        },
    },
    {
        files: ["src/renderer/**/*.ts"],
        languageOptions: {
            globals: {
                angular: "readonly",
            },
        },
    },
    {
        files: [
            "src/main/**/*.ts",
            "src/preload/**/*.ts",
            "src/shared/**/*.ts",
        ],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
    {
        files: ["test/**/*.ts"],
        languageOptions: {
            globals: globals.mocha,
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
        },
    },
];
