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

# Guidelines
* Testing MUST be performed with the smoketest command to reduce test scope
* Avoid using `browser.execute` in browser testing - prefer organic user interaction
* Use the Conventional Commits specification for commit messages and pull-requests

