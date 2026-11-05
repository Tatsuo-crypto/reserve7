import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

function git(args, input) {
  const result = spawnSync('git', args, { encoding: 'utf8', input, maxBuffer: 16 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Git operation failed')
  return result.stdout
}

try {
  const root = git(['rev-parse', '--show-toplevel']).trim()
  process.chdir(root)
  const revision = git(['rev-parse', '--verify', '--end-of-options', `${process.argv[2] || 'HEAD'}^{commit}`]).trim()
  const files = git(['ls-tree', '-r', '--name-only', '-z', revision]).split('\0').filter(Boolean)
  const attributes = git(['check-attr', '-z', '--stdin', 'export-ignore'], `${files.join('\0')}\0`).split('\0')
  const ignored = new Set()
  for (let i = 0; i + 2 < attributes.length; i += 3) {
    if (attributes[i + 2] === 'set') ignored.add(attributes[i])
  }
  const included = files.filter(file => !ignored.has(file))
  const includedSet = new Set(included)
  const required = ['README.md', '.env.example', '.gitattributes', 'SOURCE_VERSION', 'package.json', 'package-lock.json', 'next.config.js', 'tailwind.config.js', 'postcss.config.js', 'tsconfig.json', 'playwright.config.ts', 'vercel.json', 'src/app/layout.tsx', 'public/tj-gym-logo.png', 'database/schema.sql', 'docs/ARCHIVE_CONTENTS.md', 'scripts/export-source.mjs', 'scripts/test-membership-transactions.cjs']
  const missing = required.filter(file => !includedSet.has(file))
  if (missing.length) throw new Error(`Archive configuration is incomplete: ${missing.join(', ')}`)

  const unsafe = included.filter(file =>
    /^(?:data|scratch|public\.off|test-results|playwright-report|notes|outputs|references|personal-task-cloud|video-edit-test|node_modules|\.git|\.next[^/]*)\//.test(file) ||
    /(?:^|\/)(?:cookies[^/]*\.txt|\.DS_Store|\.env(?:$|\.(?!example$)))/.test(file) ||
    /\.(?:pem|log|tsbuildinfo)$/.test(file)
  )
  if (unsafe.length) throw new Error(`Local or private files must be excluded: ${unsafe.join(', ')}`)

  const outputDir = path.join(root, 'outputs', 'exports')
  fs.mkdirSync(outputDir, { recursive: true })
  const filename = `TandJ-GYM-source-${revision.slice(0, 8)}.zip`
  const destination = path.join(outputDir, filename)
  const tempDir = fs.mkdtempSync(path.join(outputDir, '.archive-'))
  const temporary = path.join(tempDir, filename)
  try {
    git(['archive', '--format=zip', '--worktree-attributes', '--prefix=TandJ-GYM/', `--output=${temporary}`, revision])
    if (fs.existsSync(destination)) {
      const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
      if (hash(destination) !== hash(temporary)) throw new Error(`A different archive already exists: ${destination}`)
    } else {
      fs.copyFileSync(temporary, destination, fs.constants.COPYFILE_EXCL)
    }
    console.log(JSON.stringify({ archive: destination, commit: revision, files: included.length, excluded: ignored.size, bytes: fs.statSync(destination).size, workingChangesIncluded: false }, null, 2))
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
} catch (error) {
  console.error(`Source archive: ${error.message}`)
  process.exitCode = 1
}
