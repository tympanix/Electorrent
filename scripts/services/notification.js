'use strict';

angular.module('torrentApp')
    .service('notificationService', ["$rootScope", "electron", function($rootScope, electron) {
        var disableNotifications = false;

        this.disableAll = function() {
            disableNotifications = true;
        }

        this.enableAll = function() {
            disableNotifications = false;
        }

        this.alert = function(title, message) {
            sendNotification(title, message, "negative");
        }

        this.warning = function(title, message) {
            sendNotification(title, message, "warning");
        }

        this.ok = function(title, message) {
            sendNotification(title, message, "positive");
        }

        function sendNotification(title, message, type) {
            if (disableNotifications) return;
            var notification = {
                title: title,
                message: message,
                type: type
            }
            $rootScope.$emit('notification', notification);
        }

        this.alertAuth = function(response, code){
            if (typeof response === 'string') {
                this.alert('Connection problem', response)
            } else if (typeof response !== 'object') {
                this.alert("Connection problem", "The connection could not be established")
            } else if (response.status === -1){
                this.alert("Connection problem", "The connection to the server timed out!")
            } else if (response.status === 401 || code === 401){
                this.alert("Connection problem", "You entered an incorrent username/password")
            } else {
                this.alert("Connection problem", "The connection could not be established")
            }
        }

        this.torrentComplete = function(torrent) {
            var torrentNotification = new Notification('Torrent Completed!', {
                body: torrent.decodedName,
                icon: 'img/electorrent-icon.png'
            })

            torrentNotification.onclick = () => {
                console.info('Notification clicked')
            }
        }

        // Listen for incomming notifications from main process
        electron.ipc.on('notify', function(event, data){
            $rootScope.$apply(function() {
                sendNotification(data.title, data.message, data.type || 'warning');
            })
        })

    }]);
