#!/usr/bin/env node
/**
 * BA-1: globals.css を実際に PostCSS + Tailwind で処理して構文エラーを検出する。
 *
 *   node scripts/css-check.js
 *
 * 背景: AZ-1でCSSコメント内に「アスタリスク+スラッシュ」の並びを書いてしまい、
 * そこでコメントが終端して以降がCSSとして解釈され、本番ビルドが落ちた。
 * tsc も eslint も CSS を見ないため、この種のエラーはビルドするまで気づけない。
 * `next build` は当環境のSWCバイナリ制約で動かせないが、CSSのビルドだけなら
 * ここで検証できるので、押す前に必ず回せるようにする。
 */
const postcss = require('postcss')
const tailwindcss = require('tailwindcss')
const autoprefixer = require('autoprefixer')
const fs = require('fs')
const path = require('path')

const target = path.join('src', 'app', 'globals.css')
const css = fs.readFileSync(target, 'utf8')

postcss([tailwindcss('./tailwind.config.js'), autoprefixer])
  .process(css, { from: target })
  .then((result) => {
    const warnings = result.warnings()
    warnings.forEach((w) => console.warn('warn:', w.toString()))
    console.log(`✓ ${target} は正常にビルドできました (${result.css.length} bytes)`)
  })
  .catch((error) => {
    console.error(`✗ ${target} のビルドに失敗しました`)
    console.error(error.message)
    process.exit(1)
  })
