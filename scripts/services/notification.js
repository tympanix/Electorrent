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

    }]);
