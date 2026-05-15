export interface ClientMetadata {
    name: string
    icon: string
    showAdvancedUploadMenu: boolean
}

export const CLIENT_METADATA: Record<string, ClientMetadata> = {
    utorrent: {
        name: 'µTorrent',
        icon: 'utorrent',
        showAdvancedUploadMenu: false,
    },
    qbittorrent: {
        name: 'qBittorrent',
        icon: 'qbittorrent',
        showAdvancedUploadMenu: true,
    },
    transmission: {
        name: 'Transmission',
        icon: 'transmission',
        showAdvancedUploadMenu: true,
    },
    rtorrent: {
        name: 'rTorrent',
        icon: 'rtorrent',
        showAdvancedUploadMenu: false,
    },
    synology: {
        name: 'Synology Download Station',
        icon: 'downloadstation',
        showAdvancedUploadMenu: false,
    },
    deluge: {
        name: 'Deluge',
        icon: 'deluge',
        showAdvancedUploadMenu: false,
    },
}
