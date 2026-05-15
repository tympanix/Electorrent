import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootPackagePath = path.join(__dirname, '..', 'package.json')
const appPackagePath = path.join(__dirname, '..', 'app', 'package.json')

const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'))
const appPackage = JSON.parse(fs.readFileSync(appPackagePath, 'utf8'))

appPackage.version = rootPackage.version

fs.writeFileSync(appPackagePath, `${JSON.stringify(appPackage, null, 2)}\n`)
