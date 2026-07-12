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
* <client>: affected bittorrent client or `qbittorrent:latest` by default
* <spec>: a spec file in the directory `test/specs`
```shell
npm run test -- --client "<client>" --spec "<spec>"
```

> NOTE: A single test case within a spec may be targeted with `--mochaOpts.grep "<grep>"`

### Smoketest
```shell
npm run smoketest
```

# Coding Guidelines
* Avoid using `browser.execute` in browser testing - prefer organic user interaction
* Avoid conditional logic based on client ID - deduce feature support from `TorrentClient`
* The `BittorrentRuntime` MUST return all `n` torrents from `getSnapshot` in `O(1)` HTTP calls
* Use the Conventional Commits specification for commit messages and pull-requests

# Behaviour triggers
Keywords at the start of a user prompt followed by colon (`:`) may trigger certain behaviour. Keywords are only applicable for the current prompt.
* `quickedit`: Only implement/write code without performing validation (build, lint, test, etc.)
* `question`|`q`: Respond to the user. May search, read and investigate codebase - no edits or mutation of source code

**Examples:**
> Q: What file is responsible for authentication?
