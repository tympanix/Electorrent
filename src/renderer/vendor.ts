type RendererGlobals = Window &
  typeof globalThis & {
    $: JQueryStatic
    jQuery: JQueryStatic
  }

import 'zone.js'
import jquery from 'jquery'
import 'jquery-ui-dist/jquery-ui.js'
import 'fomantic-ui/dist/semantic.min.js'

const rendererWindow = window as RendererGlobals

rendererWindow.$ = jquery
rendererWindow.jQuery = jquery
