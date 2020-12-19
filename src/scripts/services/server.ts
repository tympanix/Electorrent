import _ from "underscore"

export let serverService = ['AbstractTorrent', '$rootScope', '$q', 'electron', 'notificationService', '$bittorrent', '$btclients',
    function(Torrent, $rootScope, $q, electron, $notify, $bittorrent, $btclients) {

        /*
         * Well known error values used for error handling
         */
        const ERR_SELF_SIGNED_CERT = "DEPTH_ZERO_SELF_SIGNED_CERT"

        /**
         * Constructor, with class name
         */
        function Server(ip, proto, port, user, password, client, path) {
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
            }
            this.isConnected = false
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
            this.columns = this.parseColumns(data.columns)
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
                certificate: this.certificate,
                columns: this.columns.filter((column) => column.enabled).map((column) => column.name),
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
            return `${this.proto}://${this.ip}:${this.port}${this.cleanPath()}`
        };

        Server.prototype.isHTTPS = function() {
            return this.proto === 'https'
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

            if(!this.client) {
                $notify.alert("Opps!", "Please select a client to connect to!")
                return $q.reject()
            }

            let service = $bittorrent.getClient(this.client);
            return service.connect(this).catch(function(err, msg) {
                self.isConnected = false
                $notify.alertAuth(err, msg)
                if (err.code === ERR_SELF_SIGNED_CERT) {
                    return self.askForCertificate().then(function() {
                        return self.connect()
                    })
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
            let defer = $q.defer()

            electron.ca.get(self.json(), function(err, cert) {
                if (err) {
                    defer.reject(err)
                } else {
                    let unsubscribe = $rootScope.$on('certificate-modal', function(e, id, fingerprint) {
                        unsubscribe()
                        if (id) {
                          self.certificate = fingerprint
                          defer.resolve()
                        } else {
                          defer.reject()
                        }
                    })
                }
            })

            return defer.promise
        }

        Server.prototype.getCertificate = function() {
            if (this.certificate) {
                return electron.ca.loadCertificate(this.certificate)
            }
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
                this.certificate === this.certificate
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
