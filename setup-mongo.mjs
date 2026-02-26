/**
 * ExpressScheme — MongoDB Setup & Seed Script
 * Usage: node setup-mongo.mjs
 * Mirrors the same demo data as Supabase (users, schemes, applications,
 * transactions, tokens, notifications, fraud_flags, audit_logs, scheme_stats).
 */

import { MongoClient } from 'mongodb'

const MONGO_URI = 'mongodb+srv://mytholover85_db_user:DsJP1dAddduUiCx8@cluster0.eqmtdhi.mongodb.net/?appName=Cluster0'
const DB_NAME   = 'excessscheme'
const SEP       = '─'.repeat(54)

const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  tls: true,
  tlsAllowInvalidCertificates: true,
})

async function main() {
  console.log('')
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  ExpressScheme — MongoDB Setup & Seed                ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`  Cluster : cluster0.eqmtdhi.mongodb.net`)
  console.log(`  Database: ${DB_NAME}`)
  console.log('')

  // ── Connect ───────────────────────────────────────────────
  process.stdout.write('  Connecting to MongoDB Atlas ... ')
  await client.connect()
  const db = client.db(DB_NAME)
  console.log('OK ✓')
  console.log('')

  // ── Create collections + indexes ──────────────────────────
  console.log(`  ${SEP}`)
  console.log('  STEP 1 — Create collections & indexes')
  console.log(`  ${SEP}`)
  await createCollections(db)
  console.log('')

  // ── Seed demo data ────────────────────────────────────────
  console.log(`  ${SEP}`)
  console.log('  STEP 2 — Seed demo data')
  console.log(`  ${SEP}`)
  await seed(db)
  console.log('')

  // ── Verify ────────────────────────────────────────────────
  console.log(`  ${SEP}`)
  console.log('  STEP 3 — Verify record counts')
  console.log(`  ${SEP}`)
  const colls = [
    'users','schemes','applications','transactions','tokens',
    'notifications','fraud_flags','audit_logs','scheme_stats',
  ]
  for (const c of colls) {
    const n = await db.collection(c).countDocuments()
    console.log(`  ${c.padEnd(18)} → ${n} documents`)
  }

  console.log('')
  console.log('  ✓ MongoDB setup complete!')
  console.log('')
  await client.close()
}

// ─────────────────────────────────────────────
// COLLECTION DEFINITIONS + INDEXES
// ─────────────────────────────────────────────
async function createCollections(db) {
  const cols = db.listCollections().toArray ? await db.listCollections().toArray() : []
  const existing = new Set(cols.map(c => c.name))

  const defs = [
    { name: 'users',            indexes: [
        { key: { email: 1 },       options: { unique: true } },
        { key: { role: 1 } },
        { key: { walletAddress: 1 }, options: { sparse: true } },
        { key: { aadhaarHash: 1 },   options: { sparse: true } },
      ]},
    { name: 'schemes',          indexes: [
        { key: { status: 1 } },
        { key: { category: 1 } },
      ]},
    { name: 'applications',     indexes: [
        { key: { studentId: 1 } },
        { key: { schemeId: 1 } },
        { key: { status: 1 } },
        { key: { applicationNumber: 1 }, options: { unique: true, sparse: true } },
        { key: { schemeId: 1, studentId: 1 }, options: { unique: true } },
      ]},
    { name: 'transactions',     indexes: [
        { key: { txHash: 1 },      options: { unique: true, sparse: true } },
        { key: { tokenId: 1 } },
        { key: { fromUserId: 1 } },
        { key: { toUserId: 1 } },
        { key: { schemeId: 1 } },
      ]},
    { name: 'tokens',           indexes: [
        { key: { studentId: 1 } },
        { key: { schemeId: 1 } },
        { key: { status: 1 } },
        { key: { algoTxHash: 1 }, options: { sparse: true } },
      ]},
    { name: 'notifications',    indexes: [
        { key: { userId: 1 } },
        { key: { isRead: 1 } },
      ]},
    { name: 'fraud_flags',      indexes: [
        { key: { userId: 1 } },
        { key: { isResolved: 1 } },
        { key: { severity: 1 } },
      ]},
    { name: 'audit_logs',       indexes: [
        { key: { entityType: 1, entityId: 1 } },
        { key: { actorId: 1 } },
        { key: { createdAt: -1 } },
      ]},
    { name: 'scheme_stats',     indexes: [
        { key: { schemeId: 1 }, options: { unique: true } },
      ]},
    { name: 'ai_verifications', indexes: [
        { key: { applicationId: 1 }, options: { unique: true } },
        { key: { studentId: 1 } },
      ]},
    { name: 'documents',        indexes: [
        { key: { applicationId: 1 } },
        { key: { userId: 1 } },
      ]},
  ]

  for (const def of defs) {
    if (!existing.includes(def.name)) {
      await db.createCollection(def.name)
    }
    for (const idx of def.indexes) {
      try {
        await db.collection(def.name).createIndex(idx.key, idx.options || {})
      } catch (_) { /* index may already exist */ }
    }
    process.stdout.write(`.`)
  }
  console.log(' done ✓')
}

// ─────────────────────────────────────────────
// SEED DEMO DATA
// ─────────────────────────────────────────────
async function seed(db) {
  const now = new Date()

  // Helper: upsert by a unique field
  const upsert = async (col, filter, doc) => {
    await db.collection(col).updateOne(
      filter,
      { $setOnInsert: { ...doc, createdAt: now, updatedAt: now } },
      { upsert: true }
    )
  }

  /* ── 1. USERS ─────────────────────────────────────────── */
  process.stdout.write('  users          ... ')
  const users = [
    { _id: 'u-gov-001',  role:'gov_officer', fullName:'Rajiv Sharma',      email:'rajiv.sharma@gov.in',       phone:'9876543210', officerId:'OFF-2026-001', department:'Ministry of Education', isActive:true, isAiVerified:false, aiTrustScore:0 },
    { _id: 'u-gov-002',  role:'gov_officer', fullName:'Priya Mehta',        email:'priya.mehta@gov.in',        phone:'9876543211', officerId:'OFF-2026-002', department:'Ministry of Social Justice', isActive:true, isAiVerified:false, aiTrustScore:0 },
    { _id: 'u-stu-001',  role:'student',     fullName:'Arjun Patel',        email:'arjun.patel@gmail.com',     phone:'8765432109', institutionName:'IIT Bombay',   course:'B.Tech CSE', academicYear:'3rd', gpa:8.7, aadhaarLast4:'4521', panDisplay:'ABCDE1234F', bankName:'SBI', bankIfsc:'SBIN0001234', bankAccountLast4:'6789', isAiVerified:true,  aiTrustScore:89.5, walletAddress:'ALGO_TEST_001' },
    { _id: 'u-stu-002',  role:'student',     fullName:'Priya Singh',        email:'priya.singh@outlook.com',   phone:'8765432108', institutionName:'Delhi University', course:'B.Sc Physics', academicYear:'2nd', gpa:7.9, aadhaarLast4:'7823', panDisplay:'FGHIJ5678K', bankName:'HDFC', bankIfsc:'HDFC0002345', bankAccountLast4:'4321', isAiVerified:true,  aiTrustScore:78.2, walletAddress:'ALGO_TEST_002' },
    { _id: 'u-stu-003',  role:'student',     fullName:'Ravi Kumar',         email:'ravi.kumar@yahoo.com',      phone:'8765432107', institutionName:'BITS Pilani',   course:'M.Tech VLSI', academicYear:'1st', gpa:9.1, aadhaarLast4:'3344', panDisplay:'KLMNO9012L', bankName:'Axis', bankIfsc:'UTIB0003456', bankAccountLast4:'8877', isAiVerified:false, aiTrustScore:41.0, walletAddress:'ALGO_TEST_003' },
    { _id: 'u-stu-004',  role:'student',     fullName:'Sunita Verma',       email:'sunita.verma@gmail.com',    phone:'8765432106', institutionName:'Jadavpur Univ', course:'B.E. Mech', academicYear:'4th', gpa:7.2, aadhaarLast4:'9988', panDisplay:'PQRST3456M', bankName:'PNB', bankIfsc:'PUNB0004567', bankAccountLast4:'1122', isAiVerified:true,  aiTrustScore:72.4 },
    { _id: 'u-stu-005',  role:'student',     fullName:'Mohit Bansal',       email:'mohit.bansal@rediffmail.in',phone:'8765432105', institutionName:'Pune Univ',     course:'BCA', academicYear:'2nd', gpa:6.5, aadhaarLast4:'2233', panDisplay:'UVWXY7890N', bankName:'Canara', bankIfsc:'CNRB0005678', bankAccountLast4:'3344', isAiVerified:false, aiTrustScore:55.0 },
    { _id: 'u-stu-006',  role:'student',     fullName:'Ananya Krishnamurthy',email:'ananya.k@gmail.com',       phone:'8765432104', institutionName:'NIT Trichy',    course:'B.Tech ECE', academicYear:'3rd', gpa:8.3, aadhaarLast4:'5566', panDisplay:'ZABCD1357O', bankName:'ICICI', bankIfsc:'ICIC0006789', bankAccountLast4:'7788', isAiVerified:true,  aiTrustScore:84.1 },
  ]
  for (const u of users) await upsert('users', { _id: u._id }, u)
  console.log(`OK ✓  (${users.length} users)`)

  /* ── 2. SCHEMES ───────────────────────────────────────── */
  process.stdout.write('  schemes        ... ')
  const schemes = [
    {
      _id: 'sch-001',
      name: 'PM National Merit Scholarship 2026',
      description: 'Central government merit-based scholarship for undergraduate students with CGPA ≥ 8.0.',
      category: 'merit', ministry: 'Ministry of Education', state: 'central',
      minGpa: 8.0, maxAnnualIncome: 600000, eligibleCategories: ['General','OBC','SC','ST'],
      budgetTotal: 50000000, budgetRemaining: 32000000, amountPerStudent: 50000, maxBeneficiaries: 1000,
      startDate: '2026-01-01', endDate: '2026-12-31', applicationDeadline: '2026-04-30',
      status: 'active', tokenContractAddress: 'PM_MERIT_2026_CONTRACT',
      tokensMinted: 48, tokensDistributed: 36, ipfsHash: 'QmPM2026SchemeDoc',
      createdBy: 'u-gov-001',
    },
    {
      _id: 'sch-002',
      name: 'SC/ST Higher Education Support 2026',
      description: 'Need-based financial support for SC/ST students pursuing higher education.',
      category: 'sc-st', ministry: 'Ministry of Social Justice', state: 'central',
      minGpa: 6.0, maxAnnualIncome: 250000, eligibleCategories: ['SC','ST'],
      budgetTotal: 80000000, budgetRemaining: 51000000, amountPerStudent: 35000, maxBeneficiaries: 2500,
      startDate: '2026-01-01', endDate: '2026-12-31', applicationDeadline: '2026-05-31',
      status: 'active', tokenContractAddress: 'SCST_HE_2026_CONTRACT',
      tokensMinted: 120, tokensDistributed: 89, ipfsHash: 'QmSCST2026SchemeDoc',
      createdBy: 'u-gov-002',
    },
    {
      _id: 'sch-003',
      name: 'Women in STEM Empowerment Grant',
      description: 'Special grant for female students in STEM disciplines to bridge gender gap.',
      category: 'gender', ministry: 'Ministry of Women & Child Development', state: 'central',
      minGpa: 7.5, maxAnnualIncome: 800000, eligibleCategories: ['General','OBC','SC','ST'],
      eligibleGenders: ['female'],
      budgetTotal: 30000000, budgetRemaining: 18500000, amountPerStudent: 40000, maxBeneficiaries: 750,
      startDate: '2026-02-01', endDate: '2026-11-30', applicationDeadline: '2026-06-30',
      status: 'active', tokenContractAddress: 'WSTEM_2026_CONTRACT',
      tokensMinted: 60, tokensDistributed: 45, ipfsHash: 'QmWomenSTEM2026Doc',
      createdBy: 'u-gov-001',
    },
  ]
  for (const s of schemes) await upsert('schemes', { _id: s._id }, s)
  console.log(`OK ✓  (${schemes.length} schemes)`)

  /* ── 3. APPLICATIONS ──────────────────────────────────── */
  process.stdout.write('  applications   ... ')
  const apps = [
    { _id:'app-001', schemeId:'sch-001', studentId:'u-stu-001', applicationNumber:'APP-2026-000001', status:'distributed', declaredIncome:480000, declaredGpa:8.7, declaredCourse:'B.Tech CSE', declaredInstitution:'IIT Bombay',    aiTrustScore:89.5, officerId:'u-gov-001', officerRemarks:'Excellent profile', reviewedAt:'2026-01-20T10:00:00Z', submittedAt:'2026-01-15T09:30:00Z' },
    { _id:'app-002', schemeId:'sch-002', studentId:'u-stu-002', applicationNumber:'APP-2026-000002', status:'approved',     declaredIncome:210000, declaredGpa:7.9, declaredCourse:'B.Sc Physics', declaredInstitution:'Delhi University', aiTrustScore:78.2, officerId:'u-gov-002', officerRemarks:'Documents verified',   reviewedAt:'2026-01-22T11:00:00Z', submittedAt:'2026-01-18T14:00:00Z' },
    { _id:'app-003', schemeId:'sch-001', studentId:'u-stu-003', applicationNumber:'APP-2026-000003', status:'ai_failed',    declaredIncome:550000, declaredGpa:9.1, declaredCourse:'M.Tech VLSI', declaredInstitution:'BITS Pilani',   aiTrustScore:41.0, submittedAt:'2026-01-20T16:00:00Z' },
    { _id:'app-004', schemeId:'sch-003', studentId:'u-stu-004', applicationNumber:'APP-2026-000004', status:'officer_review', declaredIncome:380000, declaredGpa:7.2, declaredCourse:'B.E. Mech', declaredInstitution:'Jadavpur Univ', aiTrustScore:72.4, submittedAt:'2026-02-01T10:30:00Z' },
    { _id:'app-005', schemeId:'sch-002', studentId:'u-stu-006', applicationNumber:'APP-2026-000005', status:'token_minted', declaredIncome:195000, declaredGpa:8.3, declaredCourse:'B.Tech ECE', declaredInstitution:'NIT Trichy',    aiTrustScore:84.1, officerId:'u-gov-001', officerRemarks:'Strong SC candidate', reviewedAt:'2026-02-05T09:00:00Z', submittedAt:'2026-02-02T11:00:00Z' },
  ]
  for (const a of apps) await upsert('applications', { _id: a._id }, a)
  console.log(`OK ✓  (${apps.length} applications)`)

  /* ── 4. TOKENS ────────────────────────────────────────── */
  process.stdout.write('  tokens         ... ')
  const tokens = [
    { _id:'tok-001', studentId:'u-stu-001', schemeId:'sch-001', applicationId:'app-001', status:'redeemed',     amountInr:50000, algoTxHash:'ALGO_TX_MINT_001', assetId:12345001, mintedAt:'2026-01-21T08:00:00Z', distributedAt:'2026-01-25T08:00:00Z', redeemedAt:'2026-02-01T10:00:00Z' },
    { _id:'tok-002', studentId:'u-stu-002', schemeId:'sch-002', applicationId:'app-002', status:'distributed',  amountInr:35000, algoTxHash:'ALGO_TX_MINT_002', assetId:12345002, mintedAt:'2026-01-23T09:00:00Z', distributedAt:'2026-01-28T09:00:00Z' },
    { _id:'tok-003', studentId:'u-stu-006', schemeId:'sch-002', applicationId:'app-005', status:'minted',       amountInr:35000, algoTxHash:'ALGO_TX_MINT_003', assetId:12345003, mintedAt:'2026-02-06T07:00:00Z' },
  ]
  for (const t of tokens) await upsert('tokens', { _id: t._id }, t)
  console.log(`OK ✓  (${tokens.length} tokens)`)

  /* ── 5. TRANSACTIONS ──────────────────────────────────── */
  process.stdout.write('  transactions   ... ')
  const txns = [
    { _id:'tx-001', tokenId:'tok-001', schemeId:'sch-001', fromUserId:'u-gov-001', toUserId:'u-stu-001', fromWallet:'GOV_TREASURY_WALLET', toWallet:'ALGO_TEST_001', txType:'distribute',  amountInr:50000, txHash:'ALGO_TX_001_HASH', blockHeight:28100001, blockTimestamp:'2026-01-25T08:00:00Z', txStatus:'confirmed', networkFeeAlgo:0.001 },
    { _id:'tx-002', tokenId:'tok-001', schemeId:'sch-001', fromUserId:'u-stu-001', toUserId:null,        fromWallet:'ALGO_TEST_001',      toWallet:'BANK_NPCI_001',  txType:'redeem',      amountInr:50000, txHash:'ALGO_TX_002_HASH', blockHeight:28200001, blockTimestamp:'2026-02-01T10:00:00Z', txStatus:'confirmed', networkFeeAlgo:0.001 },
    { _id:'tx-003', tokenId:'tok-002', schemeId:'sch-002', fromUserId:'u-gov-002', toUserId:'u-stu-002', fromWallet:'GOV_TREASURY_WALLET', toWallet:'ALGO_TEST_002', txType:'distribute',  amountInr:35000, txHash:'ALGO_TX_003_HASH', blockHeight:28150001, blockTimestamp:'2026-01-28T09:00:00Z', txStatus:'confirmed', networkFeeAlgo:0.001 },
    { _id:'tx-004', tokenId:'tok-003', schemeId:'sch-002', fromUserId:'u-gov-001', toUserId:'u-stu-006', fromWallet:'GOV_TREASURY_WALLET', toWallet:'ALGO_TEST_006',  txType:'mint',       amountInr:35000, txHash:'ALGO_TX_004_HASH', blockHeight:28250001, blockTimestamp:'2026-02-06T07:00:00Z', txStatus:'confirmed', networkFeeAlgo:0.001 },
  ]
  for (const t of txns) await upsert('transactions', { _id: t._id }, t)
  console.log(`OK ✓  (${txns.length} transactions)`)

  /* ── 6. NOTIFICATIONS ─────────────────────────────────── */
  process.stdout.write('  notifications  ... ')
  const notifs = [
    { _id:'notif-001', userId:'u-stu-001', type:'token_distributed', title:'Scholarship Token Distributed!', body:'Your ₹50,000 PM Merit scholarship token has been distributed to your wallet.',           isRead:true,  entityType:'token',       entityId:'tok-001' },
    { _id:'notif-002', userId:'u-stu-001', type:'application_status', title:'Application Approved',          body:'Congratulations! Your application APP-2026-000001 has been approved.',                  isRead:true,  entityType:'application', entityId:'app-001' },
    { _id:'notif-003', userId:'u-stu-002', type:'token_distributed', title:'Token Ready',                    body:'Your SC/ST scholarship of ₹35,000 has been transferred to your Algorand wallet.',       isRead:false, entityType:'token',       entityId:'tok-002' },
    { _id:'notif-004', userId:'u-stu-003', type:'ai_failed',          title:'AI Verification Failed',        body:'Your application could not pass AI verification. Trust score: 41/100. Please re-apply.', isRead:false, entityType:'application', entityId:'app-003' },
    { _id:'notif-005', userId:'u-gov-001', type:'fraud_alert',        title:'Fraud Alert — Review Required', body:'AI detected a potential duplicate application. Please review flag #fraud-001.',          isRead:false, entityType:'fraud_flag',  entityId:'fraud-001' },
  ]
  for (const n of notifs) await upsert('notifications', { _id: n._id }, n)
  console.log(`OK ✓  (${notifs.length} notifications)`)

  /* ── 7. FRAUD FLAGS ───────────────────────────────────── */
  process.stdout.write('  fraud_flags    ... ')
  const frauds = [
    { _id:'fraud-001', userId:'u-stu-003', applicationId:'app-003', flagType:'duplicate_application', severity:'high',   isResolved:false, detectedBy:'ai_engine',  notes:'Duplicate Aadhaar hash found across 2 applications' },
    { _id:'fraud-002', userId:'u-stu-005', applicationId:null,       flagType:'document_forgery',     severity:'medium', isResolved:true,  detectedBy:'ai_engine',  notes:'Income certificate OCR mismatch',  resolution:'false_positive', resolvedBy:'u-gov-001', resolvedAt:'2026-02-10T12:00:00Z' },
  ]
  for (const f of frauds) await upsert('fraud_flags', { _id: f._id }, f)
  console.log(`OK ✓  (${frauds.length} fraud flags)`)

  /* ── 8. AUDIT LOGS ────────────────────────────────────── */
  process.stdout.write('  audit_logs     ... ')
  const audits = [
    { _id:'audit-001', eventType:'application_created',   entityType:'application', entityId:'app-001', actorId:'u-stu-001', actorRole:'student',     action:'create_application',     newData:{ status:'submitted' },                              txHash:null },
    { _id:'audit-002', eventType:'ai_verification',       entityType:'application', entityId:'app-001', actorId:'system',    actorRole:'ai_engine',   action:'ai_verification_passed', newData:{ trustScore:89.5, status:'ai_passed' },              txHash:null },
    { _id:'audit-003', eventType:'application_approved',  entityType:'application', entityId:'app-001', actorId:'u-gov-001', actorRole:'gov_officer', action:'approve_application',    newData:{ status:'approved', officerRemarks:'Excellent' },     txHash:null },
    { _id:'audit-004', eventType:'token_minted',          entityType:'token',       entityId:'tok-001', actorId:'system',    actorRole:'blockchain',  action:'mint_token',             newData:{ txHash:'ALGO_TX_MINT_001', assetId:12345001 },        txHash:'ALGO_TX_MINT_001' },
    { _id:'audit-005', eventType:'token_distributed',     entityType:'token',       entityId:'tok-001', actorId:'u-gov-001', actorRole:'gov_officer', action:'distribute_token',       newData:{ txHash:'ALGO_TX_001_HASH', toWallet:'ALGO_TEST_001' }, txHash:'ALGO_TX_001_HASH' },
  ]
  for (const a of audits) await upsert('audit_logs', { _id: a._id }, a)
  console.log(`OK ✓  (${audits.length} audit logs)`)

  /* ── 9. SCHEME STATS ──────────────────────────────────── */
  process.stdout.write('  scheme_stats   ... ')
  const stats = [
    { schemeId:'sch-001', totalApplications:18, applicationsApproved:12, applicationsPending:3, applicationsFailed:3, tokensMinted:12, tokensDistributed:10, tokensRedeemed:8, totalDisbursedInr:500000 },
    { schemeId:'sch-002', totalApplications:31, applicationsApproved:24, applicationsPending:5, applicationsFailed:2, tokensMinted:24, tokensDistributed:20, tokensRedeemed:15, totalDisbursedInr:700000 },
    { schemeId:'sch-003', totalApplications:12, applicationsApproved:8,  applicationsPending:3, applicationsFailed:1, tokensMinted:8,  tokensDistributed:6,  tokensRedeemed:3,  totalDisbursedInr:240000 },
  ]
  for (const s of stats) await upsert('scheme_stats', { schemeId: s.schemeId }, s)
  console.log(`OK ✓  (${stats.length} scheme stats)`)
}

main().catch(err => {
  console.error('\n  ✗ Fatal error:', err.message)
  process.exit(1)
})
