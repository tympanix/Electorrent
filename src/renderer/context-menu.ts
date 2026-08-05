import angular from 'angular'

import { ContextMenuDirective } from '@renderer/app/directives/context-menu/context-menu.directive'

angular.module('contextMenuApp', [])
    .directive('contextMenu', ContextMenuDirective.getInstance())
