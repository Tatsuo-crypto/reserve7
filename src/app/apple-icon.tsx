import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
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
          borderRadius: 32,
        }}
      >
        <svg
          width={120}
          height={120}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <rect x="28" y="58" width="72" height="12" rx="2" fill={fg} />
          <rect x="16" y="48" width="8" height="32" rx="2" fill={fg} />
          <rect x="8" y="40" width="8" height="48" rx="2" fill={fg} />
          <rect x="104" y="48" width="8" height="32" rx="2" fill={fg} />
          <rect x="112" y="40" width="8" height="48" rx="2" fill={fg} />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
