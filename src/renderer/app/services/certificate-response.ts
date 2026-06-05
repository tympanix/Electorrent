interface PendingCertificateResponse {
    resolve: (fingerprint: string) => void
    reject: (reason?: unknown) => void
}

export class CertificateResponseService {
    private pending = new Map<string, PendingCertificateResponse>()

    wait(serverId: string) {
        return new Promise<string>((resolve, reject) => {
            this.pending.set(serverId, { resolve, reject })
        })
    }

    resolve(serverId: string | undefined, fingerprint: string) {
        if (!serverId) {
            return
        }

        const pending = this.pending.get(serverId)
        if (!pending) {
            return
        }

        this.pending.delete(serverId)
        pending.resolve(fingerprint)
    }

    reject(serverId: string | undefined, reason?: unknown) {
        if (!serverId) {
            this.rejectAll(reason)
            return
        }

        const pending = this.pending.get(serverId)
        if (!pending) {
            return
        }

        this.pending.delete(serverId)
        pending.reject(reason)
    }

    rejectAll(reason?: unknown) {
        for (const [, pending] of this.pending) {
            pending.reject(reason)
        }
        this.pending.clear()
    }
}
