'use strict';

angular.module('torrentApp').factory('Column', [function() {

    /**
     * Constructor, with class name
     */
    function Column({
        name,
        enabled = true,
        attribute,
        template = ''
    }) {
        this.name = name
        this.enabled = enabled
        this.attribute = attribute
        this.template = template
    }

    /**
     * Return the constructor function
     */
    return Column;
}]);