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
        var value = torrent[this.attribute]
        if (angular.isFunction(value)) value = value.apply(torrent)
        if (this.filter) value = this.filter(value)
        return value
    };

    /**
     * Return the constructor function
     */
    return Column;
}]);