'use strict';

angular.module('torrentApp').factory('Column', [function() {

    /**
     * Constructor, with class name
     */
    function Column({
        name,
        enabled = false,
        attribute,
        template = '',
        sort = Column.NUMERICAL
    }) {
        this.name = name
        this.enabled = enabled
        this.attribute = attribute
        this.template = template
        this.sort = sort
    }

    Column.ALPHABETICAL = function(a, b) {
        var aLower = a.toLowerCase();
        var bLower = b.toLowerCase();
        return aLower.localeCompare(bLower);
    }

    Column.NUMERICAL = function(a, b){
        return b - a;
    }

    Column.NATURAL_NUMBER_ASC = function(a, b){
        if (a < 0) return 1
        if (b < 0) return -1
        return a - b
    }

    /**
     * Return the constructor function
     */
    return Column;
}]);