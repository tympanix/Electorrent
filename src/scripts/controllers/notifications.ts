angular.module("torrentApp").controller("notificationsController", ["$scope", "$rootScope", "$timeout", "electron", "configService", "notificationService", "$http",
    function($scope, $rootScope, $timeout, electron, config, $notify, $http) {

        var id = 0;

        $scope.updateData = {
            releaseDate: "Just now...",
            updateUrl: "https://github.com/tympanix/Electorrent/releases"
        };

        $scope.notifications = [];

        $scope.close = function(index){
            $scope.notifications.splice(index, 1);
        }

        $rootScope.$on('notification', function(event, data){
            id++;
            data.notificationId = id;
            $scope.notifications.push(data);
            removeAlert(data, data.delay || 5000);
        })

        function removeAlert(data, delay){
            $timeout(function(){
                $scope.notifications = $scope.notifications.filter(function(value){
                    return value.notificationId !== data.notificationId;
                })
            }, delay);
        }

        // Listen for software update event from main process
        electron.ipc.on('autoUpdate', function(event, data){
            $scope.manualUpdate = false;

            $http.get(data.updateUrl, { timeout: 10000 })
                .success(function(releaseData){
                    data.releaseNotes = releaseData.notes;
                    data.releaseDate = releaseData.pub_date;
                })
                .catch(function(){
                    data.releaseNotes = "Not available. Please go to the website for more info"
                })
                .then(function() {
                    $scope.updateData = data
                    let modal: any = $('#updateModal')
                    modal.modal('show');
                })
        })

        // Listen for manual updates from the main process
        electron.ipc.on('manualUpdate', function(event, data){
            $scope.updateData = data
            $scope.manualUpdate = true;

            $timeout(function(){
                let modal: any = $('#updateModal')
                modal.modal('show');
            }, 500)
        });

        $scope.installUpdate = function() {
            if ($scope.manualUpdate){
                electron.updater.manualQuitAndUpdate();
                //electron.ipc.send('startUpdate', null);
            } else {
                electron.autoUpdater.quitAndInstall();
            }
        }

        function showCertModal() {
            $timeout(function(){
                let modal: any = $('#certificateModal')
                modal.modal('show')
            }, 0)
        }

        /*
         * Event for certificate validation of certificates from NodeJS based clients.
         * The format of the certificates is that of NodeJS's TLS module
         * https://nodejs.org/api/tls.html#tls_tlssocket_getpeercertificate_detailed
         */
        electron.ipc.on('certificate-modal-node', function(event, cert, server) {
            $scope.installCertificate = function() {
                electron.ca.installCertificate(cert, function(err, fingerprint) {
                    if (err) {
                        $rootScope.$emit('certificate-modal', false)
                        $notify.alert("Could not install certificate", err.toString())
                    } else {
                        $rootScope.$emit('certificate-modal', server.id, fingerprint)
                        $rootScope.$broadcast('certificate-installed', server.id, fingerprint)
                        $notify.ok("Certificate installed", "The certificate has been trusted for this server to use")
                    }
                })
            }
            $scope.certificate = {
                selfSigned: !cert.issuerCertificate,
                issuer: {
                    country: cert.issuer.C,
                    state: cert.issuer.ST,
                    organization: cert.issuer.O,
                    organizationUnit: cert.issuer.OU,
                    commonName: cert.issuer.CN,
                },
                subject: {
                    country: cert.subject.C,
                    state: cert.subject.ST,
                    organization: cert.subject.O,
                    organizationUnit: cert.subject.OU,
                    commonName: cert.subject.CN,
                },
                fingerprint: cert.fingerprint,
                validFrom: new Date(cert.valid_from).getTime() / 1000,
                validTo: new Date(cert.valid_to).getTime() / 1000,
                serialNumber: cert.serialNumber,
            }
            showCertModal()
        })

        /*
         * Event for certficate validation of certificates from Chrome based
         * clients. The format of the certificate is that of Electron's. This
         * handler is used for legacy support, for clients not ported to NodeJS.
         * https://electronjs.org/docs/api/structures/certificate
         */
        electron.ipc.on('certificate-error', function(event, cert, server) {
            $scope.installCertificate = function() {
                config.trustCertificate(cert)
            }
            $scope.certificate = {
                selfSigned: !cert.issuerCert,
                issuer: {
                    country: cert.issuer.country,
                    state: cert.issuer.state,
                    organization: cert.issuer.organizations && cert.issuer.organizations[0],
                    organizationUnit: cert.issuer.organizationUnits && cert.issuer.organizationUnits[0],
                    commonName: cert.issuer.commonName,
                },
                subject: {
                    country: cert.subject.country,
                    state: cert.subject.state,
                    organization: cert.subject.organizations && cert.subject.organizations[0],
                    organizationUnit: cert.subject.organizationUnits && cert.subject.organizationUnits[0],
                    commonName: cert.subject.commonName,
                },
                fingerprint: cert.fingerprint,
                validFrom: cert.validStart,
                validTo: cert.validExpiry,
                serialNumber: cert.serialNumber,
            }
            showCertModal()
        })

        $scope.installCertificate = function() {
            config.trustCertificate($scope.certificate)
        }

        $scope.certificateResult = function(accepted) {
            if (!accepted) {
                $rootScope.$emit('certificate-modal', false)
            }
        }

}]);
