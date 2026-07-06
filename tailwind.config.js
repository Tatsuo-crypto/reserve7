/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      fontFamily: {
        // N-4: 日本語UIのための日本語フォント。next/font側で読み込んだCSS変数を参照する。
        sans: ['var(--font-noto-sans-jp)', 'sans-serif'],
      },
      colors: {
        // O-1: アクセントカラーを1色に一元管理する(N-4からの改訂: blue→オレンジ)。
        // 「1色に絞る」という規律自体は不変で、色相だけオーナー指定でオレンジに転調した。
        // 値はTailwind標準のorangeスケールをそのまま採用し、将来色そのものを変える場合も
        // この1箇所を差し替えるだけで全画面に反映されるようにする。
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // O-1: 「状態色」レイヤー。達成度・状態表示の文脈でのみ使う(装飾には使わない)。
        // 緑=達成/安全圏、赤=明確な超過・警告。実体はTailwind標準スケールのエイリアス。
        state: {
          success: {
            50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857',
          },
          danger: {
            50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
          },
        },
      },
    },
  },
  plugins: [],
}
