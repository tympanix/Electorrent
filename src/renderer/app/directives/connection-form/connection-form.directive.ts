import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import { parseServerAddressInput, sanitizeServerAddress } from "@shared/server-address";
import html from "./connection-form.template.html";

interface ConnectionFormScope extends angular.IScope {
    server: any;
    btclients: any;
    connecting?: boolean;
    showSubmit?: boolean;
    showLabels?: boolean;
    large?: boolean;
    submit?: () => void;
    hostLocks: {
        scheme: boolean;
        port: boolean;
    };
    submitForm: () => void;
    setPath: () => void;
    resetPath: () => void;
    lockPath: () => void;
}

export class ConnectionFormDirective implements IDirective {
    restrict = "E";
    template = html;
    scope = {
        server: "=",
        btclients: "=",
        connecting: "=",
        showSubmit: "=?",
        showLabels: "=?",
        large: "=?",
        submit: "&?",
    };

    static getInstance(): IDirectiveFactory {
        return () => new ConnectionFormDirective();
    }

    link(scope: ConnectionFormScope) {
        scope.showSubmit = scope.showSubmit === true;
        scope.showLabels = scope.showLabels !== false;
        scope.large = scope.large === true;
        scope.hostLocks = { scheme: false, port: false };

        function syncHostFields() {
            const parsed = parseServerAddressInput(scope.server?.ip, scope.server?.proto);

            scope.hostLocks.scheme = parsed.hasExplicitProtocol;
            if (parsed.protocol) {
                scope.server.proto = parsed.protocol;
            }

            scope.hostLocks.port = parsed.hasExplicitPort;
            if (parsed.port) {
                scope.server.port = parsed.port;
            }

        }

        scope.submitForm = () => {
            if (scope.server) {
                Object.assign(scope.server, sanitizeServerAddress(scope.server));
            }
            if (scope.submit) {
                scope.submit();
            }
        };

        scope.setPath = () => {
            if (scope.server?.client) {
                scope.server.setPath();
            }
        };

        scope.resetPath = () => {
            scope.server.setPath();
        };

        scope.lockPath = () => {
            // Kept for template compatibility: manual edits are naturally preserved by ng-model.
        };

        scope.$watch("server.ip", syncHostFields);
    }
}

torrentApp.directive("connectionForm", ConnectionFormDirective.getInstance())
