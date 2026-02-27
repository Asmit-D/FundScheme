/**
 * citizen-token.js
 *
 * Algorand TestNet — Citizen Identity Token (CIT) Contract
 * App ID: 755808344 (placeholder — deploy your own contract)
 *
 * This module handles tokenization of citizen identity for verified beneficiaries.
 * Each citizen gets a unique on-chain identity token that represents their:
 *  • Aadhaar verification status
 *  • KYC completion level
 *  • Eligibility flags
 *
 * Rules enforced:
 *  • NO private keys / mnemonics
 *  • All signing delegated to Pera Wallet
 *  • Identity tokens are non-transferable (soulbound)
 *
 * ABI methods:
 *  mint_identity(name:string, aadhaar_hash:string)  → creates identity NFT
 *  verify_kyc(citizen:account, level:uint64)        → authority verifies KYC
 *  update_eligibility(citizen:account, flags:uint64) → update eligibility
 *  revoke_identity(citizen:account)                 → authority revokes token
 */

import algosdk from 'algosdk'
import { getPeraWallet } from './perawallet'
import { getAlgodClient, APP_ID as SCHOLARSHIP_APP_ID } from './scholarship-contract'

// ─── Constants ────────────────────────────────────────────────────────────────

export const CITIZEN_APP_ID = 755808344  // Replace with deployed app ID
export const IDENTITY_ASSET_ID = null     // Set after ASA creation

// KYC Levels
export const KYC_LEVELS = {
  NONE: 0,
  BASIC: 1,        // Name + DOB verified
  STANDARD: 2,     // + Address + Photo ID
  ADVANCED: 3,     // + Biometric + Aadhaar
  COMPLETE: 4      // + Bank account + Income verified
}

// Eligibility Flags (bitmask)
export const ELIGIBILITY_FLAGS = {
  SC_CATEGORY:     0b00000001,
  ST_CATEGORY:     0b00000010,
  OBC_CATEGORY:    0b00000100,
  MINORITY:        0b00001000,
  FEMALE:          0b00010000,
  DISABLED:        0b00100000,
  BPL:             0b01000000,
  MERIT_QUALIFIED: 0b10000000
}

// ─── ABI Method descriptors ───────────────────────────────────────────────────

const METHOD_MINT_IDENTITY = algosdk.ABIMethod.fromSignature('mint_identity(string,string)uint64')
const METHOD_VERIFY_KYC    = algosdk.ABIMethod.fromSignature('verify_kyc(account,uint64)void')
const METHOD_UPDATE_ELIG   = algosdk.ABIMethod.fromSignature('update_eligibility(account,uint64)void')
const METHOD_REVOKE        = algosdk.ABIMethod.fromSignature('revoke_identity(account)void')
const METHOD_GET_IDENTITY  = algosdk.ABIMethod.fromSignature('get_identity(account)(string,string,uint64,uint64,bool)')

// ─── Pera Wallet Signer ───────────────────────────────────────────────────────

/**
 * Build Pera Wallet signer for citizen operations
 */
export function makeCitizenSigner(signerAddress) {
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
  const algod  = getAlgodClient()
  const params = await algod.getTransactionParams().do()
  return { algod, params, atc: new algosdk.AtomicTransactionComposer() }
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. MINT IDENTITY TOKEN
//     Creates a unique identity NFT for a citizen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mint a new citizen identity token
 * 
 * @param {string} citizenAddress  Citizen's wallet address
 * @param {string} name            Full name (encrypted/hashed for privacy)
 * @param {string} aadhaarHash     SHA256 hash of Aadhaar number
 * @param {Function} signer        Pera wallet signer
 * @returns {Promise<{ txID: string, identityId: bigint }>}
 */
export async function mintIdentityToken(citizenAddress, name, aadhaarHash, signer) {
  const { algod, params, atc } = await _makeATC()

  // Check if already has identity
  const existing = await getCitizenIdentity(citizenAddress)
  if (existing && existing.isActive) {
    throw new Error('Citizen already has an active identity token')
  }

  atc.addMethodCall({
    appID:           CITIZEN_APP_ID,
    method:          METHOD_MINT_IDENTITY,
    sender:          citizenAddress,
    signer,
    suggestedParams: params,
    methodArgs:      [name, aadhaarHash],
  })

  const result = await atc.execute(algod, 4)
  const identityId = result.methodResults[0]?.returnValue

  return { 
    txID: result.txIDs[0],
    identityId: identityId
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. VERIFY KYC
//     Authority verifies citizen's KYC level
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a citizen's KYC level (authority only)
 * 
 * @param {string} authorityAddress  Government authority address
 * @param {string} citizenAddress    Citizen to verify
 * @param {number} kycLevel          KYC_LEVELS value
 * @param {Function} signer          Authority's signer
 * @returns {Promise<{ txID: string }>}
 */
export async function verifyKYC(authorityAddress, citizenAddress, kycLevel, signer) {
  const { algod, params, atc } = await _makeATC()

  atc.addMethodCall({
    appID:           CITIZEN_APP_ID,
    method:          METHOD_VERIFY_KYC,
    sender:          authorityAddress,
    signer,
    suggestedParams: params,
    methodArgs:      [citizenAddress, BigInt(kycLevel)],
    accounts:        [citizenAddress],
  })

  const result = await atc.execute(algod, 4)
  return { txID: result.txIDs[0] }
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. UPDATE ELIGIBILITY FLAGS
//     Authority updates citizen's eligibility for various schemes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update eligibility flags for a citizen
 * 
 * @param {string} authorityAddress  Authority wallet
 * @param {string} citizenAddress    Citizen address
 * @param {number} flags             Bitmask of ELIGIBILITY_FLAGS
 * @param {Function} signer          Authority's signer
 * @returns {Promise<{ txID: string }>}
 */
export async function updateEligibility(authorityAddress, citizenAddress, flags, signer) {
  const { algod, params, atc } = await _makeATC()

  atc.addMethodCall({
    appID:           CITIZEN_APP_ID,
    method:          METHOD_UPDATE_ELIG,
    sender:          authorityAddress,
    signer,
    suggestedParams: params,
    methodArgs:      [citizenAddress, BigInt(flags)],
    accounts:        [citizenAddress],
  })

  const result = await atc.execute(algod, 4)
  return { txID: result.txIDs[0] }
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. REVOKE IDENTITY
//     Authority revokes a citizen's identity token (fraud cases)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Revoke a citizen's identity token
 * 
 * @param {string} authorityAddress  Authority wallet
 * @param {string} citizenAddress    Citizen to revoke
 * @param {Function} signer          Authority's signer
 * @returns {Promise<{ txID: string }>}
 */
export async function revokeIdentity(authorityAddress, citizenAddress, signer) {
  const { algod, params, atc } = await _makeATC()

  atc.addMethodCall({
    appID:           CITIZEN_APP_ID,
    method:          METHOD_REVOKE,
    sender:          authorityAddress,
    signer,
    suggestedParams: params,
    methodArgs:      [citizenAddress],
    accounts:        [citizenAddress],
  })

  const result = await atc.execute(algod, 4)
  return { txID: result.txIDs[0] }
}

// ─────────────────────────────────────────────────────────────────────────────
//  READ HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get citizen identity data from chain
 * 
 * @param {string} citizenAddress
 * @returns {Promise<{ name: string, aadhaarHash: string, kycLevel: number, eligibilityFlags: number, isActive: boolean } | null>}
 */
export async function getCitizenIdentity(citizenAddress) {
  const algod = getAlgodClient()
  
  try {
    const info = await algod.accountApplicationInformation(citizenAddress, CITIZEN_APP_ID).do()
    const raw = info['app-local-state']?.['key-value'] ?? []

    const decode = (key) => {
      const b64 = Buffer.from(key, 'utf8').toString('base64')
      const entry = raw.find((e) => e.key === b64)
      if (!entry) return null
      const v = entry.value
      if (v.type === 1) return Buffer.from(v.bytes, 'base64').toString()
      return BigInt(v.uint)
    }

    const kycLevel = decode('kyc_level')
    const eligFlags = decode('eligibility_flags')
    const isActive = decode('is_active')

    return {
      name: decode('name') || '',
      aadhaarHash: decode('aadhaar_hash') || '',
      kycLevel: kycLevel !== null ? Number(kycLevel) : 0,
      eligibilityFlags: eligFlags !== null ? Number(eligFlags) : 0,
      isActive: isActive === 1n,
    }
  } catch {
    return null
  }
}

/**
 * Check if citizen has opted into identity contract
 */
export async function isIdentityOptedIn(address) {
  const algod = getAlgodClient()
  try {
    const info = await algod.accountApplicationInformation(address, CITIZEN_APP_ID).do()
    return !!info['app-local-state']
  } catch {
    return false
  }
}

/**
 * Opt into the Citizen Identity app
 */
export async function optInToIdentityApp(address, signer) {
  if (await isIdentityOptedIn(address)) {
    throw new Error('Already opted into Citizen Identity app')
  }

  const { algod, params } = await _makeATC()

  const txn = algosdk.makeApplicationOptInTxnFromObject({
    sender:          address,
    appIndex:        CITIZEN_APP_ID,
    suggestedParams: params,
  })

  const signed = await signer([txn], [0])
  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  return { txID: txId }
}

/**
 * Get global stats for citizen identity system
 */
export async function getIdentityGlobalStats() {
  const algod = getAlgodClient()
  
  try {
    const info = await algod.getApplicationByID(CITIZEN_APP_ID).do()
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
      totalIdentities: decode('total_identities') || 0n,
      activeIdentities: decode('active_identities') || 0n,
      revokedCount: decode('revoked_count') || 0n,
      authority: decode('authority') || '',
    }
  } catch {
    return {
      totalIdentities: 0n,
      activeIdentities: 0n,
      revokedCount: 0n,
      authority: '',
    }
  }
}

// ─── Utility: Parse eligibility flags ─────────────────────────────────────────

/**
 * Convert eligibility bitmask to readable array
 */
export function parseEligibilityFlags(flags) {
  const result = []
  if (flags & ELIGIBILITY_FLAGS.SC_CATEGORY) result.push('SC Category')
  if (flags & ELIGIBILITY_FLAGS.ST_CATEGORY) result.push('ST Category')
  if (flags & ELIGIBILITY_FLAGS.OBC_CATEGORY) result.push('OBC Category')
  if (flags & ELIGIBILITY_FLAGS.MINORITY) result.push('Minority')
  if (flags & ELIGIBILITY_FLAGS.FEMALE) result.push('Female')
  if (flags & ELIGIBILITY_FLAGS.DISABLED) result.push('Disabled')
  if (flags & ELIGIBILITY_FLAGS.BPL) result.push('Below Poverty Line')
  if (flags & ELIGIBILITY_FLAGS.MERIT_QUALIFIED) result.push('Merit Qualified')
  return result
}

/**
 * Get KYC level label
 */
export function getKYCLabel(level) {
  const labels = {
    [KYC_LEVELS.NONE]: 'Not Verified',
    [KYC_LEVELS.BASIC]: 'Basic KYC',
    [KYC_LEVELS.STANDARD]: 'Standard KYC',
    [KYC_LEVELS.ADVANCED]: 'Advanced KYC',
    [KYC_LEVELS.COMPLETE]: 'Complete KYC',
  }
  return labels[level] || 'Unknown'
}
