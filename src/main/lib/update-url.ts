const UPDATE_TYPES: Partial<Record<NodeJS.Platform, string>> = {
    darwin: 'dmg',
    linux: 'appimage',
    win32: 'win32',
}

export function buildUpdateUrl(endpoint: string, platform: NodeJS.Platform, version: string, architecture: string) {
    const updateType = UPDATE_TYPES[platform]
    if (!updateType) return null

    const architectureSuffix = platform === 'darwin' && architecture === 'arm64' ? '_arm64' : ''
    return `${endpoint}update/${updateType}${architectureSuffix}/${version}`
}
