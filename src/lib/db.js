/**
 * ExpressScheme — Supabase Data Access Layer
 * All database operations go through these functions.
 */
import { supabase } from './supabase'

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
export const UserDB = {
  /** Get user profile by Supabase auth UID */
  async getByAuthId(authUid) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUid)
      .single()
    return { data, error }
  },

  /** Get user by internal UUID */
  async getById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    return { data, error }
  },

  /** Create or update user profile */
  async upsert(profile) {
    const { data, error } = await supabase
      .from('users')
      .upsert(profile, { onConflict: 'auth_user_id' })
      .select()
      .single()
    return { data, error }
  },

  /** Update AI trust score after verification */
  async updateTrustScore(userId, score) {
    const { data, error } = await supabase
      .from('users')
      .update({ ai_trust_score: score, is_ai_verified: score >= 60 })
      .eq('id', userId)
      .select()
      .single()
    return { data, error }
  },

  /** Officers: list all students with filters */
  async listStudents({ page = 0, pageSize = 20, search = '', isVerified = null } = {}) {
    let q = supabase
      .from('users')
      .select('id, full_name, email, institution_name, course, ai_trust_score, is_ai_verified, created_at', { count: 'exact' })
      .eq('role', 'student')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    if (isVerified !== null) q = q.eq('is_ai_verified', isVerified)

    return q
  },
}


// ─────────────────────────────────────────────
// SCHEMES
// ─────────────────────────────────────────────
export const SchemeDB = {
  /** List all active schemes (public) */
  async listActive({ search = '', category = null } = {}) {
    let q = supabase
      .from('schemes')
      .select(`
        id, name, description, category, ministry, state,
        budget_total, budget_remaining, amount_per_student, max_beneficiaries,
        start_date, end_date, application_deadline, status,
        tokens_minted, tokens_distributed,
        scheme_stats (
          total_applications, applications_approved, tokens_redeemed
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (search)   q = q.ilike('name', `%${search}%`)
    if (category) q = q.eq('category', category)

    return q
  },

  /** All schemes (officer view) */
  async listAll() {
    return supabase
      .from('schemes')
      .select(`*, scheme_stats(*)`)
      .order('created_at', { ascending: false })
  },

  /** Get single scheme with full stats */
  async getById(id) {
    return supabase
      .from('schemes')
      .select(`*, scheme_stats(*), users!schemes_created_by_fkey(full_name, officer_id)`)
      .eq('id', id)
      .single()
  },

  /** Create new scheme */
  async create(scheme) {
    const { data, error } = await supabase
      .from('schemes')
      .insert(scheme)
      .select()
      .single()
    return { data, error }
  },

  /** Update scheme status */
  async updateStatus(id, status) {
    const { data, error } = await supabase
      .from('schemes')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },
}


// ─────────────────────────────────────────────
// APPLICATIONS
// ─────────────────────────────────────────────
export const ApplicationDB = {
  /** Student: submit a new application */
  async create(application) {
    const { data, error } = await supabase
      .from('applications')
      .insert(application)
      .select()
      .single()
    return { data, error }
  },

  /** Student: get all their applications with scheme details */
  async getByStudent(studentId) {
    return supabase
      .from('applications')
      .select(`
        *,
        schemes ( id, name, amount_per_student, category, ministry ),
        tokens   ( id, status, amount_inr, minted_at, distributed_at ),
        ai_verifications ( overall_trust_score, overall_status, verified_at )
      `)
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false })
  },

  /** Officer: list all applications with filters */
  async listAll({ status = null, schemeId = null, search = '', page = 0, pageSize = 20 } = {}) {
    let q = supabase
      .from('applications')
      .select(`
        id, application_number, status, submitted_at, ai_trust_score,
        declared_income, declared_gpa, declared_course,
        schemes   ( id, name, amount_per_student ),
        users     ( id, full_name, email, aadhaar_last4, institution_name ),
        ai_verifications ( overall_trust_score, overall_status )
      `, { count: 'exact' })
      .order('submitted_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (status)   q = q.eq('status', status)
    if (schemeId) q = q.eq('scheme_id', schemeId)
    if (search)   q = q.ilike('application_number', `%${search}%`)

    return q
  },

  /** Officer: approve/reject an application */
  async updateStatus(appId, { status, officerId, remarks, rejectionReason = null, rejectionCategory = null }) {
    const { data, error } = await supabase
      .from('applications')
      .update({
        status,
        officer_id: officerId,
        officer_remarks: remarks,
        rejection_reason: rejectionReason,
        rejection_category: rejectionCategory,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', appId)
      .select()
      .single()
    return { data, error }
  },

  /** Get full application detail for officer review */
  async getById(id) {
    return supabase
      .from('applications')
      .select(`
        *,
        schemes       ( * ),
        users         ( * ),
        documents     ( * ),
        ai_verifications ( * ),
        fraud_flags   ( * ),
        tokens        ( * )
      `)
      .eq('id', id)
      .single()
  },
}


// ─────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────
export const TokenDB = {
  /** Student: get all their tokens */
  async getByStudent(studentId) {
    return supabase
      .from('tokens')
      .select(`*, schemes ( id, name, category, ministry )`)
      .eq('student_id', studentId)
      .order('minted_at', { ascending: false })
  },

  /** Mint a new token after application approved */
  async mint(tokenData) {
    const { data, error } = await supabase
      .from('tokens')
      .insert({ ...tokenData, status: 'minted', minted_at: new Date().toISOString() })
      .select()
      .single()
    return { data, error }
  },

  /** Update token status (distributed, redeemed, revoked) */
  async updateStatus(tokenId, updates) {
    const { data, error } = await supabase
      .from('tokens')
      .update({ ...updates })
      .eq('id', tokenId)
      .select()
      .single()
    return { data, error }
  },

  /** Officer: aggregate stats per scheme */
  async statsByScheme(schemeId) {
    return supabase
      .from('tokens')
      .select('status')
      .eq('scheme_id', schemeId)
  },
}


// ─────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────
export const TransactionDB = {
  /** Record a new on-chain transaction */
  async create(tx) {
    const { data, error } = await supabase
      .from('transactions')
      .insert(tx)
      .select()
      .single()
    return { data, error }
  },

  /** Get transactions for a specific token (full history) */
  async getByToken(tokenId) {
    return supabase
      .from('transactions')
      .select('*')
      .eq('token_id', tokenId)
      .order('block_timestamp', { ascending: true })
  },

  /** Get transactions for a specific user */
  async getByUser(userId) {
    return supabase
      .from('transactions')
      .select(`*, tokens ( id, amount_inr, status ), schemes ( id, name )`)
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(50)
  },

  /** Get scheme-level transaction summary */
  async getByScheme(schemeId) {
    return supabase
      .from('transactions')
      .select('id, tx_hash, tx_type, amount_inr, tx_status, block_timestamp, from_wallet, to_wallet')
      .eq('scheme_id', schemeId)
      .order('block_timestamp', { ascending: false })
  },
}


// ─────────────────────────────────────────────
// AI VERIFICATIONS
// ─────────────────────────────────────────────
export const AIVerificationDB = {
  /** Store/update AI verification result */
  async upsert(result) {
    const { data, error } = await supabase
      .from('ai_verifications')
      .upsert(result, { onConflict: 'application_id' })
      .select()
      .single()
    return { data, error }
  },

  /** Get verification for an application */
  async getByApplication(applicationId) {
    return supabase
      .from('ai_verifications')
      .select('*')
      .eq('application_id', applicationId)
      .single()
  },
}


// ─────────────────────────────────────────────
// FRAUD FLAGS
// ─────────────────────────────────────────────
export const FraudFlagDB = {
  /** Create a fraud flag */
  async create(flag) {
    const { data, error } = await supabase
      .from('fraud_flags')
      .insert(flag)
      .select()
      .single()
    return { data, error }
  },

  /** Officer: list open flags */
  async listOpen({ severity = null } = {}) {
    let q = supabase
      .from('fraud_flags')
      .select(`
        *,
        users             ( id, full_name, email, aadhaar_last4 ),
        applications      ( id, application_number, scheme_id ),
        schemes:applications!inner ( scheme_id )
      `)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })

    if (severity) q = q.eq('severity', severity)
    return q
  },

  /** Resolve a flag */
  async resolve(flagId, { resolution, resolvedBy, notes }) {
    const { data, error } = await supabase
      .from('fraud_flags')
      .update({
        is_resolved: true,
        resolution,
        resolved_by: resolvedBy,
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', flagId)
      .select()
      .single()
    return { data, error }
  },
}


// ─────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────
export const AuditDB = {
  /** Log any event (insert-only) */
  async log({ eventType, entityType, entityId, actorId, actorRole, action, oldData, newData, txHash }) {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        actor_id: actorId,
        actor_role: actorRole,
        action,
        old_data: oldData,
        new_data: newData,
        delta: computeDelta(oldData, newData),
        tx_hash: txHash,
      })
      .select()
      .single()
    return { data, error }
  },

  /** Query audit trail for any entity */
  async getForEntity(entityType, entityId) {
    return supabase
      .from('audit_logs')
      .select('event_id, event_type, action, actor_role, tx_hash, created_at, delta')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })
  },
}

// Helper: compute object diff
function computeDelta(oldData, newData) {
  if (!oldData || !newData) return null
  const delta = {}
  Object.keys(newData).forEach(k => {
    if (oldData[k] !== newData[k]) delta[k] = { from: oldData[k], to: newData[k] }
  })
  return Object.keys(delta).length ? delta : null
}


// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────
export const NotificationDB = {
  /** Get user notifications */
  async getByUser(userId, { unreadOnly = false } = {}) {
    let q = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (unreadOnly) q = q.eq('is_read', false)
    return q
  },

  /** Mark notification as read */
  async markRead(notificationId) {
    return supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
  },

  /** Send a notification */
  async send({ userId, type, title, body, link, data, entityType, entityId }) {
    const { data: n, error } = await supabase
      .from('notifications')
      .insert({ user_id: userId, type, title, body, link, data, entity_type: entityType, entity_id: entityId })
      .select()
      .single()
    return { data: n, error }
  },
}


// ─────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────
export const DocumentDB = {
  /** Upload a document to Supabase Storage and record in DB */
  async upload({ applicationId, userId, docType, file }) {
    const ext      = file.name.split('.').pop()
    const filePath = `documents/${userId}/${applicationId}/${docType}-${Date.now()}.${ext}`

    // 1. Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('scheme-documents')
      .upload(filePath, file, { cacheControl: '3600', upsert: false })

    if (uploadError) return { data: null, error: uploadError }

    // 2. Record in DB
    const { data, error } = await supabase
      .from('documents')
      .insert({
        application_id: applicationId,
        user_id: userId,
        doc_type: docType,
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        file_hash: '',   // frontend should compute SHA-256 before calling
      })
      .select()
      .single()

    return { data, error }
  },

  /** Get signed URL for document view */
  async getSignedUrl(filePath) {
    const { data, error } = await supabase.storage
      .from('scheme-documents')
      .createSignedUrl(filePath, 3600)  // 1 hour expiry
    return { data, error }
  },
}
