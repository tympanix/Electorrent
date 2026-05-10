/* 
 * Web worker for qBittorrent.
 */
const { InstanceWorker } = require('../../lib/worker')
new InstanceWorker(require('@electorrent/node-deluge'), self)
