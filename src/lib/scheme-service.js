/**
 * scheme-service.js
 *
 * High-level service for scheme management combining:
 *  - On-chain contract operations
 *  - Token minting
 *  - Beneficiary management
 *  - Local state management for UI
 *
 * This service provides a clean API for the UI components
 * while handling all the complexity of blockchain operations.
 */

import {
  createScheme,
  fundScheme,
  pauseScheme,
  resumeScheme,
  closeScheme,
  registerBeneficiary,
  approveBeneficiary,
  releaseFunds,
  createSchemeToken,
  mintSchemeTokens,
  optInToToken,
  batchMintTokens,
  batchReleaseFunds,
  getSchemeDetails,
  getBeneficiaryStatus,
  getAllSchemes,
  getFactoryStats,
  inrToMicroAlgo,
  microAlgoToInr,
  generateSchemeId,
  generateTokenUnitName,
  makeFundSigner,
  SCHEME_STATUS,
  BENEFICIARY_STATUS,
  SCHEME_FACTORY_APP_ID,
  TOKEN_TYPES,
} from './fund-token'

import {
  deploySchemeFactory,
  fundFactoryEscrow,
  validateSchemeConfig,
  SchemeConfigTemplate,
  getFactoryBalance,
  getAppAddress,
  isAuthorizedAdmin,
  listAllSchemeBoxes,
} from './scheme-factory-contract'

import {
  getAlgodClient,
  makePeraSigner,
  APP_ID as SCHOLARSHIP_APP_ID,
} from './scholarship-contract'

import { loadAddress } from './perawallet'

// ─── Local State Management ───────────────────────────────────────────────────

// In-memory cache for scheme data (supplements on-chain state)
let schemesCache = new Map()
let lastCacheRefresh = 0
const CACHE_TTL = 60000 // 1 minute

/**
 * Get all schemes with caching
 */
export async function getCachedSchemes(forceRefresh = false) {
  const now = Date.now()

  if (!forceRefresh && schemesCache.size > 0 && (now - lastCacheRefresh) < CACHE_TTL) {
    return Array.from(schemesCache.values())
  }

  try {
    // Fetch from chain
    const { schemes } = await getAllSchemes()
    schemesCache.clear()
    schemes.forEach(s => schemesCache.set(s.schemeId.toString(), s))
    lastCacheRefresh = now
    return schemes
  } catch (err) {
    console.error('Failed to fetch schemes:', err)
    return Array.from(schemesCache.values())
  }
}

/**
 * Clear scheme cache
 */
export function clearSchemeCache() {
  schemesCache.clear()
  lastCacheRefresh = 0
}

// ─── Scheme CRUD Operations ───────────────────────────────────────────────────

/**
 * Create a new scheme with all associated components
 * 
 * @param {object} schemeData UI form data
 * @param {Function} onProgress Progress callback
 * @returns {Promise<{success: boolean, schemeId?: bigint, tokenAssetId?: number, error?: string}>}
 */
export async function createFullScheme(schemeData, onProgress = () => {}) {
  const walletAddress = loadAddress()
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' }
  }

  const signer = makePeraSigner(walletAddress)

  try {
    // Step 1: Validate input
    onProgress({ step: 1, total: 4, message: 'Validating scheme configuration...' })

    const {
      name,
      category,
      amountPerStudent,
      totalBudgetCr,
      deadline,
      criteria,
      ministry,
      maxBeneficiaries,
      createToken,
    } = schemeData

    // Convert to microAlgo (approximate INR conversion)
    const payoutMicroAlgo = inrToMicroAlgo(amountPerStudent)
    const budgetMicroAlgo = inrToMicroAlgo(totalBudgetCr * 10000000) // Convert Cr to base INR

    // Parse deadline
    const deadlineTimestamp = deadline 
      ? Math.floor(new Date(deadline).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // Default 1 year

    const config = {
      name,
      budgetMicroAlgo,
      payoutMicroAlgo,
      deadline: deadlineTimestamp,
    }

    const validation = validateSchemeConfig(config)
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') }
    }

    // Step 2: Create scheme on chain
    onProgress({ step: 2, total: 4, message: 'Creating scheme on blockchain...' })

    const { txID: createTxID, schemeId } = await createScheme(
      walletAddress,
      config,
      signer
    )

    console.log('Scheme created:', { txID: createTxID, schemeId })

    // Step 3: Create token if requested
    let tokenAssetId = null
    if (createToken) {
      onProgress({ step: 3, total: 4, message: 'Creating scheme token (ASA)...' })

      const tokenConfig = {
        name: `${name} Token`,
        unitName: generateTokenUnitName(name),
        total: maxBeneficiaries || 100000,
        decimals: 0,
        url: '', // Could be IPFS metadata URL
      }

      const { txID: tokenTxID, assetId } = await createSchemeToken(
        walletAddress,
        tokenConfig,
        signer
      )

      tokenAssetId = assetId
      console.log('Token created:', { txID: tokenTxID, assetId })
    }

    // Step 4: Store metadata locally
    onProgress({ step: 4, total: 4, message: 'Finalizing scheme...' })

    const schemeRecord = {
      schemeId: schemeId.toString(),
      name,
      category,
      amountPerStudent,
      totalBudgetCr,
      deadline,
      criteria,
      ministry,
      maxBeneficiaries,
      tokenAssetId,
      status: SCHEME_STATUS.DRAFT,
      createdAt: new Date().toISOString(),
      createdBy: walletAddress,
    }

    schemesCache.set(schemeId.toString(), schemeRecord)

    return {
      success: true,
      schemeId,
      tokenAssetId,
      txID: createTxID,
    }

  } catch (err) {
    console.error('Create scheme error:', err)
    return { 
      success: false, 
      error: err.message?.includes('rejected') 
        ? 'Transaction rejected in wallet'
        : (err.message || 'Failed to create scheme')
    }
  }
}

/**
 * Activate a draft scheme (changes status from DRAFT to ACTIVE)
 */
export async function activateScheme(schemeId) {
  const walletAddress = loadAddress()
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' }
  }

  const signer = makePeraSigner(walletAddress)

  try {
    // Resume scheme (which activates it)
    const { txID } = await resumeScheme(walletAddress, schemeId, signer)
    
    // Update cache
    if (schemesCache.has(schemeId.toString())) {
      const scheme = schemesCache.get(schemeId.toString())
      scheme.status = SCHEME_STATUS.ACTIVE
      schemesCache.set(schemeId.toString(), scheme)
    }

    return { success: true, txID }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to activate scheme' }
  }
}

/**
 * Pause an active scheme
 */
export async function pauseActiveScheme(schemeId) {
  const walletAddress = loadAddress()
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' }
  }

  const signer = makePeraSigner(walletAddress)

  try {
    const { txID } = await pauseScheme(walletAddress, schemeId, signer)
    
    // Update cache
    if (schemesCache.has(schemeId.toString())) {
      const scheme = schemesCache.get(schemeId.toString())
      scheme.status = SCHEME_STATUS.PAUSED
      schemesCache.set(schemeId.toString(), scheme)
    }

    return { success: true, txID }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to pause scheme' }
  }
}

/**
 * Close a scheme and return remaining funds
 */
export async function terminateScheme(schemeId) {
  const walletAddress = loadAddress()
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' }
  }

  const signer = makePeraSigner(walletAddress)

  try {
    const { txID } = await closeScheme(walletAddress, schemeId, signer)
    
    // Update cache
    if (schemesCache.has(schemeId.toString())) {
      const scheme = schemesCache.get(schemeId.toString())
      scheme.status = SCHEME_STATUS.CANCELLED
      schemesCache.set(schemeId.toString(), scheme)
    }

    return { success: true, txID }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to close scheme' }
  }
}

// ─── Funding Operations ───────────────────────────────────────────────────────

/**
 * Fund a scheme with ALGO
 */
export async function addFundsToScheme(schemeId, amountAlgo) {
  const walletAddress = loadAddress()
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' }
  }

  const signer = makePeraSigner(walletAddress)
  const amountMicroAlgo = Math.floor(amountAlgo * 1000000)

  try {
    const { txID } = await fundScheme(walletAddress, schemeId, amountMicroAlgo, signer)
    clearSchemeCache() // Refresh to get updated funded amount
    return { success: true, txID }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to fund scheme' }
  }
}

// ─── Beneficiary Operations ───────────────────────────────────────────────────

/**
 * Register a new beneficiary for a scheme
 */
export async function registerSchemeApplicant(schemeId, applicantAddress) {
  const signer = makePeraSigner(applicantAddress)

  try {
    const { txID } = await registerBeneficiary(applicantAddress, schemeId, signer)
    return { success: true, txID }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to register' }
  }
}

/**
 * Approve a registered beneficiary (authority operation)
 */
export async function approveSchemeApplicant(schemeId, applicantAddress) {
  const walletAddress = loadAddress()
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' }
  }

  const signer = makePeraSigner(walletAddress)

  try {
    const { txID } = await approveBeneficiary(walletAddress, schemeId, applicantAddress, signer)
    return { success: true, txID }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to approve' }
  }
}

/**
 * Release funds to an approved beneficiary
 */
export async function disburseFunds(schemeId, beneficiaryAddress) {
  const walletAddress = loadAddress()
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' }
  }

  const signer = makePeraSigner(walletAddress)

  try {
    const { txID } = await releaseFunds(walletAddress, schemeId, beneficiaryAddress, signer)
    clearSchemeCache() // Refresh to get updated spent amount
    return { success: true, txID }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to disburse funds' }
  }
}

/**
 * Batch disburse funds to multiple beneficiaries
 */
export async function batchDisburseFunds(schemeId, beneficiaryAddresses) {
  const walletAddress = loadAddress()
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' }
  }

  const signer = makePeraSigner(walletAddress)

  try {
    const { txIDs } = await batchReleaseFunds(walletAddress, schemeId, beneficiaryAddresses, signer)
    clearSchemeCache()
    return { success: true, txIDs }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to batch disburse' }
  }
}

// ─── Token Operations ─────────────────────────────────────────────────────────

/**
 * Mint tokens to a beneficiary (for tracking/verification)
 */
export async function mintBeneficiaryToken(assetId, beneficiaryAddress, amount = 1) {
  const walletAddress = loadAddress()
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' }
  }

  const signer = makePeraSigner(walletAddress)

  try {
    const { txID } = await mintSchemeTokens(walletAddress, assetId, beneficiaryAddress, amount, signer)
    return { success: true, txID }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to mint token' }
  }
}

/**
 * Batch mint tokens to multiple beneficiaries
 */
export async function batchMintBeneficiaryTokens(assetId, recipients) {
  const walletAddress = loadAddress()
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' }
  }

  const signer = makePeraSigner(walletAddress)

  try {
    // Split into batches of 16 (Algorand atomic group limit)
    const results = []
    for (let i = 0; i < recipients.length; i += 16) {
      const batch = recipients.slice(i, i + 16)
      const { txIDs } = await batchMintTokens(walletAddress, assetId, batch, signer)
      results.push(...txIDs)
    }
    return { success: true, txIDs: results }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to batch mint' }
  }
}

/**
 * Allow user to opt-in to receive scheme token
 */
export async function optInToSchemeToken(assetId) {
  const walletAddress = loadAddress()
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' }
  }

  const signer = makePeraSigner(walletAddress)

  try {
    const { txID } = await optInToToken(walletAddress, assetId, signer)
    return { success: true, txID }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to opt-in' }
  }
}

// ─── Query Operations ─────────────────────────────────────────────────────────

/**
 * Get scheme statistics for dashboard
 */
export async function getSchemeStatistics() {
  try {
    const stats = await getFactoryStats()
    const balance = await getFactoryBalance(SCHEME_FACTORY_APP_ID)

    return {
      totalSchemes: Number(stats.totalSchemes),
      totalFundedAlgo: Number(stats.totalFunded) / 1000000,
      totalDisbursedAlgo: Number(stats.totalDisbursed) / 1000000,
      totalBeneficiaries: Number(stats.totalBeneficiaries),
      contractBalanceAlgo: balance.available / 1000000,
    }
  } catch (err) {
    console.error('Failed to get stats:', err)
    return {
      totalSchemes: 0,
      totalFundedAlgo: 0,
      totalDisbursedAlgo: 0,
      totalBeneficiaries: 0,
      contractBalanceAlgo: 0,
    }
  }
}

/**
 * Get scheme by ID with enriched data
 */
export async function getSchemeById(schemeId) {
  // Check cache first
  if (schemesCache.has(schemeId.toString())) {
    return schemesCache.get(schemeId.toString())
  }

  // Fetch from chain
  const details = await getSchemeDetails(BigInt(schemeId))
  if (details) {
    schemesCache.set(schemeId.toString(), details)
  }
  return details
}

/**
 * Get beneficiary's status across all schemes
 */
export async function getBeneficiarySchemeStatus(beneficiaryAddress, schemeId) {
  try {
    const status = await getBeneficiaryStatus(BigInt(schemeId), beneficiaryAddress)
    return status
  } catch {
    return null
  }
}

// ─── Utility Exports ──────────────────────────────────────────────────────────

export {
  SCHEME_STATUS,
  BENEFICIARY_STATUS,
  TOKEN_TYPES,
  inrToMicroAlgo,
  microAlgoToInr,
  generateSchemeId,
  generateTokenUnitName,
  validateSchemeConfig,
  SchemeConfigTemplate,
}

// Status helpers
export function getSchemeStatusLabel(status) {
  const labels = {
    [SCHEME_STATUS.DRAFT]: 'Draft',
    [SCHEME_STATUS.ACTIVE]: 'Active',
    [SCHEME_STATUS.PAUSED]: 'Paused',
    [SCHEME_STATUS.COMPLETED]: 'Completed',
    [SCHEME_STATUS.CANCELLED]: 'Cancelled',
  }
  return labels[status] || 'Unknown'
}

export function getSchemeStatusColor(status) {
  const colors = {
    [SCHEME_STATUS.DRAFT]: '#94a3b8',
    [SCHEME_STATUS.ACTIVE]: '#10b981',
    [SCHEME_STATUS.PAUSED]: '#f59e0b',
    [SCHEME_STATUS.COMPLETED]: '#6366f1',
    [SCHEME_STATUS.CANCELLED]: '#ef4444',
  }
  return colors[status] || '#94a3b8'
}

export function getBeneficiaryStatusLabel(status) {
  const labels = {
    [BENEFICIARY_STATUS.REGISTERED]: 'Registered',
    [BENEFICIARY_STATUS.VERIFIED]: 'AI Verified',
    [BENEFICIARY_STATUS.APPROVED]: 'Approved',
    [BENEFICIARY_STATUS.FUNDED]: 'Funded',
    [BENEFICIARY_STATUS.REJECTED]: 'Rejected',
  }
  return labels[status] || 'Unknown'
}

// Convert scheme data for UI display
export function formatSchemeForDisplay(scheme) {
  return {
    ...scheme,
    budgetDisplay: scheme.budget 
      ? `₹${microAlgoToInr(Number(scheme.budget) / 100).toLocaleString()} Cr` 
      : '—',
    payoutDisplay: scheme.payout 
      ? `₹${microAlgoToInr(Number(scheme.payout)).toLocaleString()}` 
      : '—',
    deadlineDisplay: scheme.deadline 
      ? new Date(Number(scheme.deadline) * 1000).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      : '—',
    statusLabel: getSchemeStatusLabel(scheme.status),
    statusColor: getSchemeStatusColor(scheme.status),
    utilization: scheme.budget > 0 
      ? Math.round((Number(scheme.spent) / Number(scheme.budget)) * 100) 
      : 0,
  }
}
