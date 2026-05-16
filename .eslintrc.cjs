module.exports = {
    root: true,
    env: {
        browser: true,
        es2020: true,
        node: true,
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
    },
    plugins: ["@typescript-eslint"],
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
    },
    overrides: [
        {
            files: ["src/renderer/**/*.ts"],
            globals: {
                angular: "readonly",
            },
        },
        {
            files: ["test/**/*.ts"],
            env: {
                mocha: true,
            },
            rules: {
                "@typescript-eslint/no-non-null-assertion": "off",
            },
        },
    ],
};
