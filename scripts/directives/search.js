angular.module("torrentApp").directive('search', ['$document', function($document) {
    return {
        restrict: 'A',
        link: link
    };


    function link(scope, element /*, attrs*/ ) {
        $document.on('keyup', function(e) {
          var key = String.fromCharCode(e.which);
          if (e.ctrlKey && key === 'F') {
            element.focus()
          }
        })
    }

}]);
