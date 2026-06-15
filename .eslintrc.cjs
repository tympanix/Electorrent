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
    overrides: [
        {
            files: ["src/renderer/**/*.ts"],
            globals: {
                angular: "readonly",
            },
        },
        {
            files: [
                "src/main/**/*.ts",
                "src/preload/**/*.ts",
            ],
            rules: {
                "@typescript-eslint/no-explicit-any": "off",
            },
        },
        {
            files: ["test/**/*.ts"],
            env: {
                mocha: true,
            },
            rules: {
                "@typescript-eslint/no-explicit-any": "off",
                "@typescript-eslint/no-non-null-assertion": "off",
            },
        },
    ],
};
