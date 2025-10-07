#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const projectRoot = path.resolve(process.cwd())
const publicDir = path.join(projectRoot, 'public')
const source = path.join(publicDir, 'logo-source.png')

const targets = [
  // iOS Safari picks from these names even without link tags
  { out: 'apple-touch-icon.png', size: 180 },
  { out: 'apple-touch-icon-precomposed.png', size: 180 },
  { out: 'apple-touch-icon-120x120.png', size: 120 },
  { out: 'apple-touch-icon-152x152.png', size: 152 },
  { out: 'apple-touch-icon-167x167.png', size: 167 },
  { out: 'apple-touch-icon-180x180.png', size: 180 },

  // Android / PWA
  { out: 'android-chrome-192x192.png', size: 192 },
  { out: 'android-chrome-512x512.png', size: 512 },

  // Favicons
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
  const bg = { r: 17, g: 24, b: 39, alpha: 1 } // #111827
  await Promise.all(
    targets.map(async ({ out, size }) => {
      const dest = path.join(publicDir, out)
      const inner = Math.round(size * 0.9) // 0.9x scale for safe padding

      // Resize source to inner size keeping aspect, then composite onto square canvas
      const logo = await sharp(buffer)
        .resize(inner, inner, { fit: 'contain', background: bg })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer()

      const canvas = sharp({ create: { width: size, height: size, channels: 4, background: bg } })

      await canvas
        .composite([{ input: logo, gravity: 'center' }])
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
