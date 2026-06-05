import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { app } from "electron"

interface PackageMeta {
    version?: string
}

function readPackageMeta(path: string): PackageMeta | undefined {
    if (!existsSync(path)) {
        return undefined
    }

    try {
        return JSON.parse(readFileSync(path, "utf8")) as PackageMeta
    } catch {
        return undefined
    }
}

export function getAppVersion() {
    const packageMeta = readPackageMeta(join(app.getAppPath(), "package.json"))
    return packageMeta?.version || app.getVersion()
}
