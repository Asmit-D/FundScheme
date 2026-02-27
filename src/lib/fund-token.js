/**
 * fund-token.js
 *
 * Algorand TestNet — Dynamic Fund & Scheme Token Management
 *
 * This module handles:
 *  • Dynamic scheme smart contract creation
 *  • Scheme token (ASA) minting and distribution
 *  • Multi-scheme treasury management
 *  • Beneficiary fund allocation and release
 *
 * Rules enforced:
 *  • NO private keys / mnemonics
 *  • All signing delegated to Pera Wallet
 *  • Atomic transactions for fund safety
 *
 * ABI methods for Scheme Factory Contract:
 *  create_scheme(name:string, budget:uint64, payout:uint64, deadline:uint64) → uint64 (scheme_id)
 *  fund_scheme(scheme_id:uint64, amount:uint64)                               → void
 *  register_beneficiary(scheme_id:uint64, beneficiary:account)               → void
 *  approve_beneficiary(scheme_id:uint64, beneficiary:account)                → void
 *  release_funds(scheme_id:uint64, beneficiary:account)                      → void
 *  pause_scheme(scheme_id:uint64)                                            → void
 *  resume_scheme(scheme_id:uint64)                                           → void
 *  close_scheme(scheme_id:uint64)                                            → void
 */

import algosdk from 'algosdk'
import { getPeraWallet } from './perawallet'
import { getAlgodClient } from './scholarship-contract'

// ─── Constants ────────────────────────────────────────────────────────────────

export const SCHEME_FACTORY_APP_ID = 755808345  // Placeholder — deploy your own

// Scheme Status Codes
export const SCHEME_STATUS = {
  DRAFT: 0,
  ACTIVE: 1,
  PAUSED: 2,
  COMPLETED: 3,
  CANCELLED: 4
}

// Beneficiary Status Codes
export const BENEFICIARY_STATUS = {
  REGISTERED: 0,
  VERIFIED: 1,
  APPROVED: 2,
  FUNDED: 3,
  REJECTED: 4
}

// Token Types
export const TOKEN_TYPES = {
  SCHOLARSHIP: 'SCHOLARSHIP',
  GRANT: 'GRANT',
  SUBSIDY: 'SUBSIDY',
  FELLOWSHIP: 'FELLOWSHIP'
}

// ─── ABI Method descriptors ───────────────────────────────────────────────────

const METHOD_CREATE_SCHEME = algosdk.ABIMethod.fromSignature(
  'create_scheme(string,uint64,uint64,uint64)uint64'
)
const METHOD_FUND_SCHEME = algosdk.ABIMethod.fromSignature(
  'fund_scheme(uint64,pay)void'
)
const METHOD_REGISTER_BENEFICIARY = algosdk.ABIMethod.fromSignature(
  'register_beneficiary(uint64,account)void'
)
const METHOD_APPROVE_BENEFICIARY = algosdk.ABIMethod.fromSignature(
  'approve_beneficiary(uint64,account)void'
)
const METHOD_RELEASE_FUNDS = algosdk.ABIMethod.fromSignature(
  'release_funds(uint64,account)void'
)
const METHOD_PAUSE_SCHEME = algosdk.ABIMethod.fromSignature(
  'pause_scheme(uint64)void'
)
const METHOD_RESUME_SCHEME = algosdk.ABIMethod.fromSignature(
  'resume_scheme(uint64)void'
)
const METHOD_CLOSE_SCHEME = algosdk.ABIMethod.fromSignature(
  'close_scheme(uint64)void'
)
const METHOD_GET_SCHEME = algosdk.ABIMethod.fromSignature(
  'get_scheme(uint64)(string,uint64,uint64,uint64,uint64,uint64,uint64,address)'
)
const METHOD_GET_BENEFICIARY = algosdk.ABIMethod.fromSignature(
  'get_beneficiary(uint64,account)(uint64,uint64,bool)'
)

// ─── Pera Wallet Signer ───────────────────────────────────────────────────────

/**
 * Build Pera Wallet signer for fund operations
 */
export function makeFundSigner(signerAddress) {
  const pera = getPeraWallet()

  return async (txnGroup, indexesToSign) => {
    const signerTxns = txnGroup.map((txn, i) => {
      const entry = { txn }
      if (!indexesToSign.includes(i)) {
        entry.signers = []
      }
      return entry
    })

    const signed = await pera.signTransaction([signerTxns])
    return signed.filter((_, i) => indexesToSign.includes(i))
  }
}

// ─── Helper: Build ATC ────────────────────────────────────────────────────────

async function _makeATC() {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()
  return { algod, params, atc: new algosdk.AtomicTransactionComposer() }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCHEME MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new scholarship/fund scheme on-chain
 * 
 * @param {string} authorityAddress  Authority creating the scheme
 * @param {object} schemeConfig      Scheme configuration
 * @param {string} schemeConfig.name           Scheme name (max 32 chars)
 * @param {number} schemeConfig.budgetMicroAlgo Total budget in microAlgos
 * @param {number} schemeConfig.payoutMicroAlgo Per-beneficiary payout in microAlgos
 * @param {number} schemeConfig.deadline       Unix timestamp for deadline
 * @param {Function} signer           Pera wallet signer
 * @returns {Promise<{ txID: string, schemeId: bigint }>}
 */
export async function createScheme(authorityAddress, schemeConfig, signer) {
  const { algod, params, atc } = await _makeATC()

  const { name, budgetMicroAlgo, payoutMicroAlgo, deadline } = schemeConfig

  // Validate inputs
  if (!name || name.length > 64) {
    throw new Error('Scheme name must be 1-64 characters')
  }
  if (budgetMicroAlgo < payoutMicroAlgo) {
    throw new Error('Budget must be greater than or equal to payout amount')
  }

  atc.addMethodCall({
    appID: SCHEME_FACTORY_APP_ID,
    method: METHOD_CREATE_SCHEME,
    sender: authorityAddress,
    signer,
    suggestedParams: params,
    methodArgs: [
      name,
      BigInt(budgetMicroAlgo),
      BigInt(payoutMicroAlgo),
      BigInt(deadline)
    ],
  })

  const result = await atc.execute(algod, 4)
  const schemeId = result.methodResults[0]?.returnValue

  return {
    txID: result.txIDs[0],
    schemeId: schemeId
  }
}

/**
 * Fund an existing scheme with ALGO
 * 
 * @param {string} funderAddress  Address funding the scheme
 * @param {bigint} schemeId       Scheme ID
 * @param {number} amountMicroAlgo Amount to fund in microAlgos
 * @param {Function} signer       Pera wallet signer
 * @returns {Promise<{ txID: string }>}
 */
export async function fundScheme(funderAddress, schemeId, amountMicroAlgo, signer) {
  const { algod, params, atc } = await _makeATC()

  // Get the application address (escrow)
  const appAddr = algosdk.getApplicationAddress(SCHEME_FACTORY_APP_ID)

  // Create payment transaction to the app address
  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: funderAddress,
    receiver: appAddr,
    amount: BigInt(amountMicroAlgo),
    suggestedParams: params,
  })

  atc.addMethodCall({
    appID: SCHEME_FACTORY_APP_ID,
    method: METHOD_FUND_SCHEME,
    sender: funderAddress,
    signer,
    suggestedParams: params,
    methodArgs: [BigInt(schemeId), { txn: payTxn, signer }],
  })

  const result = await atc.execute(algod, 4)
  return { txID: result.txIDs[0] }
}

/**
 * Pause an active scheme
 */
export async function pauseScheme(authorityAddress, schemeId, signer) {
  const { algod, params, atc } = await _makeATC()

  atc.addMethodCall({
    appID: SCHEME_FACTORY_APP_ID,
    method: METHOD_PAUSE_SCHEME,
    sender: authorityAddress,
    signer,
    suggestedParams: params,
    methodArgs: [BigInt(schemeId)],
  })

  const result = await atc.execute(algod, 4)
  return { txID: result.txIDs[0] }
}

/**
 * Resume a paused scheme
 */
export async function resumeScheme(authorityAddress, schemeId, signer) {
  const { algod, params, atc } = await _makeATC()

  atc.addMethodCall({
    appID: SCHEME_FACTORY_APP_ID,
    method: METHOD_RESUME_SCHEME,
    sender: authorityAddress,
    signer,
    suggestedParams: params,
    methodArgs: [BigInt(schemeId)],
  })

  const result = await atc.execute(algod, 4)
  return { txID: result.txIDs[0] }
}

/**
 * Close a scheme and return remaining funds to authority
 */
export async function closeScheme(authorityAddress, schemeId, signer) {
  const { algod, params, atc } = await _makeATC()

  // Need extra fee for inner transaction that returns funds
  const paramsWithFee = { ...params, fee: 2000, flatFee: true }

  atc.addMethodCall({
    appID: SCHEME_FACTORY_APP_ID,
    method: METHOD_CLOSE_SCHEME,
    sender: authorityAddress,
    signer,
    suggestedParams: paramsWithFee,
    methodArgs: [BigInt(schemeId)],
  })

  const result = await atc.execute(algod, 4)
  return { txID: result.txIDs[0] }
}

// ─────────────────────────────────────────────────────────────────────────────
//  BENEFICIARY MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a beneficiary for a scheme
 * 
 * @param {string} beneficiaryAddress  Beneficiary wallet
 * @param {bigint} schemeId            Scheme to register for
 * @param {Function} signer            Beneficiary's signer
 * @returns {Promise<{ txID: string }>}
 */
export async function registerBeneficiary(beneficiaryAddress, schemeId, signer) {
  const { algod, params, atc } = await _makeATC()

  atc.addMethodCall({
    appID: SCHEME_FACTORY_APP_ID,
    method: METHOD_REGISTER_BENEFICIARY,
    sender: beneficiaryAddress,
    signer,
    suggestedParams: params,
    methodArgs: [BigInt(schemeId), beneficiaryAddress],
    accounts: [beneficiaryAddress],
  })

  const result = await atc.execute(algod, 4)
  return { txID: result.txIDs[0] }
}

/**
 * Approve a registered beneficiary (authority only)
 * 
 * @param {string} authorityAddress  Authority wallet
 * @param {bigint} schemeId          Scheme ID
 * @param {string} beneficiaryAddress Beneficiary to approve
 * @param {Function} signer          Authority's signer
 * @returns {Promise<{ txID: string }>}
 */
export async function approveBeneficiary(authorityAddress, schemeId, beneficiaryAddress, signer) {
  const { algod, params, atc } = await _makeATC()

  atc.addMethodCall({
    appID: SCHEME_FACTORY_APP_ID,
    method: METHOD_APPROVE_BENEFICIARY,
    sender: authorityAddress,
    signer,
    suggestedParams: params,
    methodArgs: [BigInt(schemeId), beneficiaryAddress],
    accounts: [beneficiaryAddress],
  })

  const result = await atc.execute(algod, 4)
  return { txID: result.txIDs[0] }
}

/**
 * Release funds to an approved beneficiary
 * 
 * @param {string} callerAddress     Caller (authority or beneficiary)
 * @param {bigint} schemeId          Scheme ID
 * @param {string} beneficiaryAddress Beneficiary receiving funds
 * @param {Function} signer          Caller's signer
 * @returns {Promise<{ txID: string }>}
 */
export async function releaseFunds(callerAddress, schemeId, beneficiaryAddress, signer) {
  const { algod, params, atc } = await _makeATC()

  // Extra fee for inner payment transaction
  const paramsWithFee = { ...params, fee: 2000, flatFee: true }

  atc.addMethodCall({
    appID: SCHEME_FACTORY_APP_ID,
    method: METHOD_RELEASE_FUNDS,
    sender: callerAddress,
    signer,
    suggestedParams: paramsWithFee,
    methodArgs: [BigInt(schemeId), beneficiaryAddress],
    accounts: [beneficiaryAddress],
  })

  const result = await atc.execute(algod, 4)
  return { txID: result.txIDs[0] }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ASA TOKEN CREATION — Scheme-specific tokens
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a scheme-specific ASA token for tracking disbursements
 * 
 * @param {string} authorityAddress  Token creator/manager
 * @param {object} tokenConfig       Token configuration
 * @param {string} tokenConfig.name       Full token name (e.g., "NSP Merit 2026 Token")
 * @param {string} tokenConfig.unitName   Short unit name (e.g., "NSPM26")
 * @param {number} tokenConfig.total      Total supply
 * @param {number} tokenConfig.decimals   Decimal places (0 for whole tokens)
 * @param {string} tokenConfig.url        Metadata URL (IPFS or scheme info page)
 * @param {string} tokenConfig.metadataHash SHA256 hash of metadata (optional)
 * @param {Function} signer          Pera wallet signer
 * @returns {Promise<{ txID: string, assetId: number }>}
 */
export async function createSchemeToken(authorityAddress, tokenConfig, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  const {
    name,
    unitName,
    total,
    decimals = 0,
    url = '',
    metadataHash = undefined
  } = tokenConfig

  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: authorityAddress,
    assetName: name,
    unitName: unitName,
    total: BigInt(total),
    decimals: decimals,
    defaultFrozen: false,
    manager: authorityAddress,
    reserve: authorityAddress,
    freeze: authorityAddress,
    clawback: authorityAddress,
    assetURL: url,
    assetMetadataHash: metadataHash,
    suggestedParams: params,
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()

  // Wait for confirmation and get the asset ID
  const confirmedTxn = await algosdk.waitForConfirmation(algod, txId, 4)
  const assetId = confirmedTxn['asset-index']

  return { txID: txId, assetId }
}

/**
 * Mint (transfer) scheme tokens to beneficiaries
 * 
 * @param {string} authorityAddress  Token holder/sender
 * @param {number} assetId           ASA asset ID
 * @param {string} recipientAddress  Beneficiary receiving tokens
 * @param {number} amount            Number of tokens to transfer
 * @param {Function} signer          Authority's signer
 * @returns {Promise<{ txID: string }>}
 */
export async function mintSchemeTokens(authorityAddress, assetId, recipientAddress, amount, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: authorityAddress,
    receiver: recipientAddress,
    assetIndex: assetId,
    amount: BigInt(amount),
    suggestedParams: params,
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  return { txID: txId }
}

/**
 * Opt-in to receive a scheme token
 * 
 * @param {string} userAddress  User opting in
 * @param {number} assetId      ASA asset ID
 * @param {Function} signer     User's signer
 * @returns {Promise<{ txID: string }>}
 */
export async function optInToToken(userAddress, assetId, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  // Opt-in is a 0-amount transfer to self
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: userAddress,
    receiver: userAddress,
    assetIndex: assetId,
    amount: 0n,
    suggestedParams: params,
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  return { txID: txId }
}

/**
 * Check if user has opted into a token
 */
export async function isOptedInToToken(address, assetId) {
  const algod = getAlgodClient()
  try {
    const info = await algod.accountAssetInformation(address, assetId).do()
    return !!info['asset-holding']
  } catch {
    return false
  }
}

/**
 * Clawback tokens from a beneficiary (for fraud cases)
 * 
 * @param {string} authorityAddress  Clawback authority
 * @param {number} assetId           ASA asset ID
 * @param {string} fromAddress       Address to clawback from
 * @param {number} amount            Amount to clawback
 * @param {Function} signer          Authority's signer
 * @returns {Promise<{ txID: string }>}
 */
export async function clawbackTokens(authorityAddress, assetId, fromAddress, amount, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: authorityAddress,
    receiver: authorityAddress,  // Clawback to authority
    assetIndex: assetId,
    amount: BigInt(amount),
    revocationTarget: fromAddress,
    suggestedParams: params,
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  return { txID: txId }
}

/**
 * Freeze a beneficiary's token holding
 */
export async function freezeTokens(authorityAddress, assetId, targetAddress, freeze, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  const txn = algosdk.makeAssetFreezeTxnWithSuggestedParamsFromObject({
    sender: authorityAddress,
    assetIndex: assetId,
    freezeTarget: targetAddress,
    freezeState: freeze,
    suggestedParams: params,
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  return { txID: txId }
}

// ─────────────────────────────────────────────────────────────────────────────
//  BATCH OPERATIONS — Atomic multi-beneficiary disbursements
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Batch mint tokens to multiple beneficiaries atomically
 * 
 * @param {string} authorityAddress  Token holder
 * @param {number} assetId           ASA asset ID
 * @param {Array<{address: string, amount: number}>} recipients Recipients array
 * @param {Function} signer          Authority's signer
 * @returns {Promise<{ txIDs: string[] }>}
 */
export async function batchMintTokens(authorityAddress, assetId, recipients, signer) {
  const algod = getAlgodClient()
  const params = await algod.getTransactionParams().do()

  // Algorand supports up to 16 transactions in an atomic group
  if (recipients.length > 16) {
    throw new Error('Batch size cannot exceed 16 recipients per atomic group')
  }

  const atc = new algosdk.AtomicTransactionComposer()

  for (const recipient of recipients) {
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: authorityAddress,
      receiver: recipient.address,
      assetIndex: assetId,
      amount: BigInt(recipient.amount),
      suggestedParams: params,
    })
    atc.addTransaction({ txn, signer })
  }

  const result = await atc.execute(algod, 4)
  return { txIDs: result.txIDs }
}

/**
 * Batch release funds to multiple beneficiaries
 * 
 * @param {string} authorityAddress  Authority wallet
 * @param {bigint} schemeId          Scheme ID
 * @param {string[]} beneficiaries   Array of beneficiary addresses
 * @param {Function} signer          Authority's signer
 * @returns {Promise<{ txIDs: string[] }>}
 */
export async function batchReleaseFunds(authorityAddress, schemeId, beneficiaries, signer) {
  const { algod, params, atc } = await _makeATC()

  if (beneficiaries.length > 4) {
    throw new Error('Batch size limited to 4 for fund releases (inner txn fee limits)')
  }

  // Each release needs extra fee for inner transaction
  const paramsWithFee = { ...params, fee: 2000, flatFee: true }

  for (const beneficiary of beneficiaries) {
    atc.addMethodCall({
      appID: SCHEME_FACTORY_APP_ID,
      method: METHOD_RELEASE_FUNDS,
      sender: authorityAddress,
      signer,
      suggestedParams: paramsWithFee,
      methodArgs: [BigInt(schemeId), beneficiary],
      accounts: [beneficiary],
    })
  }

  const result = await atc.execute(algod, 4)
  return { txIDs: result.txIDs }
}

// ─────────────────────────────────────────────────────────────────────────────
//  READ HELPERS — Query on-chain state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get scheme details from chain
 * 
 * @param {bigint} schemeId
 * @returns {Promise<{name: string, budget: bigint, payout: bigint, deadline: bigint, status: number, funded: bigint, spent: bigint, authority: string} | null>}
 */
export async function getSchemeDetails(schemeId) {
  const algod = getAlgodClient()

  try {
    const info = await algod.getApplicationByID(SCHEME_FACTORY_APP_ID).do()
    const raw = info.params['global-state'] ?? []

    // Look for scheme data in box storage (if using boxes)
    // or parse from global state
    const boxName = new Uint8Array([...Buffer.from('scheme_'), ...algosdk.bigIntToBytes(schemeId, 8)])
    
    try {
      const boxData = await algod.getApplicationBoxByName(SCHEME_FACTORY_APP_ID, boxName).do()
      // Parse box data based on contract structure
      const decoder = new TextDecoder()
      const data = boxData.value
      
      // Example parsing (adjust based on actual contract encoding)
      return {
        schemeId,
        name: decoder.decode(data.slice(0, 64)).replace(/\0/g, '').trim(),
        budget: algosdk.bytesToBigInt(data.slice(64, 72)),
        payout: algosdk.bytesToBigInt(data.slice(72, 80)),
        deadline: algosdk.bytesToBigInt(data.slice(80, 88)),
        status: Number(algosdk.bytesToBigInt(data.slice(88, 96))),
        funded: algosdk.bytesToBigInt(data.slice(96, 104)),
        spent: algosdk.bytesToBigInt(data.slice(104, 112)),
        authority: algosdk.encodeAddress(data.slice(112, 144)),
      }
    } catch {
      // Box not found, try global state fallback
      return null
    }
  } catch {
    return null
  }
}

/**
 * Get beneficiary status for a scheme
 */
export async function getBeneficiaryStatus(schemeId, beneficiaryAddress) {
  const algod = getAlgodClient()

  try {
    // Check local state of beneficiary in factory app
    const info = await algod.accountApplicationInformation(
      beneficiaryAddress, 
      SCHEME_FACTORY_APP_ID
    ).do()
    
    const raw = info['app-local-state']?.['key-value'] ?? []

    const decode = (key) => {
      const b64 = Buffer.from(key, 'utf8').toString('base64')
      const entry = raw.find((e) => e.key === b64)
      return entry ? BigInt(entry.value.uint) : 0n
    }

    return {
      schemeId: decode(`scheme_${schemeId}_id`),
      status: Number(decode(`scheme_${schemeId}_status`)),
      amountReceived: decode(`scheme_${schemeId}_received`),
    }
  } catch {
    return null
  }
}

/**
 * Get all schemes from factory contract
 */
export async function getAllSchemes() {
  const algod = getAlgodClient()

  try {
    const info = await algod.getApplicationByID(SCHEME_FACTORY_APP_ID).do()
    const raw = info.params['global-state'] ?? []

    const decode = (key) => {
      const entry = raw.find(
        (e) => Buffer.from(e.key, 'base64').toString('utf8') === key
      )
      if (!entry) return null
      const v = entry.value
      if (v.type === 1) return Buffer.from(v.bytes, 'base64').toString()
      return BigInt(v.uint)
    }

    const schemeCount = decode('scheme_count') || 0n
    const schemes = []

    // Try to get box data for each scheme
    for (let i = 1n; i <= schemeCount; i++) {
      const details = await getSchemeDetails(i)
      if (details) schemes.push(details)
    }

    return {
      totalSchemes: Number(schemeCount),
      schemes,
    }
  } catch {
    return { totalSchemes: 0, schemes: [] }
  }
}

/**
 * Get factory contract global stats
 */
export async function getFactoryStats() {
  const algod = getAlgodClient()

  try {
    const info = await algod.getApplicationByID(SCHEME_FACTORY_APP_ID).do()
    const raw = info.params['global-state'] ?? []

    const decode = (key) => {
      const entry = raw.find(
        (e) => Buffer.from(e.key, 'base64').toString('utf8') === key
      )
      if (!entry) return null
      const v = entry.value
      if (v.type === 1) return Buffer.from(v.bytes, 'base64').toString()
      return BigInt(v.uint)
    }

    return {
      totalSchemes: decode('scheme_count') || 0n,
      totalFunded: decode('total_funded') || 0n,
      totalDisbursed: decode('total_disbursed') || 0n,
      totalBeneficiaries: decode('total_beneficiaries') || 0n,
      authority: decode('authority') || '',
    }
  } catch {
    return {
      totalSchemes: 0n,
      totalFunded: 0n,
      totalDisbursed: 0n,
      totalBeneficiaries: 0n,
      authority: '',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert INR to microAlgo (approximate based on current rate)
 * @param {number} inr Amount in INR
 * @param {number} algoInrRate Current ALGO/INR rate (default ~100)
 */
export function inrToMicroAlgo(inr, algoInrRate = 100) {
  const algo = inr / algoInrRate
  return Math.floor(algo * 1_000_000)
}

/**
 * Convert microAlgo to INR
 */
export function microAlgoToInr(microAlgo, algoInrRate = 100) {
  const algo = microAlgo / 1_000_000
  return Math.floor(algo * algoInrRate)
}

/**
 * Format scheme status code to label
 */
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

/**
 * Format beneficiary status code to label
 */
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

/**
 * Generate a unique scheme identifier
 */
export function generateSchemeId() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `SCH-${timestamp}-${random}`.toUpperCase()
}

/**
 * Generate scheme token unit name from scheme name
 */
export function generateTokenUnitName(schemeName) {
  // Take first letters of each word, max 8 chars
  const words = schemeName.split(/\s+/).filter(w => w.length > 0)
  let unit = words.map(w => w[0]).join('').toUpperCase()
  
  // Add year suffix
  const year = new Date().getFullYear().toString().slice(-2)
  unit = (unit + year).slice(0, 8)
  
  return unit
}
