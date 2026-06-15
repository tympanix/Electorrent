import "@wdio/electron-types"

// Augment global mocha context with custom attributes
declare global {
  const angular: angular.IAngularStatic

  namespace Mocha {
    interface Context {
      app: import("../e2e").App
      backend: import("../shared/compose").DockerComposeService
      torrentPath: string
    }
  }
}
