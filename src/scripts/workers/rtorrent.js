/* Web worker for rTorrent.
 * Script is used to load the rTorrent library into a web worker of offload
 * performance ciritical tasks to a new thread.
 */
const { InstanceWorker } = require('../../lib/worker')
new InstanceWorker(require('@electorrent/node-rtorrent'), self)
