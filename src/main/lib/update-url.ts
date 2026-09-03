const UPDATE_TYPES: Partial<Record<NodeJS.Platform, string>> = {
    darwin: 'dmg',
    linux: 'appimage',
    win32: 'win32',
}

export function buildUpdateUrl(endpoint: string, platform: NodeJS.Platform, version: string, architecture: string) {
    const updateType = UPDATE_TYPES[platform]
    if (!updateType) return null

    const updateUrl = `${endpoint}update/${updateType}/${version}`
    if (platform !== 'darwin' || !['arm64', 'x64'].includes(architecture)) {
        return updateUrl
    }

    return `${updateUrl}?arch=${architecture}`
}
