'use strict';

angular.module('torrentApp').factory('Column', ['$filter', function($filter) {

    /**
     * Constructor, with class name
     */
    function Column({
        name,
        type = 'text',
        enabled = true,
        attribute,
        filter
    }) {
        this.name = name
        this.type = type
        this.enabled = enabled
        this.attribute = attribute
        this.filter = filter && $filter(filter)
    }

    Column.prototype.value = function (torrent) {
        if (this.filter) {
            return this.filter(torrent[this.attribute])
        } else {
            return torrent[this.attribute]
        }
    };

    /**
     * Return the constructor function
     */
    return Column;
}]);