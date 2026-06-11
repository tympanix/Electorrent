## Development code of conduct
After finished implementation, perform the following in order:
* Lint
* Build
* Test

## Building
```shell
npm run build
```

## Linting
```shell
npm run lint
```

## Test
Pick a test strategy from context:
* If user requested particular tests -> run user requested tests
* If changes scoped to particular feature -> run targeted tests
* Otherwise -> run smoketest

### Targeted test
* <suite>: affected bittorrent client or `qbittorrent:latest` by default
* <testcase>: glob for test case related to impacted feature
```shell
npm run test -- --suite "<suite>" --mochaOpts.grep "<testcase>"
```

### Smoketest
```shell
npm run smoketest
```

# Coding Guidelines
* Avoid using `browser.execute` in browser testing - prefer organic user interaction
* Avoid conditional logic based on client ID - deduce feature support from `TorrentClient`
* Use the Conventional Commits specification for commit messages and pull-requests
