
export let dragAndDrop = ['$rootScope', '$document', 'electron', function($rootScope, $document, electron) {
    return function(scope, element /*, attrs*/) {

        var dragging = 0;

        document.ondragover = document.ondrop = function(event) {
            event.preventDefault()
        }

        element.bind('click', function() {
            dragging = 0;
            $rootScope.$emit('show:draganddrop', false);
        });

        element.bind('dragenter', function(event /*, data*/) {
            dragging++;

            $rootScope.$emit('show:draganddrop', true);

            event.stopPropagation();
            event.preventDefault();

            return false;
        })

        element.bind('dragleave', function (event /*, data*/) {

            dragging--;

            if (dragging === 0) {
                $rootScope.$emit('show:draganddrop', false);
            }

            event.stopPropagation();
            event.preventDefault();

            return false;
        })

        element.bind('drop', function(event /*, data*/) {
            var files = event.originalEvent.dataTransfer.files;
            var paths = [];

            for (var i = 0; i < files.length; i++) {
                paths.push(files.item(i).path);
            }

            electron.torrents.readFiles(paths);
            $rootScope.$emit('show:draganddrop', false);
        });
    }
}];
