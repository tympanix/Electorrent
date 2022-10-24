export let bytesFilter = function() {
        return function(bytes, decimals = 1) {
            if (!+bytes) return '0 B'

            const k = 1024
            const dm = +decimals < 0 ? 0 : +decimals
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

            const i = Math.floor(Math.log(bytes) / Math.log(k))

            return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
        };
    };

export let speedFilter = ['bytesFilter', function(bytes) {
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
}]
