type RendererGlobals = Window &
  typeof globalThis & {
    $: JQueryStatic
    jQuery: JQueryStatic
    angular: ng.IAngularStatic
  }

import angularLib from 'angular'
import jquery from 'jquery'
import 'jquery-ui-dist/jquery-ui.js'
import 'angular-resource'
import 'angular-animate'
import 'angular-table-resize/dist/angular-table-resize.js'
import './app/vendor/ng-infinite-scroll.js'
import 'angular-marked'
import 'angular-ui-sortable'
import 'semantic-ui-css/semantic.min.js'

const rendererWindow = window as RendererGlobals

rendererWindow.$ = jquery
rendererWindow.jQuery = jquery
rendererWindow.angular = angularLib
