import { ImageResponse } from 'next/og'

export const size = {
  width: 512,
  height: 512,
}
export const contentType = 'image/png'

export default function Icon() {
  const { width, height } = size
  const bg = '#111827' // gray-900
  const fg = '#ffffff'

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: bg,
          color: fg,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 240,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          T&J
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
