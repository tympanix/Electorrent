import { exec as execCallback } from 'child_process'
import path from 'path'
import { promisify } from 'util'

const exec = promisify(execCallback)

export default async function(context) {
  const electronPlatformNameLoweredCase = context.electronPlatformName.toLowerCase()

  if (electronPlatformNameLoweredCase.startsWith('lin')) {
    const chromeSandbox = path.join(context.appOutDir, 'chrome-sandbox')
    console.log(`Changing permissions for ${chromeSandbox}`)
    await exec(`chmod 4755 ${chromeSandbox}`)
  }
}
