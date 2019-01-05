'use strict';

angular.module('torrentApp')
    .service('notificationService', ["$rootScope", "electron", function($rootScope, electron) {
        
        const ERR_SELF_SIGNED_CERT = 'DEPTH_ZERO_SELF_SIGNED_CERT'
        const ERR_TLS_CERT_ALTNAME_INVALID = 'ERR_TLS_CERT_ALTNAME_INVALID'

        const ERR_CODES = {
            ERR_SELF_SIGNED_CERT: {
                title: 'Certificate error',
                msg: 'Self signed certificate is not trusted with this server',
            },
            ERR_TLS_CERT_ALTNAME_INVALID : {
                title: 'Certificate error',
                msg: 'The certificate is not useable with this server because the\
                common name of the certificate does not match the hostname of the server',
            },
        }

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

        this.alertAuth = function(err, code){
            if (typeof err === 'string') {
                this.alert('Connection problem', err)
            } else if (typeof err !== 'object') {
                this.alert("Connection problem", "The connection could not be established")
            } else if (err.status === -1){
                this.alert("Connection problem", "The connection to the server timed out!")
            } else if (err.status === 401 || code === 401){
                this.alert("Connection problem", "You entered an incorrent username/password")
            } else if (err.code && ERR_CODES.hasOwnProperty(err.code)) {
                this.alert(ERR_CODES[err.code].title, ERR_CODES[err.code].msg)
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
