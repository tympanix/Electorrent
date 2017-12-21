angular.module("torrentApp").filter('bytes', function() {
        return function(bytes) {
            var val;
            var uom;

            if (bytes < 1024) {
                val = bytes;
                uom = 'B';
            } else if (bytes < 1048576) {
                val = (bytes / 1024).toFixed(1);
                uom = 'KB';
            } else if (bytes < 1073741824) {
                val = (bytes / 1048576).toFixed(1);
                uom = 'MB';
            } else {
                val = (bytes / 1073741824).toFixed(1);
                uom = 'GB';
            }
            return [val, uom].join(' ');
        };
    });

angular.module("torrentApp").filter('speed', ['bytesFilter', function(bytes) {
    return function(bytesPerSecond, torrent) {
        var display = true;

        if (torrent){
            display = torrent.isStatusDownloading()
        }

        if (display){
            return bytes(bytesPerSecond) + '/s';
        } else {
            return '';
        }
    }
}])
