// Augment global mocha context with custom attributes
declare const angular: angular.IAngularStatic

declare namespace Mocha {
  interface Context {
    app: import("../e2e").App
    backend: import("../shared/compose").DockerComposeService
    torrentPath: string
  }
}
