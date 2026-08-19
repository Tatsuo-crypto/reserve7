import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const dynamic = 'force-static'

export async function GET() {
  const icon = await readFile(join(process.cwd(), 'public/favicon-32x32.png'))

  return new Response(new Uint8Array(icon), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
