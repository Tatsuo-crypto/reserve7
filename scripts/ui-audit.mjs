#!/usr/bin/env node
/**
 * AQ-3: 全画面の「見た目が崩れる典型パターン」を機械的に洗い出す監査スクリプト。
 *
 *   node scripts/ui-audit.mjs
 *
 * 個別画面を目視で潰していく運用だと、新しい画面を足すたびに同じ崩れが再発するため、
 * 崩れの型をルール化してまとめて検出できるようにする。
 * globals.css の base 層で既定値を入れた項目(入力欄の背景色・はみ出し対策)は
 * 原則もう壊れないが、明示的に上書きしている箇所は引き続きここで検出する。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

const findings = []
const add = (rule, file, line, detail) =>
  findings.push({ rule, loc: `${relative(ROOT, file)}:${line}`, detail })

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length

const classOf = (attrs) => {
  const m = attrs.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/s)
  return m ? (m[1] ?? m[2] ?? '').split(/\s+/).filter(Boolean).join(' ') : ''
}

for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8')

  // 1) 入力欄に白背景を明示指定している(黒ベースのテーマから浮く)
  for (const m of src.matchAll(/<(input|select|textarea)\b((?:[^<>]|\{[^{}]*\})*?)\/?>/gs)) {
    const cls = classOf(m[2])
    const type = (m[2].match(/type="([\w-]+)"/) || [])[1] || ''
    if (['checkbox', 'radio', 'file', 'range', 'color'].includes(type)) continue
    if (/\bbg-white\b|\bbg-gray-(50|100)\b|\bbg-slate-(50|100)\b/.test(cls)) {
      add('input-light-bg', file, lineOf(src, m.index), `<${m[1]}> に白系背景`)
    }
    // 2) 幅の逃げ場が無い入力欄(親が狭いとネイティブUIが枠を突き破る)
    if (/\bw-\[|\bmin-w-\[/.test(cls) && !/\bmax-w-full\b/.test(cls)) {
      add('input-fixed-width', file, lineOf(src, m.index), `<${m[1]}> に固定幅(max-w-fullなし)`)
    }
  }

  // 3) 見出しやラベルに truncate を掛けている(長文が読めなくなる)
  //    AS-2: 目標カードで「【睡眠】お…」と切れて読めなくなっていた事例の再発防止。
  //    数値(tabular-nums)の切り詰めは桁が揃っていて問題になりにくいので対象外。
  for (const m of src.matchAll(/className="([^"]*\btruncate\b[^"]*)"/g)) {
    const cls = m[1]
    if (/\btabular-nums\b/.test(cls)) continue
    if (/\btext-(2xl|3xl|4xl|5xl)\b/.test(cls)) {
      add('truncate-large-text', file, lineOf(src, m.index), '大きい文字にtruncate(長文が読めなくなる)')
    }
  }

  // 4) 横並びグリッド/フレックスの子に min-w-0 が無く、中身が長いと押し出される
  for (const m of src.matchAll(/className="([^"]*\b(?:grid-cols-[2-9]|flex)\b[^"]*)"/g)) {
    const cls = m[1]
    if (/\btruncate\b|\bmin-w-0\b|\bflex-col\b/.test(cls)) continue
    const tail = src.slice(m.index, m.index + 400)
    if (/\btruncate\b/.test(tail) && !/\bmin-w-0\b/.test(tail)) {
      add('flex-child-no-min-w', file, lineOf(src, m.index), 'truncateの親に min-w-0 が無い')
    }
  }
}

// 5) BE-1: Tailwind の content グロブに含まれないファイルに className 文字列がある
//    → そのクラスの CSS が一切生成されず、実機で無色/無背景になる(型検査もlintも素通りする)
{
  const cfg = readFileSync(join(ROOT, 'tailwind.config.js'), 'utf8')
  const contentBlock = cfg.slice(cfg.indexOf('content:'), cfg.indexOf('theme:'))
  const globDirs = [...contentBlock.matchAll(/'\.\/([^']+?)\/\*\*/g)].map((m) => m[1])

  const walkAll = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walkAll(p, out)
      else if (/\.(ts|tsx|js|jsx)$/.test(p)) out.push(p)
    }
    return out
  }

  // 実際に使っている色/レイアウトのユーティリティらしき文字列だけを対象にする
  const CLASSY =
    /'[^']*\b(?:bg|text|border|ring|from|to|via)-(?:brand|state-[a-z]+|surface|blue|purple|green|red|amber|zinc|gray|slate|orange|yellow|teal|indigo|pink|cyan|violet|white|black)[-/][^']*'/

  for (const file of walkAll(SRC)) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    if (globDirs.some((d) => rel.startsWith(d + '/'))) continue
    const src = readFileSync(file, 'utf8')
    src.split('\n').forEach((line, i) => {
      if (CLASSY.test(line)) {
        add('class-outside-tailwind-content', file, i + 1, line.trim().slice(0, 80))
      }
    })
  }
}

const byRule = findings.reduce((acc, f) => {
  ;(acc[f.rule] ||= []).push(f)
  return acc
}, {})

const RULE_LABEL = {
  'input-light-bg': '入力欄に白系背景を明示指定(黒テーマから浮く)',
  'input-fixed-width': '入力欄に固定幅(max-w-fullなし=はみ出す恐れ)',
  'truncate-large-text': '大きい文字にtruncate(長文が途中で切れて読めない)',
  'flex-child-no-min-w': 'truncateの親に min-w-0 が無い(省略されず押し出される)',
  'class-outside-tailwind-content':
    'tailwind.config.js の content 外にclassNameがある(CSSが生成されず無色になる)',
}

let total = 0
for (const [rule, list] of Object.entries(byRule)) {
  console.log(`\n■ ${RULE_LABEL[rule] || rule} — ${list.length}件`)
  for (const f of list) console.log(`   ${f.loc}  ${f.detail}`)
  total += list.length
}

console.log(`\n合計 ${total} 件`)
process.exit(0)
