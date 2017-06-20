angular.module("torrentApp").directive('fixedHeader', [function() {
    return {
        restrict: 'A',
        link: link,
        scope: {
            enable: "=fixedHeader"
        }
    };


    function link(scope, element /*, attrs*/ ) {
        let thead = element.find('thead')[0]

        function init() {
          if (!thead) return
          element.on("scroll", translateHead);
        }

        function translateHead() {
          var translate = "translate(0," + this.scrollTop + "px)";
          thead.style.transform = translate;
        }

        function teardown() {
          element.off("scroll", translateHead)
          if (!thead) return
          thead.style.transform = ""
        }

        function bind(enable) {
          if (!enable) {
            teardown()
          } else {
            init()
          }
        }

        scope.$watch(function() {
            return scope.enable
        }, function(enable, old) {
            if (enable === old) return
            bind(enable)
        })

        // Initial binding
        bind(scope.enable)
    }

}]);