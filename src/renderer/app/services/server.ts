import _ from "underscore"
import { Torrent } from "@renderer/app/bittorrent"
import { parseServerAddressInput, sanitizeServerAddress } from "@shared/server-address"
import type { CertificateResponseService } from "@renderer/app/services/certificate-response"
import type { SavedLocationConfig, StoredServerConfig, TorrentUploadOptions } from "@shared/ipc-contract"

export let serverService = ['$q', 'notificationService', '$bittorrent', '$btclients', 'certificateResponseService',
    function($q, $notify, $bittorrent, $btclients, certificateResponseService: CertificateResponseService) {
        const electorrent = window.electorrent

        /*
         * Well known error values used for error handling
         */
        const TLS_CERTIFICATE_ERROR_CODES = new Set([
            "DEPTH_ZERO_SELF_SIGNED_CERT",
            "SELF_SIGNED_CERT_IN_CHAIN",
            "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
            "CERT_HAS_EXPIRED",
            "ERR_TLS_CERT_ALTNAME_INVALID",
        ])

        function isTlsCertificateError(err: any) {
            if (!err) {
                return false
            }

            if (err.code && TLS_CERTIFICATE_ERROR_CODES.has(err.code)) {
                return true
            }

            if (Array.isArray(err.errors) && err.errors.some(isTlsCertificateError)) {
                return true
            }

            if (err.cause && isTlsCertificateError(err.cause)) {
                return true
            }

            const message = String(err.message || err).toLowerCase()
            return Array.from(TLS_CERTIFICATE_ERROR_CODES).some((code) => message.includes(code.toLowerCase()))
                || message.includes("self signed certificate")
                || message.includes("certificate")
        }

        function isAggregateConnectionError(err: any) {
            const message = String(err?.message || err).toLowerCase()
            return err?.name === "AggregateError" || message.includes("aggregateerror")
        }

        function isStaleConnectionError(err: any) {
            return String(err?.message || err).toLowerCase().includes("stale bittorrent connection")
        }

        /**
         * Constructor, with class name
         */
        function Server(ip, proto, port, user, password, client, path) {
            this.certificateData = undefined
            if(arguments.length === 1) {
                this.fromJson(arguments[0])
            } else {
                this.id = generateGUID()
                this.ip = ip || ''
                this.proto = proto
                this.port = port
                this.user = user || ''
                this.password = password || ''
                this.client = client
                this.path = path
                this.lastused = -1
                this.columns = this.defaultColumns()
                this.savedLocations = []
                this.defaultUploadOptionsEnabled = false
                this.defaultUploadOptions = normalizeDefaultUploadOptions()
            }
            this.isConnected = false
        }

        function normalizeSavedLocations(savedLocations?: SavedLocationConfig[]) {
            if (!Array.isArray(savedLocations)) {
                return []
            }

            return savedLocations
                .filter((savedLocation) => !!savedLocation?.path && !!savedLocation?.icon)
                .map((savedLocation) => ({
                    path: savedLocation.path,
                    icon: savedLocation.icon,
                }))
        }

        function normalizeDefaultUploadOptions(options?: TorrentUploadOptions) {
            return Object.assign({ startTorrent: true }, options || {})
        }

        Server.prototype.fromJson = function(data) {
            this.name = data.name
            this.id = data.id
            this.ip = data.ip || ''
            this.proto = data.proto || "http"
            this.port = data.port
            this.user = data.user || ''
            this.password = data.password || ''
            this.client = data.client
            this.path = data.path || ''
            this.default = data.default
            this.lastused = data.lastused
            this.certificate = data.certificate
            this.tlsSecurity = data.tlsSecurity === "insecure" ? "insecure" : "default"
            this.certificateData = data.certificateData ? new Uint8Array(data.certificateData) : undefined
            this.columns = this.parseColumns(data.columns)
            this.savedLocations = normalizeSavedLocations(data.savedLocations)
            this.defaultUploadOptionsEnabled = data.defaultUploadOptionsEnabled === true
            this.defaultUploadOptions = normalizeDefaultUploadOptions(data.defaultUploadOptions)
        };

        Server.prototype.json = function() {
            return {
                name: this.name,
                id: this.id,
                ip: this.ip,
                proto: this.proto,
                port: this.port,
                user: this.user,
                password: this.password,
                client: this.client,
                path: this.path,
                default: this.default,
                lastused: this.lastused || -1,
                certificate: this.tlsSecurity === "insecure" ? undefined : this.certificate,
                tlsSecurity: this.isHTTPS() && this.tlsSecurity === "insecure" ? "insecure" : undefined,
                columns: this.columns.filter((column) => column.enabled).map((column) => column.name),
                savedLocations: normalizeSavedLocations(this.savedLocations),
                defaultUploadOptionsEnabled: this.defaultUploadOptionsEnabled === true,
                defaultUploadOptions: normalizeDefaultUploadOptions(this.defaultUploadOptions),
            }
        };

        Server.prototype.getName = function() {
            return $btclients[this.client].name
        };

        Server.prototype.getIcon = function() {
            return $btclients[this.client].icon
        };

        Server.prototype.getNameAtAddress = function() {
            return this.getName() + " @ " + this.ip
        };

        Server.prototype.getDisplayName = function () {
          return this.name || this.getNameAtAddress()
        };

        Server.prototype.updateLastUsed = function() {
            this.lastused = new Date().getTime()
        };

        Server.prototype.cleanPath = function () {
          let path = trim(this.path, "/")
          if (path) {
            return "/" + path
          } else {
            return ""
          }
        };

        Server.prototype.url = function() {
            const server = sanitizeServerAddress(this)
            return `${server.proto}://${server.ip}:${server.port}${this.cleanPath()}`
        };

        Server.prototype.isHTTPS = function() {
            const parsed = parseServerAddressInput(this.ip, this.proto)
            return (parsed.protocol || this.proto) === 'https'
        }

        function trim(s, mask) {
            /*jshint bitwise: false*/
            while(~mask.indexOf(s[0])) {
                s = s.slice(1);
            }
            while(~mask.indexOf(s[s.length - 1])) {
                s = s.slice(0, -1);
            }
            return s;
        }

        Server.prototype.setPath = function() {
            let client = $bittorrent.getClient(this.client)
            if(client && client.defaultPath) {
                this.path = client.defaultPath()
            } else {
                this.path = "/"
            }
        };

        Server.prototype.connect = function() {
            let self = this
            Object.assign(this, sanitizeServerAddress(this))

            if(!this.client) {
                $notify.alert("Opps!", "Please select a client to connect to!")
                return $q.reject()
            }

            let service = $bittorrent.getClient(this.client);

            return service.connect(this).catch(function(err) {
                self.isConnected = false
                if (self.isHTTPS() && (isTlsCertificateError(err) || isAggregateConnectionError(err))) {
                    return self.askForCertificate().then(function() {
                        return self.connect()
                    })
                }
                if (!isStaleConnectionError(err)) {
                    $notify.alertAuth(err)
                }
                return $q.reject(err, this)
            }).then(function() {
                self.isConnected = true
                //$bittorrent.setClient(self.service);
                $bittorrent.setServer(self)
                return $q.resolve()
            })
        };

        Server.prototype.askForCertificate = function() {
            let self = this
            const response = certificateResponseService.wait(self.id)

            electorrent.certificates.fetch({
                server: self.json() as StoredServerConfig,
            }).catch((err: unknown) => {
                certificateResponseService.reject(self.id, err)
            })

            return $q.when(response).then((result) => {
                if (result && result.tlsSecurity === "insecure") {
                    self.tlsSecurity = "insecure"
                    self.certificate = undefined
                    self.certificateData = undefined
                    return
                }

                self.tlsSecurity = "default"
                self.certificate = result.fingerprint
                return electorrent.certificates.load(result.fingerprint).then((certificateData) => {
                    self.certificateData = certificateData ? new Uint8Array(certificateData) : undefined
                })
            })
        }

        Server.prototype.getCertificate = function() {
            return this.tlsSecurity === "insecure" ? undefined : this.certificateData
        }

        Server.prototype.equals = function(other) {
            return (
                this.ip === other.ip &&
                this.proto === other.proto &&
                this.port === other.port &&
                this.user === other.user &&
                this.password === other.password &&
                this.client === other.client &&
                this.path === other.path &&
                this.certificate === other.certificate &&
                this.tlsSecurity === other.tlsSecurity
            )
        }

        function zipsort(obj, sor) {
            return function(a, b) {
                let i = sor.indexOf(a.name)
                let j = sor.indexOf(b.name)
                if(i === j) {
                    return 0
                } else if(i === -1) {
                    return 1
                } else if(j === -1) {
                    return -1
                } else {
                    return i - j
                }
            }
        }

        Server.prototype.parseColumns = function(data) {
            let columns = this.defaultColumns()
            if(!data || data.length === 0) return columns
            columns.sort(zipsort(columns, data))
            columns.forEach((column) => {
                column.enabled = data.some((entry) => (entry === column.name))
            })
            return columns
        }

        Server.prototype.defaultColumns = function() {
            let columns = []
            angular.copy(Torrent.COLUMNS, columns)
            columns = this.addCustomColumns(columns)
            return columns
        }

        Server.prototype.addCustomColumns = function (columns) {
            if (this.client) {
                let client = $bittorrent.getClient(this.client)
                columns = _.union(columns, client.extraColumns)
            }
            return columns
        };

        Server.prototype.bootstrap = function () {
            this.columns = this.addCustomColumns(this.columns)
        };

        function generateGUID() {
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        }

        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

        /**
         * Return the constructor function
         */
        return Server;
    }
];
