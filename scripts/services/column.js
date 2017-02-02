'use strict';

angular.module('torrentApp').factory('Column', [function() {

    /**
     * Constructor, with class name
     */
    function Column({
        name,
        enabled = true,
        attribute
    }) {
        this.name = name
        this.enabled = enabled
        this.attribute = attribute
    }

    /**
     * Return the constructor function
     */
    return Column;
}]);