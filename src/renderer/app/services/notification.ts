import type { IRootScopeService } from "angular"

const ERR_SELF_SIGNED_CERT = "DEPTH_ZERO_SELF_SIGNED_CERT"
const ERR_TLS_CERT_ALTNAME_INVALID = "ERR_TLS_CERT_ALTNAME_INVALID"
const CERT_HAS_EXPIRED = "CERT_HAS_EXPIRED"
const UNABLE_TO_VERIFY_LEAF_SIGNATURE = "UNABLE_TO_VERIFY_LEAF_SIGNATURE"

const ERR_CODES = {
    ERR_SELF_SIGNED_CERT: {
        title: "Untrusted certificate",
        msg: "Self signed certificate is not trusted with this server",
    },
    ERR_TLS_CERT_ALTNAME_INVALID: {
        title: "Certificate error",
        msg: "The certificate is not useable with this server because the common name of the certificate does not match the hostname of the server",
    },
    CERT_HAS_EXPIRED: {
        title: "Certificate expired",
        msg: "The certificate for this server has expired and is therefore not trusted",
    },
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: {
        title: "Invalid certificate chain",
        msg: "The certificate could not be verified because the certificate chain is invalid. Consolidate your webserver TLS configuration",
    },
}

type NotificationType = "negative" | "warning" | "positive"

export class NotificationService {
    static $inject = ["$rootScope"]

    private notificationsDisabled = false

    constructor(private readonly $rootScope: IRootScopeService) {
        window.electorrent.notifications.onPush((data) => {
            this.$rootScope.$applyAsync(() => {
                this.sendNotification(data.title, data.message, data.type || "warning")
            })
        })
    }

    disableAll(): void {
        this.notificationsDisabled = true
    }

    enableAll(): void {
        this.notificationsDisabled = false
    }

    alert(title: string, message: string): void {
        this.sendNotification(title, message, "negative")
    }

    warning(title: string, message: string): void {
        this.sendNotification(title, message, "warning")
    }

    ok(title: string, message: string): void {
        this.sendNotification(title, message, "positive")
    }

    alertAuth(err: any): void {
        if (typeof err === "string") {
            this.alert("Connection problem", err)
        } else if (typeof err !== "object") {
            this.alert("Connection problem", "Could not connect to client.")
        } else if (typeof err.message === "string" && err.kind) {
            this.alert("Connection problem", err.message)
        } else if (err.status === -1) {
            this.alert("Connection problem", "Connection timed out.")
        } else if (err.status === 401) {
            this.alert("Connection problem", "Incorrect username or password.")
        } else if (err.code && ERR_CODES.hasOwnProperty(err.code)) {
            this.alert(ERR_CODES[err.code].title, ERR_CODES[err.code].msg)
        } else {
            this.alert("Connection problem", "Could not connect to client.")
        }
    }

    torrentComplete(torrent: { decodedName: string }): void {
        const torrentNotification = new Notification("Torrent Completed!", {
            body: torrent.decodedName,
            icon: "img/electorrent-icon.png",
        })
        torrentNotification.onclick = () => {}
    }

    private sendNotification(title: string, message: string, type: NotificationType | string): void {
        if (this.notificationsDisabled) return
        this.$rootScope.$emit("notification", { title, message, type })
    }
}
