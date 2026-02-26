// ─── Last updated: Feb 2026 ───────────────────────────────────────────────────
// All figures align with NSP 2025-26 guidelines & Union Budget 2026 allocations.

export const SCHEMES = [
  { id:'SCH-001', name:'NSP Central Merit Scholarship 2025-26',          cat:'Merit',     budget:142, benef:82000,  amount:12000,  filled:71, status:'active', deadline:'2026-03-31', ministry:'Ministry of Education',               criteria:'Class 11/12 students, top 1% in respective state board, family income ≤ ₹6 lakh/yr' },
  { id:'SCH-002', name:'PM Scholarship for CAPF & AR (Girls)',           cat:'Merit',     budget:28,  benef:5500,   amount:36000,  filled:84, status:'active', deadline:'2026-04-15', ministry:'Ministry of Home Affairs',             criteria:'Wards of ex/serving CAPF/AR personnel, pursuing 1st-yr UG/Diploma, min. 60% in Class 12' },
  { id:'SCH-003', name:'Post Matric Scholarship for SC Students',        cat:'Need-Based',budget:195, benef:125000, amount:23000,  filled:58, status:'active', deadline:'2026-05-31', ministry:'Ministry of Social Justice & Empowerment', criteria:'SC students in post-matric courses, annual family income ≤ ₹2.5 lakh' },
  { id:'SCH-004', name:'AICTE Pragati Scholarship (Technical Girls)',    cat:'Merit',     budget:34,  benef:4000,   amount:50000,  filled:91, status:'active', deadline:'2026-03-31', ministry:'AICTE / Ministry of Education',        criteria:'1st-year girl students in AICTE-approved B.E./B.Tech programs, family income ≤ ₹8 lakh' },
  { id:'SCH-005', name:'INSPIRE Scholarship for Higher Education',       cat:'Merit',     budget:55,  benef:10000,  amount:80000,  filled:47, status:'active', deadline:'2026-06-30', ministry:'Dept. of Science & Technology',        criteria:'Top 1% in Class 12 board exams, pursuing BSc/BS/MS in Natural & Basic Sciences' },
  { id:'SCH-006', name:'Begum Hazrat Mahal Scholarship (Minority Girls)',cat:'Minority',  budget:18,  benef:30000,  amount:11000,  filled:62, status:'active', deadline:'2026-04-30', ministry:'Maulana Azad Education Foundation',    criteria:'Muslim/Christian/Sikh/Buddhist/Jain girl students in Class 9–12, income ≤ ₹2 lakh' },
  { id:'SCH-007', name:'Post Matric OBC Scholarship',                    cat:'Need-Based',budget:88,  benef:72000,  amount:15000,  filled:67, status:'active', deadline:'2026-05-20', ministry:'Ministry of Social Justice & Empowerment', criteria:'OBC students in post-matric courses, non-creamy layer, state board verified' },
  { id:'SCH-008', name:'National Fellowship for SC — JRF Category',      cat:'Research',  budget:41,  benef:2000,   amount:37200,  filled:29, status:'draft',  deadline:'2026-09-01', ministry:'UGC / Ministry of Social Justice',     criteria:'SC students pursuing M.Phil/PhD, NET/JRF qualified, ₹31,000/month + HRA' },
]

export const APPLICATIONS = [
  { id:'APP-2026-000431', name:'Arjun R. Patel',       studentId:'STU-2026-0431', scheme:'NSP Central Merit Scholarship 2025-26',       amount:12000, status:'Approved',       date:'2026-01-18', inst:'IIT Bombay',         course:'B.Tech CSE', aiScore:91, officer:'OFF-001' },
  { id:'APP-2026-000478', name:'Divya S. Krishnamurthy',studentId:'STU-2026-0478', scheme:'AICTE Pragati Scholarship (Technical Girls)', amount:50000, status:'AI Verified',    date:'2026-02-03', inst:'BITS Pilani',         course:'B.E. ECE',   aiScore:88, officer:null },
  { id:'APP-2026-000502', name:'Mohammed Aslam Khan',  studentId:'STU-2026-0502', scheme:'Post Matric Scholarship for SC Students',    amount:23000, status:'Approved',       date:'2026-01-27', inst:'Delhi University',    course:'B.Sc Physics',aiScore:76, officer:'OFF-002' },
  { id:'APP-2026-000519', name:'Sneha B. Deshmukh',    studentId:'STU-2026-0519', scheme:'AICTE Pragati Scholarship (Technical Girls)', amount:50000, status:'Pending Review', date:'2026-02-11', inst:'COEP Pune',           course:'B.Tech Mech',aiScore:82, officer:null },
  { id:'APP-2026-000536', name:'Rajath G. Nair',       studentId:'STU-2026-0536', scheme:'INSPIRE Scholarship for Higher Education',   amount:80000, status:'Rejected',       date:'2026-01-31', inst:'IISc Bangalore',      course:'BSc Physics', aiScore:61, officer:'OFF-001' },
  { id:'APP-2026-000554', name:'Priya V. Subramaniam', studentId:'STU-2026-0554', scheme:'NSP Central Merit Scholarship 2025-26',       amount:12000, status:'AI Verified',    date:'2026-02-14', inst:'NIT Trichy',          course:'B.E. Chem', aiScore:87, officer:null },
  { id:'APP-2026-000571', name:'Lakshmi Bai Yadav',    studentId:'STU-2026-0571', scheme:'Post Matric OBC Scholarship',                amount:15000, status:'Approved',       date:'2026-02-06', inst:'Osmania University',  course:'BA Economics', aiScore:79, officer:'OFF-002' },
  { id:'APP-2026-000589', name:'Karthik Sundaram',     studentId:'STU-2026-0589', scheme:'PM Scholarship for CAPF & AR (Girls)',       amount:36000, status:'Pending Review', date:'2026-02-17', inst:'Pondicherry Univ',    course:'BCA',         aiScore:84, officer:null },
  { id:'APP-2026-000612', name:'Namita R. Joshi',      studentId:'STU-2026-0612', scheme:'NSP Central Merit Scholarship 2025-26',       amount:12000, status:'Approved',       date:'2026-02-09', inst:'Mumbai University',   course:'B.Com Hons', aiScore:90, officer:'OFF-001' },
  { id:'APP-2026-000628', name:'Venkatesan Pillai',    studentId:'STU-2026-0628', scheme:'Post Matric Scholarship for SC Students',    amount:23000, status:'Pending Review', date:'2026-02-18', inst:'Anna University',     course:'B.E. Civil', aiScore:73, officer:null },
]

export const AI_FLAGS = [
  { id:'FLAG-2026-0041', type:'critical', student:'Vikram J. Shinde',   studentId:'STU-2026-0912', scheme:'NSP Central Merit Scholarship',           reason:'Duplicate Aadhaar Identity',          detail:'Aadhaar hash XXXX-4821 already registered under STU-2026-0614 (Vikram Shinde, Nashik). Vector similarity score 98.4%. Likely the same person re-registering with a different enrollment number.', time:'1 hr 22 min ago' },
  { id:'FLAG-2026-0042', type:'critical', student:'Rashida P. Qureshi', studentId:'STU-2026-1083', scheme:'Post Matric Scholarship for SC Students', reason:'Income Certificate Tampering',          detail:'OCR model detected inconsistent pixel density around the income figure on Form-16A. Estimated forgery probability 93.1%. Original figure appears to have been digitally edited from ₹4,82,000 to ₹1,82,000 to meet the eligibility ceiling.', time:'2 hr 47 min ago' },
  { id:'FLAG-2026-0043', type:'critical', student:'Suresh K. Nambiar',  studentId:'STU-2026-0774', scheme:'INSPIRE Scholarship',                     reason:'Bank Account PAN Mismatch',           detail:'Provided bank account (SBI IFSC SBIN0009234, AC-XXXX7832) is registered under PAN BFKPN7821H belonging to one Mr. Suresh K. Mohan — a different individual. DOB and address do not match applicant record. Likely using father\'s account without disclosure.', time:'4 hr 11 min ago' },
  { id:'FLAG-2026-0044', type:'warning',  student:'Preethi R. Soni',    studentId:'STU-2026-0855', scheme:'AICTE Pragati Scholarship',              reason:'Institution Accreditation Lapsed',    detail:'AICTE approval for M/s Shri Ganesh Polytechnic, Jaipur (AICTE ID: 1-4521088791) expired on 31-Oct-2025 and has not been renewed. Disbursement to students of this institution is on hold pending re-accreditation confirmation.', time:'6 hr 05 min ago' },
  { id:'FLAG-2026-0045', type:'warning',  student:'Dinesh S. Ramachandran',studentId:'STU-2026-1102',scheme:'Post Matric OBC Scholarship',             reason:'Duplicate Application (Cross-State)',  detail:'Applicant has simultaneously filed under Maharashtra NSP portal (App# MH-2026-081243) and Karnataka NSP portal (App# KA-2026-034891) for the same scheme year. Cross-state duplicate detection triggered at vector distance 0.07.', time:'9 hr 30 min ago' },
  { id:'FLAG-2026-0046', type:'warning',  student:'Anjali M. Tiwari',    studentId:'STU-2026-0641', scheme:'NSP Central Merit Scholarship',           reason:'Marks Sheet Metadata Anomaly',        detail:'PDF metadata of uploaded Class-12 marksheet (Maharashta HSC 2024) shows document created date of 14-Jan-2026, which post-dates the result declaration of May 2024 by 20 months. File was likely regenerated from a template.', time:'1 day ago' },
  { id:'FLAG-2026-0047', type:'warning',  student:'Faizul H. Ansari',    studentId:'STU-2026-0499', scheme:'Begum Hazrat Mahal Scholarship',          reason:'Community Certificate Mismatch',      detail:'Applicant self-declared as Muslim in application. Caste certificate uploaded is an OBC certificate issued by Bihar state government and does not confirm Muslim community. Income threshold and community eligibility both unverifiable.', time:'1 day ago' },
]

// Algorand TestNet transaction IDs (base32, 52 chars)
export const TX_DATA = [
  { hash:'V7KQMN3P…W4ETPB5S', fullHash:'V7KQMN3PXRWSTF4DHJBL8CGAZE2YNI6OULM5Q3PXRWSTF4DHJBL', scheme:'NSP Central Merit Scholarship',          amount:'₹9,84,00,000', tokens:8200,  status:'Completed',  block:31204819, time:'Feb 18, 2026 09:14 IST' },
  { hash:'CKAOTMTK…B5SRAXQ2', fullHash:'CKAOTMTKZL47GJTHVKW4CJNPKX5IN4BQKQMF3QFP6W4ETPB5SRAXQ2', scheme:'AICTE Pragati Scholarship',             amount:'₹2,00,00,000', tokens:400,   status:'Completed',  block:31198432, time:'Feb 17, 2026 14:38 IST' },
  { hash:'EUFQHZLZ…UIUVFQRA', fullHash:'EUFQHZLZ3LF3DZXHGIQF3PBTF4CFSATBPNKBKTCN7WQMWUIUVFQRA', scheme:'Post Matric SC Scholarship',           amount:'₹2,87,50,000', tokens:12500, status:'Processing', block:31211644, time:'Feb 19, 2026 11:02 IST' },
  { hash:'MX5QJJT4…WBPUQP6L', fullHash:'MX5QJJT4CJKRJ4KF3WBPUQP6LY5G3ZUPXJT4CJKRJ4KF3WBPUQP6L', scheme:'INSPIRE Scholarship',                  amount:'₹80,00,000',   tokens:100,   status:'Completed',  block:31185277, time:'Feb 15, 2026 17:55 IST' },
  { hash:'RKZPA3B7…YTFNWM9D', fullHash:'RKZPA3B7NLQV2XHSF8DWOEI4GMTCJ6PURKZPA3B7NLQVYTFNWM9D', scheme:'PM Scholarship for CAPF & AR',          amount:'₹1,98,00,000', tokens:5500,  status:'Completed',  block:31178903, time:'Feb 14, 2026 08:21 IST' },
  { hash:'TBFNZ6QW…XRHDCM2A', fullHash:'TBFNZ6QWKPYVMS9D3IHLXOA7UEB2NFRJTBFNZ6QWKPYVXRHDCM2A', scheme:'Post Matric OBC Scholarship',          amount:'₹10,80,00,000',tokens:72000, status:'Pending',    block:null,     time:'Awaiting mint confirmation' },
]

export const MY_TOKENS = [
  { id:'TOK-2026-000478-A', scheme:'AICTE Pragati Scholarship (Technical Girls)', amount:50000, status:'redeemable', issued:'2026-02-08', expires:'2026-12-31', txHash:'CKAOTMTKZL47GJTHVKW4CJNPKX5IN4BQKQMF3QFP6W4ETPB5SRAXQ2', assetId:78812341 },
  { id:'TOK-2026-000554-A', scheme:'NSP Central Merit Scholarship 2025-26',      amount:12000, status:'redeemable', issued:'2026-02-17', expires:'2026-12-31', txHash:'V7KQMN3PXRWSTF4DHJBL8CGAZE2YNI6OULM5Q3PXRWSTF4DHJBL', assetId:78819072 },
  { id:'TOK-2026-000631-A', scheme:'INSPIRE Scholarship for Higher Education',   amount:80000, status:'pending',    issued:'Awaiting officer approval', expires:'—', txHash:null, assetId:null },
]

export const MY_APPLICATIONS = [
  { id:'APP-2026-000478', scheme:'AICTE Pragati Scholarship (Technical Girls)', date:'2026-02-03', amount:50000, status:'Approved',       aiScore:88, remarks:'Documents verified. Eligible.' },
  { id:'APP-2026-000554', scheme:'NSP Central Merit Scholarship 2025-26',      date:'2026-02-14', amount:12000, status:'AI Verified',    aiScore:87, remarks:'Awaiting officer review' },
  { id:'APP-2026-000631', scheme:'INSPIRE Scholarship for Higher Education',   date:'2026-02-19', amount:80000, status:'Pending Review', aiScore:91, remarks:'Submitted — in queue' },
  { id:'APP-2026-000392', scheme:'Post Matric OBC Scholarship',                date:'2026-01-08', amount:15000, status:'Rejected',       aiScore:58, remarks:'Income certificate not verifiable' },
]

export const MINTED_HISTORY = [
  { scheme:'NSP Central Merit',    tokens:8200,  amount:'₹9.84 Cr', time:'Feb 18 ・ 09:14 IST', txHash:'V7KQMN3P…W4ETPB5S', block:31204819 },
  { scheme:'Post Matric SC',       tokens:12500, amount:'₹2.88 Cr', time:'Feb 19 ・ 11:02 IST', txHash:'EUFQHZLZ…UIUVFQRA', block:31211644 },
  { scheme:'AICTE Pragati',        tokens:400,   amount:'₹2.00 Cr', time:'Feb 17 ・ 14:38 IST', txHash:'CKAOTMTK…B5SRAXQ2', block:31198432 },
  { scheme:'PM Scholarship CAPF',  tokens:5500,  amount:'₹1.98 Cr', time:'Feb 14 ・ 08:21 IST', txHash:'RKZPA3B7…YTFNWM9D', block:31178903 },
  { scheme:'INSPIRE SHE',          tokens:100,   amount:'₹0.80 Cr', time:'Feb 15 ・ 17:55 IST', txHash:'EUFQHZLZ…IQFRAVFQ', block:31185277 },
]

export const REPORTS_DATA = [
  { icon:'📊', title:'Monthly Tokenisation Report — Jan 2026',       desc:'Token-wise distribution of 28,400 scholarship tokens across 7 NSP schemes. Includes mint-to-distribution latency, redemption rate (61.4%), and 3 revoked tokens.', meta:'Generated: Feb 01, 2026 · 2.8 MB PDF · SHA256: a3f2c9…' },
  { icon:'🔍', title:'AI Fraud Audit Report — Q4 2025',              desc:'47 fraud flags raised, 39 resolved, 8 escalated to state scholarship cells. Duplicate identity: 12 cases, document forgery: 11 cases, income mismatch: 18 cases, other: 6.', meta:'Generated: Jan 08, 2026 · 2.1 MB PDF · On-chain anchored: TXID V7KQ…' },
  { icon:'🏛️', title:'Scheme Performance Dashboard — Feb 2026',     desc:'Active scheme fill rates, underspend alerts (INSPIRE at 47%), beneficiary-to-budget ratio analysis, and ministry-wise utilisation breakdown vs. Union Budget 2026 allocation.', meta:'Generated: Feb 15, 2026 · 3.4 MB PDF · IPFS: QmYw9F…' },
  { icon:'💰', title:'Treasury-to-Chain Disbursement Audit — FY26Q3',desc:'42 atomic batch disbursements totalling ₹41.29 Cr verified via Algorand TestNet block confirmations. Zero double-spend incidents. Full IFMS reconciliation report attached.', meta:'Generated: Feb 10, 2026 · 1.6 MB PDF · Auditor: CAG Empanelled Firm' },
  { icon:'🎓', title:'AI Verification Summary — Jan–Feb 2026',      desc:'3,841 applications processed. Passed: 2,614 (68.1%). Failed: 892 (23.2%). Manual review: 335 (8.7%). Avg. processing time: 4.2 sec. Top failure reason: income certificate anomaly.', meta:'Generated: Feb 18, 2026 · 1.1 MB PDF · Model: ExpressAI v2.3' },
  { icon:'🌉', title:'Bulk Bridge Distribution Log — Batch 0019',   desc:'BATCH-2026-0019: 5,000 tokens distributed to 5,000 verified students under NSP Central Merit. 4,988 accepted, 12 wallets inactive (tokens held in escrow for 30 days).', meta:'Generated: Feb 19, 2026 · 780 KB PDF · TXID RKZPA3B7…YTF' },
]

export const BRIDGE_BATCH = {
  batchId:     'BATCH-2026-0019',
  scheme:      'NSP Central Merit Scholarship 2025-26',
  ministry:    'Ministry of Education',
  total:       5000,
  amountEach:  12000,
  amount:      '₹6,00,00,000',
  contractAddr:'ALGO_NSP_MERIT_2526_CONTRACT',
  txHash:      'V7KQMN3PXRWSTF4DHJBL8CGAZE2YNI6OULM5Q3PXRWSTF4DHJBL',
  block:       31204819,
  lock_until:  '2026-12-31',
  minted_at:   'Feb 18, 2026 09:14 IST',
}

export const BRIDGE_RECIPIENTS = [
  { id:'STU-2026-0431', name:'Arjun R. Patel',           amount:12000, status:'verified', inst:'IIT Bombay',       wallet:'ALGO_TEST_0431' },
  { id:'STU-2026-0554', name:'Priya V. Subramaniam',     amount:12000, status:'verified', inst:'NIT Trichy',       wallet:'ALGO_TEST_0554' },
  { id:'STU-2026-0612', name:'Namita R. Joshi',          amount:12000, status:'verified', inst:'Mumbai University', wallet:'ALGO_TEST_0612' },
  { id:'STU-2026-0689', name:'Harshvardhan S. Mehta',    amount:12000, status:'verified', inst:'IIT Delhi',        wallet:'ALGO_TEST_0689' },
  { id:'STU-2026-0712', name:'Anupriya Chandrasekaran',  amount:12000, status:'pending',  inst:'JNTU Hyderabad',   wallet:'Not connected' },
  { id:'STU-2026-0748', name:'Rohit P. Sharma',          amount:12000, status:'pending',  inst:'Jadavpur Univ.',   wallet:'Not connected' },
]
