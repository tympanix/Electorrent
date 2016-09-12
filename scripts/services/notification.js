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

        this.alertAuth = function(message, status){
            if (status === -1){
                this.alert("Connection problem", "The connection to the server timed out!")
            } else if (status === 401){
                this.alert("Connection problem", "You entered an incorrent username/password")
            } else {
                this.alert("Connection problem", "The connection could not be established")
            }
        }

        this.torrentComplete = function(torrent) {
            console.log("Sending notification!!!");

            var torrentNotification = new Notification('Torrent Completed!', {
                body: torrent.decodedName,
                icon: 'img/electorrent-icon.png'
            })

            torrentNotification.onclick = () => {
                console.log('Notification clicked')
            }
        }

        // Listen for incomming notifications from main process
        electron.ipc.on('notify', function(event, data){
            sendNotification(data.title, data.message, data.type || 'warning');
        })

    }]);
