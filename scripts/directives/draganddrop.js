angular.module("torrentApp").directive('dragAndDrop', ['$rootScope', '$document', 'electron', function($rootScope, $document, electron) {
    return function(scope, element, attrs) {

        var dragging = 0;

        document.ondragover = document.ondrop = function(event) {
            event.preventDefault()
        }

        element.bind('click', function() {
            dragging = 0;
            $rootScope.$emit('show:draganddrop', false);
        });

        element.bind('dragenter', function(event, data) {
            dragging++;

            console.log("Dragenter", dragging);
            $rootScope.$emit('show:draganddrop', true);

            event.stopPropagation();
            event.preventDefault();

            return false;
        })

        element.bind('dragleave', function (event, data) {

            dragging--;
            console.log('Dragleave', dragging);

            if (dragging === 0) {
                $rootScope.$emit('show:draganddrop', false);
            }

            event.stopPropagation();
            event.preventDefault();

            return false;

        })

        element.bind('drop', function(event, data) {
            var files = event.originalEvent.dataTransfer.files;
            var paths = [];

            // loop through files
            for (var i = 0; i < files.length; i++) {
                paths.push(files.item(i).path);
            }

            electron.upload(paths);

            console.log("Paths", paths);

            $rootScope.$emit('show:draganddrop', false);

            console.info("Drop!", event.originalEvent.dataTransfer.files);
        });
    }
}]);
