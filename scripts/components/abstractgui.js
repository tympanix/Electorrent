'use strict';

angular.module('torrentApp').factory('AbstractGUI', function() {

    /**
     * Constructor, with class name
     */
    function AbstractGUI(service) {
        this.service = service;
    }

    AbstractGUI.prototype.actionHeader = function () {
        throw new Error('Missing action header implementation')
    };

    AbstractGUI.prototype.contextMenu = function () {
        throw new Error('Missing context menu implementation')
    };

    /**
     * Return the constructor function
     */
    return AbstractGUI;
});