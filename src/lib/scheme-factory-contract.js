/**
 * scheme-factory-contract.js
 *
 * Algorand TestNet — Dynamic Scheme Factory Smart Contract Interface
 *
 * This module provides:
 *  • Contract deployment functionality
 *  • Multi-scheme management from a single factory
 *  • Dynamic scheme creation with customizable parameters
 *  • Authority management for government/institutional control
 *
 * Contract Architecture:
 *  - Factory pattern: One master contract manages multiple schemes
 *  - Box storage: Each scheme stored in its own box for scalability
 *  - Inner transactions: Secure fund disbursement via contract-initiated payments
 *  - Role-based access: Authority hierarchy for scheme management
 *
 * Usage:
 *  1. Deploy factory contract once per organization
 *  2. Create schemes dynamically via factory
 *  3. Register & approve beneficiaries per scheme
 *  4. Release funds atomically via inner transactions
 */

import algosdk from 'algosdk'
import { getPeraWallet } from './perawallet'
import { getAlgodClient, ALGOD_SERVER, ALGOD_PORT, ALGOD_TOKEN } from './scholarship-contract'

// ─── Contract TEAL (Approval & Clear Programs) ────────────────────────────────
// These are base64-encoded compiled TEAL programs for the Scheme Factory

// Placeholder TEAL - In production, compile from PyTeal source
const APPROVAL_PROGRAM_B64 = `
  // This would be the actual compiled TEAL program
  // Generated from scheme_factory.py using py-algorand-sdk or pyteal compiler
  // For now, this is a placeholder
`

const CLEAR_PROGRAM_B64 = `
  // Clear state program
  // Typically just approves all clear operations
`

// ─── Schema definitions (local + global state allocation) ─────────────────────

/**
 * Global state schema for factory contract
 * Stores aggregate statistics and authority address
 */
export const GLOBAL_SCHEMA = {
  numUints: 8,    // scheme_count, total_funded, total_disbursed, total_beneficiaries, etc.
  numByteSlices: 4,  // authority, name, metadata_url, etc.
}

/**
 * Local state schema per user
 * Tracks user's participation across schemes
 */
export const LOCAL_SCHEMA = {
  numUints: 8,    // Per-scheme registration status, amounts received
  numByteSlices: 2,  // User metadata
}

/**
 * Box schema per scheme
 * Each scheme stored in a 256-byte box
 */
export const SCHEME_BOX_SIZE = 256

// ─── Contract Deployment ──────────────────────────────────────────────────────

/**
 * Deploy a new Scheme Factory contract
 * 
 * @param {string} creatorAddress  Address deploying the contract
 * @param {string} authorityAddress  Authority address (can be same as creator)
 * @param {Function} signer        Pera wallet signer
 * @returns {Promise<{ txID: string, appID: number, appAddress: string }>}
 */
export async function deploySchemeFactory(creatorAddress, authorityAddress, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  // In production, load compiled TEAL from files or compile from PyTeal
  // For demonstration, we'll use placeholder programs
  const approvalProgram = new Uint8Array(
    Buffer.from(APPROVAL_PROGRAM_B64.trim() || 'BiABAQ==', 'base64')
  )
  const clearProgram = new Uint8Array(
    Buffer.from(CLEAR_PROGRAM_B64.trim() || 'BiABAQ==', 'base64')
  )

  // Encode authority address as app argument
  const appArgs = [
    new Uint8Array(Buffer.from('create')),
    algosdk.decodeAddress(authorityAddress).publicKey,
  ]

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: creatorAddress,
    approvalProgram,
    clearProgram,
    numGlobalByteSlices: GLOBAL_SCHEMA.numByteSlices,
    numGlobalInts: GLOBAL_SCHEMA.numUints,
    numLocalByteSlices: LOCAL_SCHEMA.numByteSlices,
    numLocalInts: LOCAL_SCHEMA.numUints,
    appArgs,
    suggestedParams: params,
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()

  const confirmedTxn = await algosdk.waitForConfirmation(algod, txId, 4)
  const appID = confirmedTxn['application-index']
  const appAddress = algosdk.getApplicationAddress(appID)

  return { 
    txID: txId, 
    appID,
    appAddress 
  }
}

/**
 * Fund the factory contract escrow with ALGO for inner transactions
 * Required minimum balance for contract operations
 * 
 * @param {string} funderAddress     Address funding the contract
 * @param {number} appID             Factory app ID
 * @param {number} amountMicroAlgo   Amount to fund (recommend at least 1 ALGO for MBR)
 * @param {Function} signer          Pera wallet signer
 * @returns {Promise<{ txID: string }>}
 */
export async function fundFactoryEscrow(funderAddress, appID, amountMicroAlgo, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  const appAddress = algosdk.getApplicationAddress(appID)

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: funderAddress,
    receiver: appAddress,
    amount: BigInt(amountMicroAlgo),
    suggestedParams: params,
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  return { txID: txId }
}

// ─── Contract Configuration ───────────────────────────────────────────────────

/**
 * Scheme configuration template for creating new schemes
 */
export const SchemeConfigTemplate = {
  name: '',                    // Scheme name (max 64 chars)
  description: '',             // Brief description
  ministry: '',                // Administering ministry
  category: '',                // MERIT, NEED_BASED, MINORITY, RESEARCH
  budgetMicroAlgo: 0,          // Total budget in microAlgos
  payoutMicroAlgo: 0,          // Per-beneficiary payout
  maxBeneficiaries: 0,         // Maximum beneficiaries (0 = unlimited)
  deadline: 0,                 // Unix timestamp
  eligibilityCriteria: [],     // Array of eligibility requirements
  requiredDocuments: [],       // Documents needed for application
  kycLevel: 1,                 // Required KYC level (1-4)
  tokenEnabled: false,         // Whether to create ASA token for scheme
  tokenConfig: null,           // Token configuration if enabled
}

/**
 * Validate scheme configuration before creation
 */
export function validateSchemeConfig(config) {
  const errors = []

  if (!config.name || config.name.length > 64) {
    errors.push('Scheme name is required and must be ≤64 characters')
  }
  if (config.budgetMicroAlgo <= 0) {
    errors.push('Budget must be greater than 0')
  }
  if (config.payoutMicroAlgo <= 0) {
    errors.push('Payout amount must be greater than 0')
  }
  if (config.payoutMicroAlgo > config.budgetMicroAlgo) {
    errors.push('Payout cannot exceed total budget')
  }
  if (config.deadline && config.deadline <= Math.floor(Date.now() / 1000)) {
    errors.push('Deadline must be in the future')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// ─── Contract Upgrade / Configuration Updates ─────────────────────────────────

/**
 * Update authority address (requires current authority signature)
 * 
 * @param {string} currentAuthority   Current authority address
 * @param {string} newAuthority       New authority address
 * @param {number} appID              Factory app ID
 * @param {Function} signer           Current authority's signer
 * @returns {Promise<{ txID: string }>}
 */
export async function updateAuthority(currentAuthority, newAuthority, appID, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  const appArgs = [
    new Uint8Array(Buffer.from('update_authority')),
    algosdk.decodeAddress(newAuthority).publicKey,
  ]

  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: currentAuthority,
    appIndex: appID,
    appArgs,
    suggestedParams: params,
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  return { txID: txId }
}

/**
 * Add a secondary authority/admin (multi-sig support)
 */
export async function addSecondaryAuthority(primaryAuthority, secondaryAddress, appID, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  const appArgs = [
    new Uint8Array(Buffer.from('add_secondary_authority')),
    algosdk.decodeAddress(secondaryAddress).publicKey,
  ]

  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: primaryAuthority,
    appIndex: appID,
    appArgs,
    accounts: [secondaryAddress],
    suggestedParams: params,
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  return { txID: txId }
}

/**
 * Remove a secondary authority
 */
export async function removeSecondaryAuthority(primaryAuthority, secondaryAddress, appID, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  const appArgs = [
    new Uint8Array(Buffer.from('remove_secondary_authority')),
    algosdk.decodeAddress(secondaryAddress).publicKey,
  ]

  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: primaryAuthority,
    appIndex: appID,
    appArgs,
    accounts: [secondaryAddress],
    suggestedParams: params,
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  return { txID: txId }
}

// ─── Box Storage Helpers ──────────────────────────────────────────────────────

/**
 * Create a box for a new scheme
 * Box cost: 0.0025 ALGO per box + 0.0004 ALGO per byte
 * 
 * @param {string} authorityAddress  Authority creating the box
 * @param {number} appID             Factory app ID
 * @param {bigint} schemeId          Scheme ID (used as box name)
 * @param {Function} signer          Authority's signer
 * @returns {Promise<{ txID: string }>}
 */
export async function createSchemeBox(authorityAddress, appID, schemeId, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  const boxName = new Uint8Array([...Buffer.from('scheme_'), ...algosdk.bigIntToBytes(schemeId, 8)])

  // Calculate box MBR: 2500 + 400 * size
  const boxMBR = 2500 + (400 * SCHEME_BOX_SIZE)

  const appArgs = [
    new Uint8Array(Buffer.from('create_box')),
    algosdk.bigIntToBytes(schemeId, 8),
  ]

  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: authorityAddress,
    appIndex: appID,
    appArgs,
    boxes: [{ appIndex: appID, name: boxName }],
    suggestedParams: { ...params, fee: params.minFee + boxMBR },
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  return { txID: txId }
}

/**
 * Read scheme data from box storage
 */
export async function readSchemeBox(appID, schemeId) {
  const algod = getAlgodClient()
  const boxName = new Uint8Array([...Buffer.from('scheme_'), ...algosdk.bigIntToBytes(schemeId, 8)])

  try {
    const boxData = await algod.getApplicationBoxByName(appID, boxName).do()
    return parseSchemeBoxData(boxData.value)
  } catch (err) {
    if (err.message?.includes('box not found')) {
      return null
    }
    throw err
  }
}

/**
 * Parse raw box data into scheme object
 */
function parseSchemeBoxData(data) {
  const decoder = new TextDecoder('utf-8')

  // Parse according to contract's encoding scheme
  // Layout (256 bytes):
  //   0-63:   name (string, null-padded)
  //   64-71:  budget (uint64)
  //   72-79:  payout (uint64)
  //   80-87:  deadline (uint64)
  //   88-95:  status (uint64)
  //   96-103: funded (uint64)
  //   104-111: spent (uint64)
  //   112-119: beneficiary_count (uint64)
  //   120-151: authority (32 bytes address)
  //   152-255: reserved/metadata

  return {
    name: decoder.decode(data.slice(0, 64)).replace(/\0/g, '').trim(),
    budget: algosdk.bytesToBigInt(data.slice(64, 72)),
    payout: algosdk.bytesToBigInt(data.slice(72, 80)),
    deadline: algosdk.bytesToBigInt(data.slice(80, 88)),
    status: Number(algosdk.bytesToBigInt(data.slice(88, 96))),
    funded: algosdk.bytesToBigInt(data.slice(96, 104)),
    spent: algosdk.bytesToBigInt(data.slice(104, 112)),
    beneficiaryCount: algosdk.bytesToBigInt(data.slice(112, 120)),
    authority: algosdk.encodeAddress(data.slice(120, 152)),
  }
}

/**
 * List all scheme boxes in the factory
 */
export async function listAllSchemeBoxes(appID) {
  const algod = getAlgodClient()

  try {
    const boxNames = await algod.getApplicationBoxes(appID).do()
    const schemes = []

    for (const box of boxNames.boxes || []) {
      const nameStr = Buffer.from(box.name).toString('utf-8')
      if (nameStr.startsWith('scheme_')) {
        const schemeIdBytes = box.name.slice(7)
        const schemeId = algosdk.bytesToBigInt(new Uint8Array(schemeIdBytes))
        const schemeData = await readSchemeBox(appID, schemeId)
        if (schemeData) {
          schemes.push({ schemeId, ...schemeData })
        }
      }
    }

    return schemes
  } catch {
    return []
  }
}

// ─── Contract Info Helpers ────────────────────────────────────────────────────

/**
 * Get factory contract's escrow balance
 */
export async function getFactoryBalance(appID) {
  const algod = getAlgodClient()
  const appAddress = algosdk.getApplicationAddress(appID)

  try {
    const accountInfo = await algod.accountInformation(appAddress).do()
    return {
      balance: accountInfo.amount,
      minBalance: accountInfo['min-balance'],
      available: accountInfo.amount - accountInfo['min-balance'],
    }
  } catch {
    return { balance: 0, minBalance: 0, available: 0 }
  }
}

/**
 * Get application address from app ID
 */
export function getAppAddress(appID) {
  return algosdk.getApplicationAddress(appID)
}

/**
 * Check if address is authorized to perform admin operations
 */
export async function isAuthorizedAdmin(address, appID) {
  const algod = getAlgodClient()

  try {
    const appInfo = await algod.getApplicationByID(appID).do()
    const globalState = appInfo.params['global-state'] || []

    // Check primary authority
    const authorityEntry = globalState.find(e =>
      Buffer.from(e.key, 'base64').toString() === 'authority'
    )
    if (authorityEntry) {
      const authorityAddr = algosdk.encodeAddress(
        new Uint8Array(Buffer.from(authorityEntry.value.bytes, 'base64'))
      )
      if (authorityAddr === address) return { authorized: true, role: 'primary' }
    }

    // Check secondary authorities (stored in boxes or additional global state)
    // Implementation depends on contract design

    return { authorized: false, role: null }
  } catch {
    return { authorized: false, role: null }
  }
}

// ─── Event Simulation / Polling ───────────────────────────────────────────────

/**
 * Poll for recent scheme-related transactions
 * Since Algorand doesn't have native events, we poll the indexer
 * 
 * @param {number} appID     Factory app ID
 * @param {number} limit     Max transactions to fetch
 * @param {string} afterTxID Only get transactions after this ID
 */
export async function pollSchemeTransactions(appID, limit = 20, afterTxID = null) {
  const INDEXER_BASE = 'https://testnet-idx.algonode.cloud/v2'

  let url = `${INDEXER_BASE}/transactions?application-id=${appID}&limit=${limit}`
  if (afterTxID) {
    url += `&after-tx-id=${afterTxID}`
  }

  try {
    const res = await fetch(url)
    if (!res.ok) return []

    const data = await res.json()
    return (data.transactions || []).map(tx => ({
      id: tx.id,
      type: tx['tx-type'],
      sender: tx.sender,
      roundTime: tx['round-time'],
      confirmedRound: tx['confirmed-round'],
      appArgs: tx['application-transaction']?.['application-args']?.map(arg =>
        Buffer.from(arg, 'base64').toString('utf-8')
      ),
      logs: tx.logs?.map(log => Buffer.from(log, 'base64').toString('utf-8')),
    }))
  } catch {
    return []
  }
}

// ─── Export summary ───────────────────────────────────────────────────────────

export default {
  // Deployment
  deploySchemeFactory,
  fundFactoryEscrow,

  // Configuration
  SchemeConfigTemplate,
  validateSchemeConfig,
  updateAuthority,
  addSecondaryAuthority,
  removeSecondaryAuthority,

  // Box Storage
  createSchemeBox,
  readSchemeBox,
  listAllSchemeBoxes,
  SCHEME_BOX_SIZE,

  // Info
  getFactoryBalance,
  getAppAddress,
  isAuthorizedAdmin,
  pollSchemeTransactions,

  // Schema
  GLOBAL_SCHEMA,
  LOCAL_SCHEMA,
}
