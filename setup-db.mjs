/**
 * ExcessScheme — Supabase Database Setup & Verification Script
 * Usage: node setup-db.mjs
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL  = 'https://rjusxfiprkfnaitdgkmv.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqdXN4ZmlwcmtmbmFpdGRna212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjE2MjgsImV4cCI6MjA4NzA5NzYyOH0.lqLLvnGSVUbvqvACsclHE6QPynr8TzB7RuHnfloEP4Y'
const SUPABASE_PAT  = 'sbp_9ec8d918b4bc2bf37c81c8cc589c24c6aa07daed'
const PROJECT_REF   = 'rjusxfiprkfnaitdgkmv'
const MGMT_URL      = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
const mgmt = async (sql) => {
  const r = await fetch(MGMT_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  })
  const txt = await r.text()
  return { ok: r.ok, status: r.status, body: txt }
}

const SEP = '─'.repeat(54)

async function main() {
  console.log('')
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║    ExcessScheme — Supabase Setup & Verification      ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`  Project : ${SUPABASE_URL}`)
  console.log(`  Schema  : supabase/schema.sql`)
  console.log('')

  // ── STEP 1: Apply schema ──────────────────────────────────
  console.log(`  ${SEP}`)
  console.log('  STEP 1 — Apply schema.sql to Supabase')
  console.log(`  ${SEP}`)
  const sqlPath = join(__dirname, 'supabase', 'schema.sql')
  const sql = readFileSync(sqlPath, 'utf8')
  process.stdout.write('  Running schema.sql ... ')
  const res = await mgmt(sql)
  if (res.ok || res.body === '[]') {
    console.log('OK ✓  (schema applied / already up to date)')
  } else {
    const err = JSON.parse(res.body)
    if (err?.message?.includes('already exists')) {
      console.log('OK ✓  (tables already exist)')
    } else {
      console.log('WARN ⚠  ' + (err?.message || res.body).slice(0, 80))
    }
  }
  console.log('')

  // ── STEP 2: Verify tables ─────────────────────────────────
  console.log(`  ${SEP}`)
  console.log('  STEP 2 — Verify all 12 tables exist')
  console.log(`  ${SEP}`)
  const { body: tb } = await mgmt(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)
  const tables = JSON.parse(tb).map(r => r.tablename)
  const expected = ['ai_verifications','applications','audit_logs','bridge_batches',
                    'documents','fraud_flags','notifications','scheme_stats',
                    'schemes','tokens','transactions','users']
  let allFound = true
  for (const t of expected) {
    const found = tables.includes(t)
    if (!found) allFound = false
    console.log(`  ${found ? '✓' : '✗'} ${t}`)
  }
  console.log('')
  if (!allFound) { console.log('  ❌  Some tables missing.'); process.exit(1) }
  console.log('  All 12 tables present ✓')
  console.log('')

  // ── STEP 3: Live read/write test ──────────────────────────
  console.log(`  ${SEP}`)
  console.log('  STEP 3 — Live write/read test via @supabase/supabase-js')
  console.log(`  ${SEP}`)

  process.stdout.write('  INSERT users           ... ')
  const { data: user, error: e1 } = await supabase.from('users')
    .insert({ full_name:'Setup Test User', email:'setup-test@excessscheme.dev',
              phone:'9000000001', role:'student', aadhaar_last4:'0000',
              pan_display:'SETUP0000Z', state:'Delhi' })
    .select('id, full_name, email, role').single()
  if (e1) { console.log('FAIL ✗  ' + e1.message); process.exit(1) }
  console.log(`OK ✓  id=${user.id.slice(0,8)}…`)

  process.stdout.write('  INSERT schemes         ... ')
  const { data: scheme, error: e2 } = await supabase.from('schemes')
    .insert({ name:'Setup Test Scheme', category:'merit', ministry:'Test Ministry',
              amount_per_student:10000, budget_total:100000, status:'active' })
    .select('id, name').single()
  if (e2) { console.log('FAIL ✗  ' + e2.message); process.exit(1) }
  console.log(`OK ✓  id=${scheme.id.slice(0,8)}…`)

  process.stdout.write('  INSERT applications    ... ')
  const { data: app, error: e3 } = await supabase.from('applications')
    .insert({ scheme_id:scheme.id, student_id:user.id, status:'submitted', ai_trust_score:0 })
    .select('id, application_number').single()
  if (e3) { console.log('FAIL ✗  ' + e3.message); process.exit(1) }
  console.log(`OK ✓  ${app.application_number}`)

  process.stdout.write('  INSERT transactions    ... ')
  const { data: tx, error: e4 } = await supabase.from('transactions')
    .insert({ from_wallet:'0xSetupFrom', to_wallet:'0xSetupTo',
              from_user_id:user.id, to_user_id:user.id,
              amount_inr:10000, tx_type:'token_mint', scheme_id:scheme.id })
    .select('id, tx_hash, tx_type, tx_status').single()
  if (e4) { console.log('FAIL ✗  ' + e4.message); process.exit(1) }
  console.log(`OK ✓  tx_hash=${tx.tx_hash.slice(0,22)}…`)

  process.stdout.write('  INSERT notifications   ... ')
  const { data: notif, error: e5 } = await supabase.from('notifications')
    .insert({ user_id:user.id, type:'application_submitted',
              title:'Test Notification', body:`App ${app.application_number} verified.` })
    .select('id').single()
  if (e5) { console.log('FAIL ✗  ' + e5.message); process.exit(1) }
  console.log(`OK ✓  id=${notif.id.slice(0,8)}…`)

  process.stdout.write('  SELECT users (read)    ... ')
  const { data: rb, error: e6 } = await supabase.from('users')
    .select('id, full_name, email').eq('id', user.id).single()
  if (e6) { console.log('FAIL ✗  ' + e6.message); process.exit(1) }
  console.log(`OK ✓  name="${rb.full_name}"`)

  process.stdout.write('  SELECT row counts      ... ')
  const tnames = ['users','schemes','applications','transactions','tokens',
                  'documents','ai_verifications','notifications',
                  'fraud_flags','audit_logs','bridge_batches','scheme_stats']
  const counts = {}
  for (const t of tnames) {
    const { count } = await supabase.from(t).select('*', { count:'exact', head:true })
    counts[t] = count
  }
  console.log('OK ✓')
  console.log('')
  console.log('  ┌─────────────────────────┬────────┐')
  console.log('  │ Table                   │  Rows  │')
  console.log('  ├─────────────────────────┼────────┤')
  for (const [t, c] of Object.entries(counts)) {
    const bar = c > 0 ? ' ' + '█'.repeat(Math.min(c, 8)) : ''
    console.log(`  │ ${t.padEnd(23)}  │  ${String(c).padStart(3)}   │${bar}`)
  }
  console.log('  └─────────────────────────┴────────┘')
  console.log('')

  process.stdout.write('  DELETE test rows       ... ')
  await supabase.from('notifications').delete().eq('user_id', user.id)
  await supabase.from('transactions').delete().eq('from_user_id', user.id)
  await supabase.from('applications').delete().eq('student_id', user.id)
  await supabase.from('schemes').delete().eq('id', scheme.id)
  await supabase.from('users').delete().eq('id', user.id)
  console.log('OK ✓')
  console.log('')

  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  ✅  SETUP COMPLETE — Supabase connected & working   ║')
  console.log('║      12 tables live  |  read/write verified          ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('')
}

main().catch(e => { console.error('\nFatal:', e.message); process.exit(1) })
