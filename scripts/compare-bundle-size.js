#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const BASELINE = path.resolve('.next/analyze/baseline.json')
const STATS = path.resolve('.next/analyze/stats.json')

function getFirstLoadFromNextBuild() {
  // Fallback: parse Next.js text report if needed in future
  return null
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return null }
}

function calcClientTotal(stats) {
  if (!stats || !stats.assets) return null
  // Sum JS assets sizes as a proxy for first load
  const total = stats.assets
    .filter(a => /\.js$/.test(a.name))
    .reduce((sum, a) => sum + (a.size || 0), 0)
  return total
}

function main() {
  const baseline = readJson(BASELINE)
  const stats = readJson(STATS)

  if (!stats) {
    console.log('No stats.json found; skipping bundle-size check.')
    process.exit(0)
  }

  const now = calcClientTotal(stats)
  if (now == null) {
    console.log('Unable to compute current client bundle size; skipping.')
    process.exit(0)
  }

  if (!baseline) {
    // First run: write baseline
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true })
    fs.writeFileSync(BASELINE, JSON.stringify(stats, null, 2))
    console.log(`Baseline saved (client total ~${(now/1024).toFixed(1)} KiB).`)
    process.exit(0)
  }

  const baseTotal = calcClientTotal(baseline)
  if (baseTotal == null) {
    console.log('Invalid baseline; skipping.')
    process.exit(0)
  }

  const diff = now - baseTotal
  const pct = (diff / baseTotal) * 100
  const limit = 5 // percent

  console.log(`Client JS total: base ${(baseTotal/1024).toFixed(1)} KiB -> now ${(now/1024).toFixed(1)} KiB (${pct.toFixed(2)}%)`)

  if (pct > limit) {
    console.error(`Bundle size increased by ${pct.toFixed(2)}% (> ${limit}%). Failing.`)
    process.exit(1)
  }
  console.log('Bundle size within threshold. OK.')
}

main()
