## Development code of conduct
After finished implementation, perform the following:
* Build the project
* Execute smoketest for the project

## Building
The project is built with:
```shell
npm run build
```

## Test exection
Validation of the codebase is performed with:
```shell
npm run smoketest
```

## External NodeJS packages
The following client API implementations are maintained in separate packages:
* `@electorrent/node-qbittorrent`
* `@electorrent/node-deluge`
* `@electorrent/node-rtorrent`

Development of local changes in the above packages:
1. Git clone the NodeJS package
2. Use `npm link` in the directory of the dependency
3. Use `npm link <package>` in this project

# Guidelines
* Testing MUST be performed with the smoketest command to reduce test scope
* Avoid using `browser.execute` in browser testing - prefer organic user interaction
* Business logic MUST NOT use conditional logic based on client ID - deduce decisions from `TorrentClient`
* Use the Conventional Commits specification for commit messages and pull-requests

