import { execFile as execFileCallback } from 'child_process'
import { readdir } from 'fs/promises'
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

async function codesign(args) {
  return execFile('codesign', args, { maxBuffer: 1024 * 1024 })
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

export default async function(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  )
  await verifyMacosSigning(appPath)
}
