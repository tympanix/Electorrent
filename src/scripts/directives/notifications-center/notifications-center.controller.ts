import { IScope } from "angular";

interface NotificationsCenterScope extends IScope {
    updateData: {
        releaseDate: string;
        updateUrl: string;
        [key: string]: any;
    };
    notifications: any[];
    manualUpdate?: boolean;
    close: (index: number) => void;
    installUpdate: () => void;
    installCertificate: () => void;
    certificate: any;
    certificateResult: (accepted: boolean) => void;
}

export class NotificationsCenterController {
    static $inject = ["$scope", "$rootScope", "$timeout", "electron", "configService", "notificationService", "$http"];

    constructor(
        $scope: NotificationsCenterScope,
        $rootScope: angular.IRootScopeService,
        $timeout: angular.ITimeoutService,
        electron: any,
        config: any,
        $notify: any,
        $http: angular.IHttpService,
    ) {
        let id = 0;

        $scope.updateData = {
            releaseDate: "Just now...",
            updateUrl: "https://github.com/tympanix/Electorrent/releases",
        };

        $scope.notifications = [];

        $scope.close = (index: number) => {
            $scope.notifications.splice(index, 1);
        };

        $rootScope.$on("notification", (event: unknown, data: any) => {
            id += 1;
            data.notificationId = id;
            $scope.notifications.push(data);
            removeAlert(data, data.delay || 5000);
        });

        const removeAlert = (data: any, delay: number) => {
            $timeout(() => {
                $scope.notifications = $scope.notifications.filter((value) => {
                    return value.notificationId !== data.notificationId;
                });
            }, delay);
        };

        const showCertModal = () => {
            $timeout(() => {
                const modal: any = $("#certificateModal");
                modal.modal("show");
            }, 0);
        };

        electron.ipc.on("autoUpdate", (event: unknown, data: any) => {
            $scope.manualUpdate = false;

            $http.get(data.updateUrl, { timeout: 10000 })
                .then((res: any) => {
                    data.releaseNotes = res.data.notes;
                    data.releaseDate = res.data.pub_date;
                })
                .catch(() => {
                    data.releaseNotes = "Not available. Please go to the website for more info";
                })
                .then(() => {
                    $scope.updateData = data;
                    const modal: any = $("#updateModal");
                    modal.modal("show");
                });
        });

        electron.ipc.on("manualUpdate", (event: unknown, data: any) => {
            $scope.updateData = data;
            $scope.manualUpdate = true;

            $timeout(() => {
                const modal: any = $("#updateModal");
                modal.modal("show");
            }, 500);
        });

        $scope.installUpdate = () => {
            if ($scope.manualUpdate) {
                electron.updater.manualQuitAndUpdate();
            } else {
                electron.autoUpdater.quitAndInstall();
            }
        };

        electron.ipc.on("certificate-modal-node", (event: unknown, cert: any, server: any) => {
            $scope.installCertificate = () => {
                electron.ca.installCertificate(cert, (err: unknown, fingerprint: string) => {
                    if (err) {
                        $rootScope.$emit("certificate-modal", false);
                        $notify.alert("Could not install certificate", String(err));
                    } else {
                        $rootScope.$emit("certificate-modal", server.id, fingerprint);
                        $rootScope.$broadcast("certificate-installed", server.id, fingerprint);
                        $notify.ok("Certificate installed", "The certificate has been trusted for this server to use");
                    }
                });
            };
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
            };
            showCertModal();
        });

        electron.ipc.on("certificate-error", (event: unknown, cert: any) => {
            $scope.installCertificate = () => {
                config.trustCertificate(cert);
            };
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
            };
            showCertModal();
        });

        $scope.installCertificate = () => {
            config.trustCertificate($scope.certificate);
        };

        $scope.certificateResult = (accepted: boolean) => {
            if (!accepted) {
                $rootScope.$emit("certificate-modal", false);
            }
        };
    }
}
