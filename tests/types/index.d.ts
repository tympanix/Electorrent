// Augment global mocha context with custom attributes
declare namespace Mocha {
  interface Context {
    app: import("../e2e").App
    spectron: import("spectron").Application
  }
}
