import type { IRootScopeService } from "angular"
import type { AppSettings, StoredServerConfig } from "@shared/ipc-contract"
import { Server } from "@renderer/app/services/server"
import type { NotificationService } from "@renderer/app/services/notification"

type BittorrentService = {
    setServer(server: Server): void
}

type ServerConstructor = typeof Server

export class SettingsService {
    static $inject = ["$rootScope", "$bittorrent", "notificationService", "Server"]

    private readonly settings: AppSettings<Server> = {
        startup: "default",
        systemStartup: "disabled",
        refreshRate: 2000,
        automaticUpdates: true,
        closeToTray: true,
        debugMode: false,
        autoRemoveTorrents: false,
        alwaysPromptUploadOptions: false,
        watchDirectory: "",
        ui: {
            resizeMode: "",
            notifications: true,
            displaySize: "normal",
            displayCompact: false,
            cleanNames: true,
            fixedHeader: false,
            theme: "system",
            sidebarCollapsed: false,
        },
        servers: [],
        certificates: [],
    }

    private readonly readyPromise: Promise<AppSettings<Server>>

    constructor(
        private readonly $rootScope: IRootScopeService,
        private readonly $bittorrent: BittorrentService,
        private readonly $notify: NotificationService,
        private readonly ServerClass: ServerConstructor,
    ) {
        this.readyPromise = window.electorrent.settings.getAll().then((settings: AppSettings<StoredServerConfig>) => {
            this.mergeSettings(settings)
            return this.loadServerCertificates(this.settings.servers).then(() => this.settings)
        })

        this.$rootScope.$on("certificate-installed", (_event: unknown, serverId: string, fingerprint: string) => {
            const server = this.getServer(serverId)
            if (!server) return

            server.tlsSecurity = "default"
            server.certificate = fingerprint
            this.loadServerCertificate(server)
                .then(() => this.saveAllSettings())
                .catch((err: unknown) => this.$notify.alert("Certificate cache error", String(err)))
        })
    }

    whenReady(): Promise<AppSettings<Server>> {
        return this.readyPromise
    }

    initSettings(): Promise<AppSettings<Server>> {
        return this.readyPromise
    }

    appendServer(server: Server): void {
        this.settings.servers.push(server)
    }

    getAllSettings(): AppSettings<Server> {
        return this.settings
    }

    getAllSettingsCopy(): AppSettings<Server> {
        return angular.copy(this.settings)
    }

    setCurrentServerAsDefault(): void {
        if (!this.$rootScope.$server) {
            this.$notify.warning("Can't set default server", "You need to chose a server to set it as default")
            return
        }
        this.setDefault(this.$rootScope.$server)
    }

    setDefault(server: Server, skipSave?: boolean): void {
        const found = this.getServer(server.id)
        if (!found) return
        this.settings.servers.forEach((value) => {
            value.default = false
        })
        found.default = true
        if (!skipSave) {
            this.saveAllSettings().then(() => {
                this.$notify.ok("Default server saved", "You default server is now " + server.getNameAtAddress())
            }).catch(() => {
                this.$notify.alert("I/O Error", "Could not save default server. Local configuration file could not be written to?!")
            })
        }
    }

    saveAllSettings(newSettings?: Partial<AppSettings<Server>>): Promise<void> {
        if (newSettings) this.mergeSettings(newSettings)
        return this.loadServerCertificates(this.settings.servers)
            .then(() => window.electorrent.settings.saveAll(this.settingsToJson()))
            .then(() => this.updateServerReference())
    }

    trustCertificate(certificate: { fingerprint: string }): Promise<void> {
        this.settings.certificates.push(certificate.fingerprint)
        return this.saveAllSettings()
    }

    enableInsecureTls(serverId: string): Promise<void> {
        const server = this.getServer(serverId)
        if (!server) return Promise.reject(`Server with id ${serverId} not found`)

        server.tlsSecurity = "insecure"
        server.certificate = undefined
        server.certificateData = undefined
        return this.saveAllSettings()
    }

    disableInsecureTls(server: Server): Promise<void> {
        server.tlsSecurity = "default"
        return this.saveAllSettings()
    }

    saveServer(server: Server): Promise<void> {
        this.appendServer(server)
        return this.saveAllSettings()
    }

    removeServer(server: Server): void {
        this.settings.servers.splice(0, this.settings.servers.length, ...this.settings.servers.filter((candidate) => candidate.id !== server.id))
    }

    updateServer(update: Partial<Server> & Pick<Server, "id">): Promise<void> {
        const server = this.getServer(update.id)
        if (!server) return Promise.reject("Server with id " + update.id + " not found")
        angular.merge(server, update)
        return this.saveAllSettings()
    }

    getServer(id: string): Server | undefined {
        return this.settings.servers.find((server) => server.id === id)
    }

    getServers(): Server[] {
        return this.settings.servers
    }

    getDefaultServer(): Server | undefined {
        if (this.settings.servers.length === 1) return this.settings.servers[0]
        return this.settings.servers.find((server) => server.default === true)
    }

    getRecentServer(): Server | undefined {
        return this.settings.servers.reduce<Server | undefined>((mostRecent, server) => {
            if (!mostRecent || (server.lastused || -1) > (mostRecent.lastused || -1)) return server
            return mostRecent
        }, undefined)
    }

    private loadServerCertificate(server: Server): Promise<void> {
        if (server.tlsSecurity === "insecure") {
            server.certificate = undefined
            server.certificateData = undefined
            return Promise.resolve()
        }
        if (!server.certificate) {
            server.certificateData = undefined
            return Promise.resolve()
        }
        return window.electorrent.certificates.load(server.certificate).then((certificateData) => {
            server.certificateData = certificateData ? new Uint8Array(certificateData) : undefined
        })
    }

    private loadServerCertificates(servers: Server[]): Promise<void> {
        return Promise.all(servers.map((server) => this.loadServerCertificate(server))).then(() => undefined)
    }

    private hydrateServer(server: Server | StoredServerConfig): Server {
        return typeof (server as Server)?.connect === "function" ? server as Server : new this.ServerClass(server as StoredServerConfig)
    }

    private replaceServers(servers: Array<Server | StoredServerConfig>): void {
        this.settings.servers.splice(0, this.settings.servers.length, ...servers.map((server) => this.hydrateServer(server)))
    }

    private mergeSettings(newSettings: Partial<AppSettings<Server | StoredServerConfig>>): void {
        const { servers, ui, ...rest } = newSettings
        Object.assign(this.settings, rest)
        this.settings.ui = Object.assign({}, this.settings.ui, ui || {})
        if (Array.isArray(servers)) this.replaceServers(servers)
    }

    private settingsToJson(): AppSettings<StoredServerConfig> {
        const copy = angular.copy(this.settings) as AppSettings<Server>
        return {
            ...copy,
            servers: this.settings.servers.map((server) => server.json()),
        }
    }

    private updateServerReference(): void {
        if (!this.$rootScope.$server) return
        const server = this.settings.servers.find((candidate) => candidate.id === this.$rootScope.$server.id)
        if (server) this.$bittorrent.setServer(server)
    }
}
