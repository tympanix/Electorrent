type RendererGlobals = Window &
  typeof globalThis & {
    $: JQueryStatic
    jQuery: JQueryStatic
    angular: ng.IAngularStatic
  }

const rendererWindow = window as RendererGlobals
const jquery = require('jquery')

rendererWindow.$ = jquery
rendererWindow.jQuery = jquery

require('jquery-ui-dist/jquery-ui.js')

const angularLib: ng.IAngularStatic = require('angular')

rendererWindow.angular = angularLib

require('angular-resource')
require('angular-animate')
require('angular-table-resize/dist/angular-table-resize.js')
require('./app/vendor/ng-infinite-scroll.js')
require('angular-marked')
require('angular-ui-sortable')
require('semantic-ui-css/semantic.min.js')
