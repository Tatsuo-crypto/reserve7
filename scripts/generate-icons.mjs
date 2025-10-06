#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const projectRoot = path.resolve(process.cwd())
const publicDir = path.join(projectRoot, 'public')
const source = path.join(publicDir, 'logo-source.png')

const targets = [
  { out: 'apple-touch-icon.png', size: 180 },
  { out: 'android-chrome-192x192.png', size: 192 },
  { out: 'android-chrome-512x512.png', size: 512 },
  { out: 'favicon-32x32.png', size: 32 },
  { out: 'favicon-16x16.png', size: 16 },
]

async function main() {
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir)
  if (!fs.existsSync(source)) {
    console.error(`Source image not found: ${source}`)
    console.error('Place your logo file at public/logo-source.png (preferably 1024x1024 PNG).')
    process.exit(1)
  }

  const buffer = fs.readFileSync(source)
  await Promise.all(
    targets.map(async ({ out, size }) => {
      const dest = path.join(publicDir, out)
      await sharp(buffer)
        .resize(size, size, { fit: 'contain', background: { r: 17, g: 24, b: 39, alpha: 1 } }) // bg #111827
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(dest)
      console.log('Generated', out)
    })
  )

  console.log('All icons generated in /public')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
