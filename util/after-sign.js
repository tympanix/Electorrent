import { execFile as execFileCallback } from 'child_process'
import { mkdtemp, readdir, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { promisify } from 'util'

const execFile = promisify(execFileCallback)

const appIdentifier = 'com.github.tympanix.electorrent'
const requiredEntitlements = [
  'com.apple.security.cs.allow-jit',
  'com.apple.security.cs.allow-unsigned-executable-memory',
  'com.apple.security.cs.disable-library-validation',
]
const helperIdentifiers = new Map([
  ['Electorrent Helper.app', `${appIdentifier}.helper`],
  ['Electorrent Helper (GPU).app', `${appIdentifier}.helper.GPU`],
  ['Electorrent Helper (Plugin).app', `${appIdentifier}.helper.Plugin`],
  ['Electorrent Helper (Renderer).app', `${appIdentifier}.helper.Renderer`],
])
const dmgArchitectures = new Map([
  ['universal', new Set(['arm64', 'x86_64'])],
  ['arm64', new Set(['arm64'])],
])

async function codesign(args) {
  return execFile('codesign', args, { maxBuffer: 1024 * 1024 })
}

async function command(commandName, args) {
  return execFile(commandName, args, { maxBuffer: 1024 * 1024 })
}

async function appBundles(directory) {
  const bundles = []

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const entryPath = path.join(directory, entry.name)
    if (entry.name.endsWith('.app')) {
      bundles.push(entryPath)
    }
    bundles.push(...await appBundles(entryPath))
  }

  return bundles
}

function assertIncludes(output, expected, description) {
  if (!output.includes(expected)) {
    throw new Error(`Invalid macOS signature: expected ${description} (${expected})`)
  }
}

async function verifyAdHocSignature(bundlePath, expectedIdentifier) {
  const { stderr } = await codesign(['--display', '--verbose=2', bundlePath])

  assertIncludes(stderr, `Identifier=${expectedIdentifier}`, 'bundle identifier')
  assertIncludes(stderr, 'Signature=adhoc', 'ad-hoc signature')
  assertIncludes(stderr, 'TeamIdentifier=not set', 'empty team identifier')
  await codesign(['--verify', '--strict', '--verbose=2', bundlePath])
}

async function verifyEntitlements(appPath) {
  const { stdout, stderr } = await codesign(['--display', '--entitlements', ':-', appPath])
  const entitlements = `${stdout}\n${stderr}`

  for (const entitlement of requiredEntitlements) {
    const escapedEntitlement = entitlement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const enabledEntitlement = new RegExp(
      `<key>\\s*${escapedEntitlement}\\s*</key>\\s*<true\\s*/>`,
    )
    if (!enabledEntitlement.test(entitlements)) {
      throw new Error(`Invalid macOS signature: expected enabled runtime entitlement (${entitlement})`)
    }
  }

  if (entitlements.includes('<key>com.apple.security.app-sandbox</key>')) {
    throw new Error('Invalid macOS signature: App Sandbox must not be enabled')
  }
}

export async function verifyMacosSigning(appPath) {
  await verifyAdHocSignature(appPath, appIdentifier)
  await verifyEntitlements(appPath)

  const nestedApps = (await appBundles(path.join(appPath, 'Contents')))
    .filter((bundlePath) => bundlePath !== appPath)

  if (nestedApps.length !== helperIdentifiers.size) {
    throw new Error(`Invalid macOS package: expected ${helperIdentifiers.size} nested helper applications`)
  }

  for (const nestedApp of nestedApps) {
    const identifier = helperIdentifiers.get(path.basename(nestedApp))
    if (!identifier) {
      throw new Error(`Invalid macOS package: unexpected nested helper ${nestedApp}`)
    }
    await verifyAdHocSignature(nestedApp, identifier)
  }

  await codesign(['--verify', '--deep', '--strict', '--verbose=2', appPath])
  console.log(`Verified ad-hoc signature for ${appPath} and ${nestedApps.length} nested helper applications`)
}

async function verifyArchitectures(appPath, expectedArchitectures) {
  const executablePath = path.join(appPath, 'Contents', 'MacOS', 'Electorrent')
  const { stdout } = await command('lipo', ['-archs', executablePath])
  const actualArchitectures = new Set(stdout.trim().split(/\s+/))

  if (
    actualArchitectures.size !== expectedArchitectures.size
    || [...expectedArchitectures].some((architecture) => !actualArchitectures.has(architecture))
  ) {
    throw new Error(
      `Invalid macOS package: expected architectures ${[...expectedArchitectures].join(', ')}`
      + ` but found ${[...actualArchitectures].join(', ')}`,
    )
  }
}

async function appInMountedDmg(mountPoint) {
  const apps = (await readdir(mountPoint, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))

  if (apps.length !== 1) {
    throw new Error(`Invalid macOS package: expected one application in mounted DMG, found ${apps.length}`)
  }

  return path.join(mountPoint, apps[0].name)
}

async function verifyDmg(dmgPath, expectedArchitectures) {
  const mountPoint = await mkdtemp(path.join(os.tmpdir(), 'electorrent-signing-'))
  let attached = false

  try {
    await command('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mountPoint, dmgPath])
    attached = true

    const appPath = await appInMountedDmg(mountPoint)
    await verifyMacosSigning(appPath)
    await verifyArchitectures(appPath, expectedArchitectures)
    console.log(`Verified packaged macOS application in ${dmgPath}`)
  } finally {
    try {
      if (attached) {
        await command('hdiutil', ['detach', mountPoint])
      }
    } finally {
      await rm(mountPoint, { recursive: true, force: true })
    }
  }
}

export default async function(context) {
  if (process.platform !== 'darwin') {
    return []
  }

  const dmgPaths = context.artifactPaths.filter((artifactPath) => artifactPath.endsWith('.dmg'))

  if (dmgPaths.length !== dmgArchitectures.size) {
    throw new Error(
      `Invalid macOS artifacts: expected ${dmgArchitectures.size} DMGs, found ${dmgPaths.length}`,
    )
  }

  for (const [architecture, expectedArchitectures] of dmgArchitectures) {
    const suffix = `-${architecture}.dmg`
    const matchingPaths = dmgPaths.filter((artifactPath) => artifactPath.endsWith(suffix))
    if (matchingPaths.length !== 1) {
      throw new Error(
        `Invalid macOS artifacts: expected one ${architecture} DMG, found ${matchingPaths.length}`,
      )
    }
    await verifyDmg(matchingPaths[0], expectedArchitectures)
  }

  return []
}
