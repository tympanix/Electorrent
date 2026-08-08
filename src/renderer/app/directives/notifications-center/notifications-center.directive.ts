import { CommonModule } from "@angular/common";
import {
    ChangeDetectorRef,
    Component,
    Inject,
    NgZone,
    OnDestroy,
    OnInit,
} from "@angular/core";
import { CertificateModalDirective } from "@renderer/app/directives/certificate-modal/certificate-modal.directive";
import { InsecureTlsModalComponent } from "@renderer/app/directives/insecure-tls-modal/insecure-tls-modal.directive";
import { UpdateModalComponent } from "@renderer/app/directives/update-modal/update-modal.directive";
import type {
    CertificatePrompt,
    NotificationPayload,
    UpdateEvent,
} from "@shared/ipc-contract";

interface ModalRef {
    hideModal(): void;
    refreshModal(): void;
    showModal(): void;
    toggleModal(): void;
}

interface NotificationView extends NotificationPayload {
    notificationId: number;
}

interface UpdateData {
    manual?: boolean;
    releaseDate: string;
    releaseName?: string;
    releaseNotes?: string;
    updateUrl: string;
    [key: string]: unknown;
}

interface RootEvents {
    $broadcast(name: string, ...args: unknown[]): void;
    $on(name: string, callback: (event: unknown, ...args: any[]) => void): () => void;
}

interface SettingsService {
    enableInsecureTls(serverId: string): Promise<unknown>;
    getServer(serverId: string): unknown;
    trustCertificate(certificate: CertificatePrompt): Promise<unknown>;
}

interface NotificationService {
    alert(title: string, message: string): void;
    ok(title: string, message: string): void;
    warning(title: string, message: string): void;
}

interface HttpService {
    get(url: string, options: { timeout: number }): Promise<{ data: Record<string, any> }>;
}

interface CertificateResponseService {
    reject(serverId: string | undefined, reason?: unknown): void;
    resolve(
        serverId: string | undefined,
        response: { fingerprint: string } | { tlsSecurity: "insecure" },
    ): void;
}

@Component({
    selector: "notifications-center",
    standalone: true,
    imports: [CommonModule, CertificateModalDirective, InsecureTlsModalComponent, UpdateModalComponent],
    templateUrl: "./notifications-center.template.html",
})
export class NotificationsCenterComponent implements OnInit, OnDestroy {
    updateData: UpdateData = {
        releaseDate: "Just now...",
        updateUrl: "https://github.com/tympanix/Electorrent/releases",
    };
    notifications: NotificationView[] = [];
    manualUpdate = false;
    certificate?: CertificatePrompt;
    insecureTlsCertificate: { fingerprint?: string } = {};
    certificateModalRef?: ModalRef;
    insecureTlsModalRef?: ModalRef;
    updateModalRef?: ModalRef;

    private nextNotificationId = 0;
    private insecureTlsFlowActive = false;
    private readonly timers = new Map<number, number>();
    private readonly deferredTimers = new Set<number>();
    private readonly destroyCallbacks: Array<() => void> = [];

    constructor(
        @Inject("$rootScope") private readonly rootEvents: RootEvents,
        @Inject("settingsService") private readonly settingsService: SettingsService,
        @Inject("notificationService") private readonly notificationService: NotificationService,
        @Inject("$http") private readonly http: HttpService,
        @Inject("certificateResponseService") private readonly certificateResponses: CertificateResponseService,
        private readonly zone: NgZone,
        private readonly changeDetector: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.destroyCallbacks.push(this.rootEvents.$on("notification", (_event, data: NotificationPayload) => {
            this.zone.run(() => this.addNotification(data));
        }));
        this.destroyCallbacks.push(window.electorrent.updates.onStatus((event) => {
            this.zone.run(() => this.handleUpdateStatus(event));
        }));
        this.destroyCallbacks.push(window.electorrent.certificates.onChallenge((certificate) => {
            this.zone.run(() => this.handleCertificateChallenge(certificate));
        }));
    }

    ngOnDestroy(): void {
        this.destroyCallbacks.splice(0).forEach((destroy) => destroy());
        this.timers.forEach((timer) => window.clearTimeout(timer));
        this.timers.clear();
        this.deferredTimers.forEach((timer) => window.clearTimeout(timer));
        this.deferredTimers.clear();
    }

    close(index: number): void {
        const [notification] = this.notifications.splice(index, 1);
        if (notification) {
            this.clearTimer(notification.notificationId);
        }
    }

    trackNotification(_index: number, notification: NotificationView): number {
        return notification.notificationId;
    }

    readonly installUpdate = (): void => {
        if (this.manualUpdate) {
            void window.electorrent.updates.installDownloaded();
        } else {
            void window.electorrent.updates.installAuto();
        }
    };

    readonly installCertificate = (): void => {
        const certificate = this.certificate;
        if (!certificate) return;

        if (certificate.source === "node-client-check") {
            window.electorrent.certificates.install({
                fingerprint: certificate.fingerprint,
                raw: certificate.raw,
            }).then((result) => this.zone.run(() => {
                this.certificateResponses.resolve(certificate.serverId, { fingerprint: result.fingerprint });
                this.rootEvents.$broadcast("certificate-installed", certificate.serverId, result.fingerprint);
                this.notificationService.ok(
                    "Certificate installed",
                    "The certificate has been trusted for this server to use",
                );
            })).catch((error: unknown) => this.zone.run(() => {
                this.certificateResponses.reject(certificate.serverId, error);
                this.notificationService.alert("Could not install certificate", String(error));
            }));
        } else {
            this.settingsService.trustCertificate(certificate).catch((error: unknown) => this.zone.run(() => {
                this.notificationService.alert("Could not trust certificate", String(error));
            }));
        }
    };

    readonly allowInsecureTls = (): void => {
        if (!this.certificate?.serverId) return;

        this.insecureTlsFlowActive = true;
        this.insecureTlsCertificate = this.certificate;
        this.insecureTlsModalRef?.showModal();
    };

    readonly confirmInsecureTls = (): boolean => {
        const certificate = this.certificate;
        if (!certificate?.serverId) return false;

        const save = this.settingsService.getServer(certificate.serverId)
            ? this.settingsService.enableInsecureTls(certificate.serverId)
            : Promise.resolve();
        save.then(() => this.zone.run(() => {
            this.certificateModalRef?.hideModal();
            this.certificateResponses.resolve(certificate.serverId, { tlsSecurity: "insecure" });
            this.notificationService.warning(
                "Insecure TLS enabled",
                "TLS certificate verification is disabled for this server",
            );
        })).catch((error: unknown) => this.zone.run(() => {
            this.certificateResponses.reject(certificate.serverId, error);
            this.notificationService.alert("Could not enable Insecure TLS", String(error));
        }));
        return true;
    };

    readonly insecureTlsResult = (accepted: boolean): void => {
        if (!accepted) {
            this.insecureTlsFlowActive = false;
        }
    };

    readonly certificateResult = (accepted: boolean): void => {
        if (!accepted && !this.insecureTlsFlowActive) {
            this.certificateResponses.reject(this.certificate?.serverId);
        }
        this.insecureTlsFlowActive = false;
    };

    setUpdateModalRef(modalRef: ModalRef | undefined): void {
        this.updateModalRef = modalRef;
    }

    setCertificateModalRef(modalRef: ModalRef | undefined): void {
        this.certificateModalRef = modalRef;
    }

    setInsecureTlsModalRef(modalRef: ModalRef | undefined): void {
        this.insecureTlsModalRef = modalRef;
    }

    private addNotification(data: NotificationPayload): void {
        const notification: NotificationView = {
            ...data,
            notificationId: ++this.nextNotificationId,
        };
        this.notifications.push(notification);
        this.changeDetector.detectChanges();
        const timer = window.setTimeout(() => this.zone.run(() => {
            this.notifications = this.notifications.filter((candidate) => {
                return candidate.notificationId !== notification.notificationId;
            });
            this.timers.delete(notification.notificationId);
            this.changeDetector.detectChanges();
        }), data.delay || 5_000);
        this.timers.set(notification.notificationId, timer);
    }

    private clearTimer(notificationId: number): void {
        const timer = this.timers.get(notificationId);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            this.timers.delete(notificationId);
        }
    }

    private handleUpdateStatus(event: UpdateEvent): void {
        if (event.type !== "downloaded") return;

        const data: UpdateData = {
            ...this.updateData,
            ...(event.data || {}),
        };
        this.manualUpdate = !!data.manual;

        this.http.get(data.updateUrl, { timeout: 10_000 })
            .then((response) => {
                if (!data.releaseNotes) {
                    data.releaseNotes = response.data.notes;
                }
                if (!data.releaseDate) {
                    data.releaseDate = response.data.pub_date;
                }
            })
            .catch(() => {
                if (!data.releaseNotes) {
                    data.releaseNotes = "Not available. Please go to the website for more info";
                }
            })
            .then(() => this.zone.run(() => {
                this.updateData = data;
                this.defer(() => this.updateModalRef?.showModal(), this.manualUpdate ? 500 : 0);
            }));
    }

    private handleCertificateChallenge(certificate: CertificatePrompt): void {
        this.certificate = certificate;
        this.changeDetector.detectChanges();
        this.defer(() => this.certificateModalRef?.showModal());
    }

    private defer(callback: () => void, delay = 0): void {
        const timer = window.setTimeout(() => this.zone.run(() => {
            this.deferredTimers.delete(timer);
            callback();
        }), delay);
        this.deferredTimers.add(timer);
    }
}

// Transitional alias for imports that still use the old directive name.
export { NotificationsCenterComponent as NotificationsCenterDirective };
