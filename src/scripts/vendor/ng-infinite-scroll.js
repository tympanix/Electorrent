/* Adapted from ng-infinite-scroll 1.3.4 for direct browser loading. */
(function(angular) {
  const MODULE_NAME = 'infinite-scroll';

  angular.module(MODULE_NAME, [])
    .value('THROTTLE_MILLISECONDS', null)
    .directive('infiniteScroll', [
      '$rootScope', '$window', '$interval', 'THROTTLE_MILLISECONDS',
      ($rootScope, $window, $interval, THROTTLE_MILLISECONDS) =>
    ({
      scope: {
        infiniteScroll: '&',
        infiniteScrollContainer: '=',
        infiniteScrollDistance: '=',
        infiniteScrollDisabled: '=',
        infiniteScrollUseDocumentBottom: '=',
        infiniteScrollListenForEvent: '@',
      },

      link(scope, elem, attrs) {
        const windowElement = angular.element($window);

        let scrollDistance = null;
        let scrollEnabled = null;
        let checkWhenEnabled = null;
        let container = null;
        let immediateCheck = true;
        let useDocumentBottom = false;
        let unregisterEventListener = null;
        let checkInterval = false;

        function height(element) {
          const el = element[0] || element;

          if (isNaN(el.offsetHeight)) {
            return el.document.documentElement.clientHeight;
          }
          return el.offsetHeight;
        }

        function pageYOffset(element) {
          const el = element[0] || element;

          if (isNaN(window.pageYOffset)) {
            return el.document.documentElement.scrollTop;
          }
          return el.ownerDocument.defaultView.pageYOffset;
        }

        function offsetTop(element) {
          if (!(!element[0].getBoundingClientRect || element.css('none'))) {
            return element[0].getBoundingClientRect().top + pageYOffset(element);
          }
          return undefined;
        }

        function defaultHandler() {
          let containerBottom;
          let elementBottom;
          if (container === windowElement) {
            containerBottom = height(container) + pageYOffset(container[0].document.documentElement);
            elementBottom = offsetTop(elem) + height(elem);
          } else {
            containerBottom = height(container);
            let containerTopOffset = 0;
            if (offsetTop(container) !== undefined) {
              containerTopOffset = offsetTop(container);
            }
            elementBottom = (offsetTop(elem) - containerTopOffset) + height(elem);
          }

          if (useDocumentBottom) {
            elementBottom = height((elem[0].ownerDocument || elem[0].document).documentElement);
          }

          const remaining = elementBottom - containerBottom;
          const shouldScroll = remaining <= (height(container) * scrollDistance) + 1;

          if (shouldScroll) {
            checkWhenEnabled = true;

            if (scrollEnabled) {
              if (scope.$$phase || $rootScope.$$phase) {
                scope.infiniteScroll();
              } else {
                scope.$apply(scope.infiniteScroll);
              }
            }
          } else {
            if (checkInterval) { $interval.cancel(checkInterval); }
            checkWhenEnabled = false;
          }
        }

        function throttle(func, wait) {
          let timeout = null;
          let previous = 0;

          function later() {
            previous = new Date().getTime();
            $interval.cancel(timeout);
            timeout = null;
            return func.call();
          }

          function throttled() {
            const now = new Date().getTime();
            const remaining = wait - (now - previous);
            if (remaining <= 0) {
              $interval.cancel(timeout);
              timeout = null;
              previous = now;
              func.call();
            } else if (!timeout) {
              timeout = $interval(later, remaining, 1);
            }
          }

          return throttled;
        }

        const handler = (THROTTLE_MILLISECONDS != null) ?
          throttle(defaultHandler, THROTTLE_MILLISECONDS) :
          defaultHandler;

        function handleDestroy() {
          container.unbind('scroll', handler);
          if (unregisterEventListener != null) {
            unregisterEventListener();
            unregisterEventListener = null;
          }
          if (checkInterval) {
            $interval.cancel(checkInterval);
          }
        }

        scope.$on('$destroy', handleDestroy);

        function handleInfiniteScrollDistance(v) {
          scrollDistance = parseFloat(v) || 0;
        }

        scope.$watch('infiniteScrollDistance', handleInfiniteScrollDistance);
        handleInfiniteScrollDistance(scope.infiniteScrollDistance);

        function handleInfiniteScrollDisabled(v) {
          scrollEnabled = !v;
          if (scrollEnabled && checkWhenEnabled) {
            checkWhenEnabled = false;
            handler();
          }
        }

        scope.$watch('infiniteScrollDisabled', handleInfiniteScrollDisabled);
        handleInfiniteScrollDisabled(scope.infiniteScrollDisabled);

        function handleInfiniteScrollUseDocumentBottom(v) {
          useDocumentBottom = v;
        }

        scope.$watch('infiniteScrollUseDocumentBottom', handleInfiniteScrollUseDocumentBottom);
        handleInfiniteScrollUseDocumentBottom(scope.infiniteScrollUseDocumentBottom);

        function changeContainer(newContainer) {
          if (container != null) {
            container.unbind('scroll', handler);
          }

          container = newContainer;
          if (newContainer != null) {
            container.bind('scroll', handler);
          }
        }

        changeContainer(windowElement);

        if (scope.infiniteScrollListenForEvent) {
          unregisterEventListener = $rootScope.$on(scope.infiniteScrollListenForEvent, handler);
        }

        function handleInfiniteScrollContainer(newContainer) {
          if ((!(newContainer != null)) || newContainer.length === 0) {
            return;
          }

          let newerContainer;

          if (newContainer.nodeType && newContainer.nodeType === 1) {
            newerContainer = angular.element(newContainer);
          } else if (typeof newContainer.append === 'function') {
            newerContainer = angular.element(newContainer[newContainer.length - 1]);
          } else if (typeof newContainer === 'string') {
            newerContainer = angular.element(document.querySelector(newContainer));
          } else {
            newerContainer = newContainer;
          }

          if (newerContainer == null) {
            throw new Error('invalid infinite-scroll-container attribute.');
          }
          changeContainer(newerContainer);
        }

        scope.$watch('infiniteScrollContainer', handleInfiniteScrollContainer);
        handleInfiniteScrollContainer(scope.infiniteScrollContainer || []);

        if (attrs.infiniteScrollParent != null) {
          changeContainer(angular.element(elem.parent()));
        }

        if (attrs.infiniteScrollImmediateCheck != null) {
          immediateCheck = scope.$eval(attrs.infiniteScrollImmediateCheck);
        }

        function intervalCheck() {
          if (immediateCheck) {
            handler();
          }
          return $interval.cancel(checkInterval);
        }

        checkInterval = $interval(intervalCheck);
        return checkInterval;
      },
    }),

    ]);
})(window.angular);
