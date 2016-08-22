'use strict';

angular.module('torrentApp').factory('UtorrentGUI', ['AbstractGUI', function(AbstractGUI) {

    /**
     * Constructor, with class name
     */
    function UtorrentGUI(service) {
        this.service = service;
        //AbstractGUI.call(this, service);
    }

    // Inherit by prototypal inheritance
    //uTorrentGUI.prototype = Object.create(AbstractGUI.prototype);

    UtorrentGUI.prototype.actionHeader = function () {
        throw new Error('Missing action header implementation')
    };

    UtorrentGUI.prototype.contextMenu = function () {
        return [
            {
                label: 'Recheck',
                click: this.service.recheck,
                icon: 'checkmark'
            },
            {
                label: 'Force Start',
                click: this.service.forceStart,
                icon: 'flag'
            },
            {
                label: 'Move Up Queue',
                click: this.service.queueUp,
                icon: 'arrow up'
            },
            {
                label: 'Move Queue Down',
                click: this.service.queueDown,
                icon: 'arrow down'
            },
            {
                label: 'Remove',
                click: this.service.remove,
                icon: 'remove'
            },
            {
                label: 'Remove And',
                menu: [
                    {
                        label: 'Delete Torrent',
                        click: this.service.removetorrent,
                    },
                    {
                        label: 'Delete Data',
                        click: this.service.removedata,
                    },
                    {
                        label: 'Delete All',
                        click: this.service.removedatatorrent,
                    }
                ]
            }
        ];
    };

    /**
     * Return the constructor function
     */
    return UtorrentGUI;
}]);