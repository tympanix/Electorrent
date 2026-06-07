## Development code of conduct
After finished implementation, perform the following in order:
* Lint
* Build
* Smoketest

## Building
```shell
npm run build
```

## Linting
```shell
npm run lint
```

## Test exection
> IMPORTANT: Test must be executed without sandbox
```shell
npm run smoketest
```

# Coding Guidelines
* Testing MUST be performed with the smoketest command to reduce test scope
* Avoid using `browser.execute` in browser testing - prefer organic user interaction
* Avoid conditional logic based on client ID - deduce feature support from `TorrentClient`
* Use the Conventional Commits specification for commit messages and pull-requests
* Avoid unrelated code in `src/main/main.ts` to keep lean - prefer relevant module in `src/main/lib`
