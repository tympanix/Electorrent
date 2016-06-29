'use strict';

angular.module('torrentApp')
    .service('notificationService', ["$rootScope", function($rootScope) {

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

    }]);
