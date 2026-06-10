#!/usr/bin/env node
// validate.js — regression validator
// Usage:
//   node scripts/validate.js
//   node scripts/validate.js --runs 5
//   node scripts/validate.js --cluster transform-user-data
//   node scripts/validate.js --update transform-user-data --reason "tax rate changed to 12%"
//   node scripts/validate.js --fail-fast

import { readFileSync, writeFileSync, readdirSync, appendFileSync, existsSync } from 'fs'
import { resolve, join, basename } from 'path'
import { pathToFileURL } from 'url'
import { fingerprint, fingerprintSequence } from './fingerprint.js'

// ─── CLI args ─────────────────────────────────────────────────────────────────

function getArg(args, flag) {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] ?? null : null
}

const args          = process.argv.slice(2)
const clusterFilter = getArg(args, '--cluster')
const failFast      = args.includes('--fail-fast')
const runs          = parseInt(getArg(args, '--runs') ?? '1')
const updateTarget  = getArg(args, '--update')
const updateReason  = getArg(args, '--reason')
const manifestPath  = getArg(args, '--manifest') ?? resolve(process.cwd(), 'regrets/manifest.json')
const regretDir     = resolve(process.cwd(), 'regrets')
const auditLog      = join(regretDir, 'audit.log')

// ─── Validate --update usage ──────────────────────────────────────────────────

if (updateTarget && !updateReason) {
  console.error(`❌ --update requires --reason`)
  console.error(`   Example: --update ${updateTarget} --reason "describe why behavior changed"`)
  process.exit(1)
}

if (updateReason && updateReason.split(' ').length < 4) {
  console.error(`❌ --reason is too vague: "${updateReason}"`)
  console.error(`   Be specific. e.g. "tax rate updated from 11% to 12% per new regulation"`)
  process.exit(1)
}

// ─── Parse a .regret file ─────────────────────────────────────────────────────

function parseRegret(content) {
  const [metaSection, dataSection] = content.split('\n---\n')
  const meta = {}
  for (const line of metaSection.split('\n')) {
    const colonIdx = line.indexOf(': ')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx)
    const val = line.slice(colonIdx + 2).trim()
    if (key === 'watches') meta.watches = val.slice(1, -1).split(', ').filter(Boolean)
    else if (key === 'normalize') meta.normalize = val.slice(1, -1).split(', ').filter(Boolean)
    else if (key === 'ignoreFields') meta.ignoreFields = val.slice(1, -1).split(', ').filter(Boolean)
    else meta[key] = val
  }
  const lines = dataSection?.split('\n') ?? []
  const inputLine  = lines.find(l => l.startsWith('INPUT '))
  const outputLine = lines.find(l => l.startsWith('OUTPUT '))
  const hashLine   = lines.find(l => l.startsWith('HASH '))
  return {
    ...meta,
    input:      inputLine  ? JSON.parse(inputLine.replace(/^INPUT\s+/, ''))   : null,
    output:     outputLine ? JSON.parse(outputLine.replace(/^OUTPUT\s+/, '')) : null,
    goldenHash: hashLine   ? hashLine.replace(/^HASH\s+/, '').trim()          : null,
    raw:        content
  }
}

// ─── Ghost proxy ──────────────────────────────────────────────────────────────

function createGhost(mod, watchList, recorder) {
  const proxied = {}
  for (const fn of (watchList ?? [])) {
    if (typeof mod[fn] !== 'function') continue
    const orig = mod[fn]
    proxied[fn] = new Proxy(orig, {
      apply(t, thisArg, a) {
        const r = t.apply(thisArg, a)
        if (r?.then) return r.then(v => { recorder.push({ fn, args: clone(a), result: clone(v) }); return v })
        recorder.push({ fn, args: clone(a), result: clone(r) })
        return r
      }
    })
  }
  return { ...mod, ...proxied }
}

function clone(v) { try { return JSON.parse(JSON.stringify(v)) } catch { return v } }

// ─── Load manifest ────────────────────────────────────────────────────────────

let manifest
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) }
catch { console.error(`❌ Could not read manifest: ${manifestPath}`); process.exit(1) }

// ─── Find .regret files ───────────────────────────────────────────────────────

const filterId = clusterFilter ?? updateTarget ?? null
let regretFiles
try {
  regretFiles = readdirSync(regretDir)
    .filter(f => f.endsWith('.regret'))
    .filter(f => !filterId || f === `${filterId}.regret`)
} catch { console.error(`❌ regrets/ not found. Run capture.js first.`); process.exit(1) }

if (!regretFiles.length) {
  console.error(`❌ No .regret files found${filterId ? ` for "${filterId}"` : ''}.`)
  process.exit(1)
}

// ─── Run cluster N times ──────────────────────────────────────────────────────

async function runCluster(clusterDef, regret) {
  const { entry, file, normalize = [], ignoreFields = [], fingerprintLevel = 'entry', multiArgs = false } = clusterDef
  const mod = await import(pathToFileURL(resolve(process.cwd(), file)).href)
  const hashes = []
  let lastOutput = null

  for (let i = 0; i < runs; i++) {
    const recorder = []
    const ghost    = createGhost(mod, regret.watches ?? clusterDef.watches, recorder)
    const entryFn  = ghost[entry] ?? mod[entry]
    if (typeof entryFn !== 'function') throw new Error(`Entry "${entry}" not found in ${file}`)
    // multiArgs: spread input as separate arguments
    const args_ = multiArgs && Array.isArray(regret.input) ? regret.input : [regret.input]
    const output   = await entryFn(...args_)
    lastOutput     = output
    const fpInput  = multiArgs && Array.isArray(regret.input) ? regret.input : regret.input
    const fp = fingerprintLevel === 'entry'
      ? fingerprint(fpInput, output, { normalize, ignoreFields })
      : fingerprintSequence(recorder, { normalize, ignoreFields })
    hashes.push(fp)
  }
  return { hashes, lastOutput }
}

// ─── Update a .regret ─────────────────────────────────────────────────────────

function updateRegret(regretPath, regret, newHash, liveOutput, reason) {
  const oldHash = regret.goldenHash
  const now = new Date().toISOString()
  const newContent = regret.raw
    .replace(/^fingerprint: .+$/m, `fingerprint: ${newHash}`)
    .replace(/^captured: .+$/m,    `captured: ${now}`)
    .replace(/^OUTPUT .+$/m,       `OUTPUT ${JSON.stringify(liveOutput)}`)
    .replace(/^HASH .+$/m,         `HASH   ${newHash}`)
  writeFileSync(regretPath, newContent, 'utf8')
  const entry = `\n${now}  UPDATE  ${basename(regretPath, '.regret')}\n  old: ${oldHash}\n  new: ${newHash}\n  reason: ${reason}\n  by: AI refactor session`
  appendFileSync(auditLog, entry, 'utf8')
  return { oldHash, newHash }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const updateMode = !!updateTarget
const driftMode  = runs > 1 && !updateMode

if (updateMode)     console.log(`\n🔄 Update mode — cluster: ${updateTarget}\n   Reason: ${updateReason}\n`)
else if (driftMode) console.log(`\n🔍 Drift detection — ${runs} runs per cluster...\n`)
else                console.log(`\n🔍 Validating ${regretFiles.length} cluster(s)...\n`)

const results = []

for (const file of regretFiles) {
  const id         = basename(file, '.regret')
  const regretPath = join(regretDir, file)
  const regret     = parseRegret(readFileSync(regretPath, 'utf8'))
  const def        = manifest.clusters.find(c => c.id === id)
  if (!def) { console.warn(`  ⚠️  ${id}: not in manifest — skipping`); continue }

  try {
    const { hashes, lastOutput } = await runCluster(def, regret)
    const liveHash = hashes[0]
    const isMatch  = liveHash === regret.goldenHash
    const isDrift  = driftMode && new Set(hashes).size > 1

    if (updateMode) {
      if (isMatch) {
        console.log(`  ℹ️  ${id.padEnd(35)} unchanged — no update needed`)
        results.push({ id, pass: true })
      } else {
        const { oldHash, newHash } = updateRegret(regretPath, regret, liveHash, lastOutput, updateReason)
        console.log(`  ✅ ${id.padEnd(35)} ${oldHash} → ${newHash}  UPDATED`)
        results.push({ id, pass: true, updated: true })
      }
    } else if (driftMode) {
      if (isDrift) {
        console.log(`  ❌ ${id.padEnd(35)} DRIFT  [${hashes.join(' / ')}]`)
        results.push({ id, pass: false, drift: true })
      } else {
        const icon = isMatch ? '✅' : '❌'
        console.log(`  ${icon} ${id.padEnd(35)} ${liveHash}  × ${runs}  ${isMatch ? 'PASS+STABLE' : 'FAIL'}`)
        results.push({ id, pass: isMatch })
      }
    } else {
      const icon = isMatch ? '✅' : '❌'
      const hstr = isMatch ? regret.goldenHash : `${regret.goldenHash} → ${liveHash}`
      console.log(`  ${icon} ${id.padEnd(35)} ${hstr.padEnd(22)} ${isMatch ? 'PASS' : 'FAIL'}`)
      results.push({ id, pass: isMatch, golden: regret.goldenHash, live: liveHash })
    }

  } catch (err) {
    console.log(`  ❌ ${id.padEnd(35)} ERROR: ${err.message}`)
    results.push({ id, pass: false, error: err.message })
  }

  if (!results.at(-1).pass && failFast) { console.log(`\n  --fail-fast: stopping.`); break }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

const passed  = results.filter(r => r.pass).length
const failed  = results.filter(r => !r.pass).length
const drifted = results.filter(r => r.drift).length

console.log(`\n${'─'.repeat(60)}`)

if (updateMode) {
  console.log(`✅ Update complete. ${results.filter(r => r.updated).length} updated.\n   Audit: regrets/audit.log`)
  process.exit(0)
}
if (driftMode && drifted > 0) {
  console.log(`❌ Drift in ${drifted} cluster(s). Add normalize rules and re-capture.`)
  process.exit(1)
}
if (failed === 0) {
  console.log(`✅ All ${passed} tests passed${driftMode ? ` (${runs} runs — stable)` : ''}. Refactor is safe.\n`)
  process.exit(0)
}
console.log(`❌ ${failed}/${results.length} FAILED.\n`)
results.filter(r => !r.pass).forEach(r => {
  console.log(`  • ${r.id}`)
  if (r.error) console.log(`    ${r.error}`)
  else console.log(`    Expected: ${r.golden}  Got: ${r.live}`)
})
console.log(`\nFix the CODE — do not edit .regret files.\nRe-run: node scripts/validate.js`)
process.exit(1)
