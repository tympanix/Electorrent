angular.module('torrentApp').factory("rtorrentConfig", [function() {

    var fields = [
        'get_base_filename',
        'get_base_path',
        'get_bitfield',
        'get_bytes_done',
        'get_chunk_size',
        'get_chunks_hashed',
        'get_complete',
        'get_completed_bytes',
        'get_completed_chunks',
        'get_connection_current',
        'get_connection_leech',
        'get_connection_seed',
        'get_creation_date',
        'get_custom1',
        'get_custom2',
        'get_custom3',
        'get_custom4',
        'get_custom5',
        'get_directory',
        'get_directory_base',
        'get_down_rate',
        'get_down_total',
        'get_free_diskspace',
        'get_hash',
        'get_hashing',
        'get_hashing_failed',
        'get_ignore_commands',
        'get_left_bytes',
        'get_loaded_file',
        'get_local_id',
        'get_local_id_html',
        'get_max_file_size',
        'get_max_size_pex',
        'get_message',
        'get_name',
        'get_peer_exchange',
        'get_peers_accounted',
        'get_peers_complete',
        'get_peers_connected',
        'get_peers_max',
        'get_peers_min',
        'get_peers_not_connected',
        'get_priority',
        'get_priority_str',
        'get_ratio',
        'get_size_bytes',
        'get_size_chunks',
        'get_size_files',
        'get_size_pex',
        'get_skip_rate',
        'get_skip_total',
        'get_state',
        'get_state_changed',
        'get_state_counter',
        'get_throttle_name',
        'get_tied_to_file',
        'get_tracker_focus',
        'get_tracker_numwant',
        'get_tracker_size',
        'get_up_rate',
        'get_up_total',
        'get_uploads_max',
        'is_active',
        'is_hash_checked',
        'is_hash_checking',
        'is_multi_file',
        'is_open',
        'is_pex_active',
        'is_private',
    ];

    var trackers = [
        'get_group',
        'get_id',
        'get_min_interval',
        'get_normal_interval',
        'get_scrape_complete',
        'get_scrape_downloaded',
        'get_scrape_incomplete',
        'get_scrape_time_last',
        'get_type', /* Get the tracker type(1 = http, 2 = udp, 3 = dht)*/
        'get_url',
        'is_enabled', /* Get the status of the tracker(0 = disabled, 1 = enabled) */
        'is_open' /* Get the status of the tracker(0 = closed, 1 = open) */
    ]

    var custom = [
        'addtime'
    ]

    return {
        fields: fields,
        custom: custom,
        trackers: trackers
    }

}])