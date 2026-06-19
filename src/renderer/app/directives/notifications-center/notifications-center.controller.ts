import { IScope } from "angular";
import type { ModalController } from "@renderer/app/directives/modal/modal.controller";
import type { CertificateResponseService } from "@renderer/app/services/certificate-response";
import type { CertificatePrompt, UpdateEvent } from "@shared/ipc-contract";

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
    allowInsecureTls: () => void;
    confirmInsecureTls: () => boolean | void;
    insecureTlsResult: (accepted: boolean) => void;
    certificate: any;
    insecureTlsCertificate: any;
    certificateResult: (accepted: boolean) => void;
    certificateModalRef?: ModalController;
    insecureTlsModalRef?: ModalController;
    updateModalRef?: ModalController;
}

export class NotificationsCenterController {
    static $inject = ["$scope", "$rootScope", "$timeout", "settingsService", "notificationService", "$http", "certificateResponseService"];

    constructor(
        $scope: NotificationsCenterScope,
        $rootScope: angular.IRootScopeService,
        $timeout: angular.ITimeoutService,
        settingsService: any,
        $notify: any,
        $http: angular.IHttpService,
        certificateResponseService: CertificateResponseService,
    ) {
        const electorrent = window.electorrent
        let id = 0;
        let insecureTlsFlowActive = false;

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
                $scope.certificateModalRef?.showModal();
            }, 0);
        };

        electorrent.updates.onStatus((event: UpdateEvent) => {
            if (event.type !== "downloaded") {
                return;
            }

            const data = Object.assign({
                releaseDate: $scope.updateData.releaseDate,
                updateUrl: $scope.updateData.updateUrl,
            }, event.data || {});
            $scope.manualUpdate = !!data.manual;

            $http.get(data.updateUrl, { timeout: 10000 })
                .then((res: any) => {
                    if (!data.releaseNotes) {
                        data.releaseNotes = res.data.notes;
                    }
                    if (!data.releaseDate) {
                        data.releaseDate = res.data.pub_date;
                    }
                })
                .catch(() => {
                    if (!data.releaseNotes) {
                        data.releaseNotes = "Not available. Please go to the website for more info";
                    }
                })
                .then(() => {
                    $scope.updateData = data;
                    $timeout(() => {
                        $scope.updateModalRef?.showModal();
                    }, $scope.manualUpdate ? 500 : 0);
                });
        });

        $scope.installUpdate = () => {
            if ($scope.manualUpdate) {
                electorrent.updates.installDownloaded();
            } else {
                electorrent.updates.installAuto();
            }
        };

        electorrent.certificates.onChallenge((cert: CertificatePrompt) => {
            $scope.installCertificate = () => {
                if (cert.source === "node-client-check") {
                    electorrent.certificates.install({
                        fingerprint: cert.fingerprint,
                        raw: cert.raw,
                    }).then((result) => {
                        certificateResponseService.resolve(cert.serverId, { fingerprint: result.fingerprint });
                        $rootScope.$broadcast("certificate-installed", cert.serverId, result.fingerprint);
                        $notify.ok("Certificate installed", "The certificate has been trusted for this server to use");
                    }).catch((err: unknown) => {
                        certificateResponseService.reject(cert.serverId, err);
                        $notify.alert("Could not install certificate", String(err));
                    })
                } else {
                    settingsService.trustCertificate(cert).catch((err: unknown) => {
                        $notify.alert("Could not trust certificate", String(err));
                    });
                }
            };
            $scope.allowInsecureTls = () => {
                if (!cert.serverId) {
                    return;
                }
                insecureTlsFlowActive = true;
                $scope.insecureTlsCertificate = cert;
                $scope.insecureTlsModalRef?.showModal();
            };
            $scope.confirmInsecureTls = () => {
                if (!cert.serverId) {
                    return false;
                }

                const saveInsecureTls = settingsService.getServer(cert.serverId)
                    ? settingsService.enableInsecureTls(cert.serverId)
                    : Promise.resolve();

                saveInsecureTls.then(() => {
                    $scope.certificateModalRef?.hideModal();
                    certificateResponseService.resolve(cert.serverId, { tlsSecurity: "insecure" });
                    $notify.warning("Insecure TLS enabled", "TLS certificate verification is disabled for this server");
                }).catch((err: unknown) => {
                    certificateResponseService.reject(cert.serverId, err);
                    $notify.alert("Could not enable Insecure TLS", String(err));
                });
                return true;
            };
            $scope.insecureTlsResult = (accepted: boolean) => {
                if (!accepted) {
                    insecureTlsFlowActive = false;
                }
            };
            $scope.certificate = cert;
            showCertModal();
        });

        $scope.installCertificate = () => {
            settingsService.trustCertificate($scope.certificate);
        };

        $scope.certificateResult = (accepted: boolean) => {
            if (!accepted && !insecureTlsFlowActive) {
                certificateResponseService.reject($scope.certificate?.serverId);
            }
            insecureTlsFlowActive = false;
        };
    }
}
