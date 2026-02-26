/**
 * ExpressScheme — MongoDB Data Access Layer
 * Mirrors the structure of src/lib/db.js (Supabase DAL).
 * Both databases stay in sync — same records, same IDs, dual-write pattern.
 */
import {
  mongoFind, mongoFindOne, mongoInsertOne, mongoInsertMany,
  mongoUpdateOne, mongoDeleteOne, mongoAggregate, mongoCount, mongoUpsert,
} from './mongodb'

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
export const MUserDB = {
  async getByAuthId(authUid) {
    return mongoFindOne('users', { authUserId: authUid })
  },

  async getById(id) {
    return mongoFindOne('users', { _id: id })
  },

  async upsert(profile) {
    return mongoUpsert('users', { authUserId: profile.authUserId }, profile)
  },

  async updateTrustScore(userId, score) {
    return mongoUpdateOne('users', { _id: userId }, {
      $set: { aiTrustScore: score, isAiVerified: score >= 60 },
    })
  },

  async listStudents({ page = 0, pageSize = 20, search = '', isVerified = null } = {}) {
    const filter = { role: 'student' }
    if (isVerified !== null) filter.isAiVerified = isVerified
    if (search) filter.$or = [
      { fullName:  { $regex: search, $options: 'i' } },
      { email:     { $regex: search, $options: 'i' } },
    ]
    return mongoFind('users', filter, {
      skip:  page * pageSize,
      limit: pageSize,
      projection: {
        fullName:1, email:1, institutionName:1, course:1,
        aiTrustScore:1, isAiVerified:1, createdAt:1,
      },
    })
  },
}


// ─────────────────────────────────────────────
// SCHEMES
// ─────────────────────────────────────────────
export const MSchemeDB = {
  async listActive({ search = '', category = null } = {}) {
    const filter = { status: 'active' }
    if (search)   filter.name     = { $regex: search, $options: 'i' }
    if (category) filter.category = category
    return mongoFind('schemes', filter)
  },

  async listAll() {
    return mongoFind('schemes', {})
  },

  async getById(id) {
    return mongoFindOne('schemes', { _id: id })
  },

  async create(scheme) {
    return mongoInsertOne('schemes', scheme)
  },

  async updateStatus(id, status) {
    return mongoUpdateOne('schemes', { _id: id }, { $set: { status } })
  },
}


// ─────────────────────────────────────────────
// APPLICATIONS
// ─────────────────────────────────────────────
export const MApplicationDB = {
  async create(application) {
    return mongoInsertOne('applications', application)
  },

  async getByStudent(studentId) {
    return mongoFind('applications', { studentId }, { sort: { submittedAt: -1 } })
  },

  async listAll({ status = null, schemeId = null, search = '', page = 0, pageSize = 20 } = {}) {
    const filter = {}
    if (status)   filter.status    = status
    if (schemeId) filter.schemeId  = schemeId
    if (search)   filter.applicationNumber = { $regex: search, $options: 'i' }
    return mongoFind('applications', filter, {
      skip:  page * pageSize,
      limit: pageSize,
      sort:  { submittedAt: -1 },
    })
  },

  async updateStatus(appId, { status, officerId, remarks, rejectionReason = null, rejectionCategory = null }) {
    return mongoUpdateOne('applications', { _id: appId }, {
      $set: {
        status,
        officerId,
        officerRemarks: remarks,
        rejectionReason,
        rejectionCategory,
        reviewedAt: new Date().toISOString(),
      },
    })
  },

  async getById(id) {
    return mongoFindOne('applications', { _id: id })
  },
}


// ─────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────
export const MTokenDB = {
  async getByStudent(studentId) {
    return mongoFind('tokens', { studentId }, { sort: { mintedAt: -1 } })
  },

  async mint(tokenData) {
    return mongoInsertOne('tokens', {
      ...tokenData,
      status:   'minted',
      mintedAt: new Date().toISOString(),
    })
  },

  async updateStatus(tokenId, updates) {
    return mongoUpdateOne('tokens', { _id: tokenId }, { $set: updates })
  },

  async statsByScheme(schemeId) {
    return mongoAggregate('tokens', [
      { $match: { schemeId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
  },
}


// ─────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────
export const MTransactionDB = {
  /** Record a new on-chain transaction (mirrors TransactionDB.create) */
  async create(tx) {
    return mongoInsertOne('transactions', tx)
  },

  /** Full history for a token */
  async getByToken(tokenId) {
    return mongoFind('transactions', { tokenId }, { sort: { blockTimestamp: 1 } })
  },

  /** All transactions for a user (sent or received) */
  async getByUser(userId) {
    return mongoFind('transactions', {
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    }, { sort: { createdAt: -1 }, limit: 50 })
  },

  /** Scheme-level transaction summary */
  async getByScheme(schemeId) {
    return mongoFind('transactions', { schemeId }, { sort: { blockTimestamp: -1 } })
  },

  /** Transaction by hash (for blockchain explorer link) */
  async getByTxHash(txHash) {
    return mongoFindOne('transactions', { txHash })
  },
}


// ─────────────────────────────────────────────
// AI VERIFICATIONS
// ─────────────────────────────────────────────
export const MAIVerificationDB = {
  async upsert(result) {
    return mongoUpsert('ai_verifications', { applicationId: result.applicationId }, result)
  },

  async getByApplication(applicationId) {
    return mongoFindOne('ai_verifications', { applicationId })
  },
}


// ─────────────────────────────────────────────
// FRAUD FLAGS
// ─────────────────────────────────────────────
export const MFraudFlagDB = {
  async create(flag) {
    return mongoInsertOne('fraud_flags', flag)
  },

  async listOpen({ severity = null } = {}) {
    const filter = { isResolved: false }
    if (severity) filter.severity = severity
    return mongoFind('fraud_flags', filter, { sort: { createdAt: -1 } })
  },

  async resolve(flagId, { resolution, resolvedBy, notes }) {
    return mongoUpdateOne('fraud_flags', { _id: flagId }, {
      $set: {
        isResolved:      true,
        resolution,
        resolvedBy,
        resolutionNotes: notes,
        resolvedAt:      new Date().toISOString(),
      },
    })
  },
}


// ─────────────────────────────────────────────
// AUDIT LOGS (insert-only)
// ─────────────────────────────────────────────
export const MAuditDB = {
  async log({ eventType, entityType, entityId, actorId, actorRole, action, oldData, newData, txHash }) {
    return mongoInsertOne('audit_logs', {
      eventType,
      entityType,
      entityId,
      actorId,
      actorRole,
      action,
      oldData,
      newData,
      delta:  computeDelta(oldData, newData),
      txHash,
    })
  },

  async getForEntity(entityType, entityId) {
    return mongoFind('audit_logs', { entityType, entityId }, { sort: { createdAt: 1 } })
  },
}

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
export const MNotificationDB = {
  async getByUser(userId, { unreadOnly = false } = {}) {
    const filter = { userId }
    if (unreadOnly) filter.isRead = false
    return mongoFind('notifications', filter, { sort: { createdAt: -1 }, limit: 30 })
  },

  async markRead(notificationId) {
    return mongoUpdateOne('notifications', { _id: notificationId }, {
      $set: { isRead: true, readAt: new Date().toISOString() },
    })
  },

  async send({ userId, type, title, body, link, data, entityType, entityId }) {
    return mongoInsertOne('notifications', {
      userId, type, title, body, link, data,
      entityType, entityId, isRead: false,
    })
  },
}


// ─────────────────────────────────────────────
// SCHEME STATS
// ─────────────────────────────────────────────
export const MSchemeStatsDB = {
  async getByScheme(schemeId) {
    return mongoFindOne('scheme_stats', { schemeId })
  },

  async update(schemeId, stats) {
    return mongoUpsert('scheme_stats', { schemeId }, { schemeId, ...stats })
  },

  async aggregate() {
    return mongoAggregate('scheme_stats', [
      {
        $group: {
          _id:                   null,
          totalApplications:     { $sum: '$totalApplications' },
          applicationsApproved:  { $sum: '$applicationsApproved' },
          tokensRedeemed:        { $sum: '$tokensRedeemed' },
          totalDisbursedInr:     { $sum: '$totalDisbursedInr' },
        },
      },
    ])
  },
}
