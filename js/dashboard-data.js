/* ─────────────────────────────────────────────
   ExcessScheme — Shared Dashboard Data
───────────────────────────────────────────── */

const SCHEMES = [
  { id:'SCH-001', name:'PM National Scholarship 2026', cat:'Merit', budget:50, benef:5000, amount:50000, filled:78, status:'active', deadline:'2026-04-30', criteria:'10th/12th with >80% marks, Family income <₹6L' },
  { id:'SCH-002', name:'State Merit Award', cat:'Merit', budget:20, benef:2000, amount:25000, filled:60, status:'active', deadline:'2026-05-15', criteria:'Top 5% students in state board' },
  { id:'SCH-003', name:'SC/ST Higher Education Fund', cat:'Need-Based', budget:80, benef:8000, amount:40000, filled:45, status:'active', deadline:'2026-06-01', criteria:'SC/ST students enrolled in UG/PG programs' },
  { id:'SCH-004', name:'Girl Child STEM Scholarship', cat:'Merit', budget:30, benef:3000, amount:30000, filled:92, status:'active', deadline:'2026-03-31', criteria:'Girls pursuing STEM subjects, income <₹4L' },
  { id:'SCH-005', name:'Disability Support Grant', cat:'Disability', budget:15, benef:1500, amount:20000, filled:30, status:'active', deadline:'2026-07-01', criteria:'Students with certified disability (>40%)' },
  { id:'SCH-006', name:'Minority Education Aid', cat:'Minority', budget:25, benef:2500, amount:22000, filled:55, status:'draft', deadline:'2026-08-01', criteria:'Minority students, income <₹3L, academic merit' },
  { id:'SCH-007', name:'Post-Matric OBC Scholarship', cat:'Need-Based', budget:40, benef:4000, amount:15000, filled:70, status:'active', deadline:'2026-05-20', criteria:'OBC students in post-matric courses' },
  { id:'SCH-008', name:'National Rural Education Fund', cat:'Need-Based', budget:35, benef:7000, amount:12000, filled:20, status:'draft', deadline:'2026-09-01', criteria:'Rural students from families with <₹2L income' },
];

const APPLICATIONS = [
  { id:'APP-001', name:'Arjun Sharma',  studentId:'STU-2026-0011', scheme:'PM National Scholarship 2026', amount:50000, status:'AI Verified',    date:'2026-02-15' },
  { id:'APP-002', name:'Meena Patel',   studentId:'STU-2026-0023', scheme:'Girl Child STEM Scholarship',   amount:30000, status:'Pending Review', date:'2026-02-17' },
  { id:'APP-003', name:'Rahul Verma',   studentId:'STU-2026-0034', scheme:'SC/ST Higher Education Fund',   amount:40000, status:'Approved',       date:'2026-02-10' },
  { id:'APP-004', name:'Sunita Rao',    studentId:'STU-2026-0045', scheme:'State Merit Award',             amount:25000, status:'Rejected',       date:'2026-02-08' },
  { id:'APP-005', name:'Dev Kumar',     studentId:'STU-2026-0056', scheme:'Disability Support Grant',      amount:20000, status:'Pending Review', date:'2026-02-18' },
  { id:'APP-006', name:'Priya Kumari',  studentId:'STU-2026-0042', scheme:'PM National Scholarship 2026', amount:50000, status:'AI Verified',    date:'2026-02-16' },
  { id:'APP-007', name:'Ramesh Singh',  studentId:'STU-2026-0067', scheme:'Post-Matric OBC Scholarship',  amount:15000, status:'Approved',       date:'2026-02-12' },
  { id:'APP-008', name:'Kavya Nair',    studentId:'STU-2026-0078', scheme:'Girl Child STEM Scholarship',   amount:30000, status:'Pending Review', date:'2026-02-19' },
];

const AI_FLAGS = [
  { id:'FLAG-001', type:'critical', student:'Mohan Das', studentId:'STU-2026-0099', scheme:'PM National Scholarship', reason:'Duplicate Identity', detail:'Same Aadhaar number detected linked to two different student IDs. Possible identity cloning attempt. Flagged by duplicate-detection vector model.', time:'2 hours ago' },
  { id:'FLAG-002', type:'critical', student:'Anonymous', studentId:'STU-2026-0113', scheme:'SC/ST Fund', reason:'Forged Document', detail:'Document forgery detected. OCR analysis shows inconsistent font metadata on income certificate. Pixel-level analysis indicates tampering around income figure.', time:'3 hours ago' },
  { id:'FLAG-003', type:'critical', student:'Rekha Gupta', studentId:'STU-2026-0142', scheme:'Merit Award', reason:'Bank Account Mismatch', detail:'Bank account provided belongs to a different PAN holder. Name, DOB do not match student record. Likely using a third-party account.', time:'5 hours ago' },
  { id:'FLAG-004', type:'warning', student:'Suresh Babu', studentId:'STU-2026-0156', scheme:'Girl Child STEM', reason:'Gender Mismatch', detail:'Student gender listed as "Male" in institution records but scholarship is restricted to female students only.', time:'6 hours ago' },
  { id:'FLAG-005', type:'warning', student:'Laxmi Devi', studentId:'STU-2026-0177', scheme:'Post-Matric OBC', reason:'Income Certificate Anomaly', detail:'Stated income of ₹1.2L/year appears inconsistent with reported property ownership data from linked PAN records.', time:'8 hours ago' },
  { id:'FLAG-006', type:'warning', student:'Anil Tiwari', studentId:'STU-2026-0188', scheme:'Disability Grant', reason:'Disability Certificate Expired', detail:'Disability certificate submitted expired 18 months ago. Re-verification required before token disbursement.', time:'1 day ago' },
  { id:'FLAG-007', type:'warning', student:'Geeta Sharma', studentId:'STU-2026-0199', scheme:'SC/ST Fund', reason:'Multiple Applications', detail:'Same student has applied to 3 overlapping schemes simultaneously which exceeds the single-scheme limit.', time:'1 day ago' },
];

const TX_DATA = [
  { hash:'0xA3F2…C91B', scheme:'PM Scholarship', amount:'₹2,50,00,000', status:'Completed' },
  { hash:'0xB7D1…E44A', scheme:'Girl Child STEM', amount:'₹90,00,000', status:'Pending' },
  { hash:'0xC5E9…1F23', scheme:'SC/ST Fund', amount:'₹3,20,00,000', status:'Completed' },
  { hash:'0xD2A4…8B67', scheme:'State Merit', amount:'₹50,00,000', status:'Processing' },
  { hash:'0xE8C3…4D11', scheme:'OBC Scholarship', amount:'₹60,00,000', status:'Completed' },
];

const MY_TOKENS = [
  { id:'TOK-0042-001', scheme:'PM National Scholarship 2026', amount:50000, status:'redeemable', issued:'2026-01-20', expires:'2026-12-31' },
  { id:'TOK-0042-002', scheme:'Girl Child STEM Scholarship', amount:30000, status:'redeemable', issued:'2026-02-01', expires:'2026-12-31' },
  { id:'TOK-0042-003', scheme:'State Merit Award', amount:25000, status:'pending',    issued:'Pending Gov Approval', expires:'—' },
];

const MY_APPLICATIONS = [
  { id:'APP-006', scheme:'PM National Scholarship 2026', date:'2026-02-16', amount:50000, status:'AI Verified' },
  { id:'APP-010', scheme:'Girl Child STEM Scholarship',  date:'2026-02-10', amount:30000, status:'Approved'    },
  { id:'APP-014', scheme:'State Merit Award',            date:'2026-01-28', amount:25000, status:'Pending Review'},
  { id:'APP-018', scheme:'Disability Support Grant',     date:'2026-01-15', amount:20000, status:'Rejected'    },
];

const MINTED_HISTORY = [
  { scheme:'PM National', tokens:5000, amount:'₹25Cr', time:'Today 09:12' },
  { scheme:'SC/ST Fund',  tokens:3200, amount:'₹12.8Cr', time:'Yesterday' },
  { scheme:'Girl STEM',   tokens:2800, amount:'₹8.4Cr', time:'Feb 17, 2026' },
];

const REPORTS_DATA = [
  { icon:'📊', title:'Monthly Token Report — Jan 2026', desc:'Full breakdown of tokens minted, distributed and redeemed in January 2026.', meta:'Generated: Feb 01, 2026 · 2.4 MB PDF' },
  { icon:'🔍', title:'AI Fraud Audit — Q4 2025', desc:'All AI flagged cases, resolutions, and fraud prevention summary for Q4 2025.', meta:'Generated: Jan 05, 2026 · 1.8 MB PDF' },
  { icon:'🏛️', title:'Scheme Performance Report', desc:'Scheme-wise beneficiary count, fund utilization, and redemption rates for active schemes.', meta:'Generated: Feb 15, 2026 · 3.1 MB PDF' },
  { icon:'💰', title:'Treasury Allocation Audit', desc:'Immutable on-chain audit of all treasury-to-token conversions and disbursements.', meta:'Generated: Feb 10, 2026 · 1.2 MB PDF' },
  { icon:'🎓', title:'Student Verification Summary', desc:'Summary of all AI verification outcomes, trust scores and flagged anomalies.', meta:'Generated: Feb 18, 2026 · 890 KB PDF' },
  { icon:'🌉', title:'Bridge Distribution Log', desc:'Complete atomic distribution records for all bridge student token batches.', meta:'Generated: Feb 19, 2026 · 650 KB PDF' },
];

const BRIDGE_BATCH = {
  batchId:   'BATCH-2026-0019',
  scheme:    'PM National Scholarship 2026',
  total:     5000,
  amount:    '₹25,00,00,000',
  bridgeId:  'STU-2026-0042',
  lock_until:'2026-12-31',
};

const BRIDGE_RECIPIENTS = [
  { id:'STU-2026-0011', name:'Arjun Sharma',  amount:50000, status:'verified' },
  { id:'STU-2026-0023', name:'Meena Patel',   amount:30000, status:'verified' },
  { id:'STU-2026-0034', name:'Rahul Verma',   amount:40000, status:'verified' },
  { id:'STU-2026-0045', name:'Sunita Rao',    amount:25000, status:'pending'  },
  { id:'STU-2026-0056', name:'Dev Kumar',     amount:20000, status:'verified' },
  { id:'STU-2026-0067', name:'Ramesh Singh',  amount:15000, status:'pending'  },
];
