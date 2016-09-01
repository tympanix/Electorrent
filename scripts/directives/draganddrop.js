angular.module("torrentApp").directive('dragAndDrop', ['electron', function(electron) {
    return function(scope, element, attrs) {

        document.ondragover = document.ondrop = function(event) {
            event.preventDefault()
        }

        element.bind('drop', function(event, data) {
            var files = event.originalEvent.dataTransfer.files;
            var paths = [];

            // loop through files
            for (var i = 0; i < files.length; i++) {
                paths.push(files.item(i).path);
            }

            electron.upload(paths);

            console.log("Paths", paths);

            console.info("Drop!", event.originalEvent.dataTransfer.files);
        });
    }
}]);
