import DOMPurify from 'dompurify'
import { marked } from 'marked'
import angular from 'angular'

angular.module('hc.marked', []).directive('marked', () => ({
  restrict: 'A',
  link: (scope, element, attributes) => {
    scope.$watch(attributes.marked, (markdown) => {
      element.html(DOMPurify.sanitize(marked.parse(markdown || '')))
    })
  },
}))
