import "@angular/compiler";
import { ApplicationRef, provideZoneChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import {
    Aria2Client,
    DelugeClient,
    MockBittorrentClient,
    QBittorrentClient,
    RtorrentClient,
    SynologyClient,
    TransmissionClient,
    UtorrentClient,
} from "@renderer/app/bittorrent";
import { AppShellComponent } from "@renderer/app/directives/app-shell/app-shell.directive";
import { CertificateResponseService } from "@renderer/app/services/certificate-response";
import { bittorrentService } from "@renderer/app/services/bittorrent";
import { httpFormService } from "@renderer/app/services/httpFormService";
import { labelColorService } from "@renderer/app/services/label-colors";
import { notificationService } from "@renderer/app/services/notification";
import { serverService } from "@renderer/app/services/server";
import { settingsService } from "@renderer/app/services/settings";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";
import { CLIENT_METADATA, type ClientId } from "@shared/client-metadata";

type LegacyDefinition = Array<string | ((...args: any[]) => any)>;

class RootEventBus implements ElectorrentRootScope {
    [key: string]: any;
    private readonly listeners = new Map<string, Set<(event: unknown, ...args: any[]) => void>>();
    private application?: ApplicationRef;

    attach(application: ApplicationRef): void {
        this.application = application;
    }

    $on(name: string, callback: (event: unknown, ...args: any[]) => void): () => void {
        const listeners = this.listeners.get(name) || new Set();
        listeners.add(callback);
        this.listeners.set(name, listeners);
        return () => listeners.delete(callback);
    }

    $emit(name: string, ...args: any[]): void {
        const event = { name, targetScope: this, currentScope: this };
        Array.from(this.listeners.get(name) || []).forEach((callback) => callback(event, ...args));
        this.scheduleChangeDetection();
    }

    $broadcast(name: string, ...args: any[]): void {
        this.$emit(name, ...args);
    }

    $applyAsync(callback?: () => void): void {
        queueMicrotask(() => {
            callback?.();
            this.application?.tick();
        });
    }

    private scheduleChangeDetection(): void {
        queueMicrotask(() => this.application?.tick());
    }
}

const rootScope = new RootEventBus();
const clients = createClients();
const promises = {
    when: <T>(value?: T | PromiseLike<T>) => Promise.resolve(value),
    resolve: <T>(value?: T | PromiseLike<T>) => Promise.resolve(value),
    reject: (reason?: unknown) => Promise.reject(reason),
    all: <T>(values: Iterable<T | PromiseLike<T>>) => Promise.all(values),
};

const notifications = constructService(notificationService, { $rootScope: rootScope });
const bittorrent = constructService(bittorrentService, {
    $rootScope: rootScope,
    $injector: { get: (name: string) => providers[name] },
    $btclients: clients,
    notificationService: notifications,
});
const certificateResponses = new CertificateResponseService();
const Server = invokeFactory(serverService, {
    $q: promises,
    notificationService: notifications,
    $bittorrent: bittorrent,
    $btclients: clients,
    certificateResponseService: certificateResponses,
});
const settings = constructService(settingsService, {
    $rootScope: rootScope,
    $bittorrent: bittorrent,
    notificationService: notifications,
    $q: promises,
    Server,
});
const labelColors = constructService(labelColorService, { $rootScope: rootScope });
const formEncoder = invokeFactory(httpFormService, {});
const http = {
    get: async (url: string, options?: { timeout?: number }) => {
        const controller = new AbortController();
        const timer = options?.timeout ? window.setTimeout(() => controller.abort(), options.timeout) : undefined;
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return { data: await response.json(), status: response.status };
        } finally {
            if (timer !== undefined) window.clearTimeout(timer);
        }
    },
};

const providers: Record<string, any> = {
    "$rootScope": rootScope,
    "$btclients": clients,
    "$bittorrent": bittorrent,
    "$q": promises,
    "$http": http,
    "Server": Server,
    "settingsService": settings,
    "notificationService": notifications,
    "certificateResponseService": certificateResponses,
    "labelColorService": labelColors,
    "httpFormService": formEncoder,
};

void settings.initSettings().catch(() => window.electorrent.app.reportCorruptSettings());
installThemeHandling(settings, rootScope);

bootstrapApplication(AppShellComponent, {
    providers: [
        provideZoneChangeDetection(),
        ...Object.entries(providers).map(([provide, useValue]) => ({ provide, useValue })),
    ],
}).then((application) => {
    rootScope.attach(application);
    (window as any).angular = {
        element: () => ({
            injector: () => ({ get: (name: string) => providers[name] }),
        }),
    };
}).catch((error) => {
    console.error("Could not bootstrap renderer", error);
});

function createClients(): Record<string, { name: string; service: any; icon: string; defaultPort?: number }> {
    const factories: Record<ClientId, () => any> = {
        aria2: () => new Aria2Client(),
        utorrent: () => new UtorrentClient(),
        qbittorrent: () => new QBittorrentClient(),
        transmission: () => new TransmissionClient(),
        rtorrent: () => new RtorrentClient(),
        synology: () => new SynologyClient(),
        deluge: () => new DelugeClient(),
        mock: () => new MockBittorrentClient(),
    };
    return Object.fromEntries((Object.keys(factories) as ClientId[])
        .filter((id) => id !== "mock" || window.electorrent.app.isTestEnvironment)
        .map((id) => [id, { ...CLIENT_METADATA[id], service: factories[id]() }]));
}

function resolveArguments(definition: LegacyDefinition, dependencies: Record<string, any>): { factory: (...args: any[]) => any; args: any[] } {
    const factory = definition[definition.length - 1] as (...args: any[]) => any;
    const args = definition.slice(0, -1).map((name) => dependencies[String(name)]);
    return { factory, args };
}

function constructService(definition: LegacyDefinition, dependencies: Record<string, any>): any {
    const { factory, args } = resolveArguments(definition, dependencies);
    const instance = Object.create(factory.prototype || Object.prototype);
    return factory.apply(instance, args) ?? instance;
}

function invokeFactory(definition: LegacyDefinition, dependencies: Record<string, any>): any {
    const { factory, args } = resolveArguments(definition, dependencies);
    return factory(...args);
}

function installThemeHandling(settingsService: any, events: RootEventBus): void {
    let systemTheme = window.electorrent.app.initialTheme;
    const apply = () => {
        const preference = settingsService.getAllSettings().ui.theme;
        const theme = preference === "system" ? systemTheme : preference;
        document.querySelector<HTMLLinkElement>('link[href*="css/themes/"]')?.setAttribute("href", `css/themes/${theme}.css`);
    };
    window.electorrent.settings.onSystemThemeChanged((theme) => {
        systemTheme = theme;
        apply();
    });
    events.$on("new:settings", () => apply());
    void settingsService.whenReady().then(apply);
}
