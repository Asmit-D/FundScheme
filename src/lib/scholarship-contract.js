/**
 * scholarship-contract.js
 *
 * Algorand TestNet — ScholarshipTreasury integration (App ID: 755808343)
 *
 * Rules this file enforces:
 *  • NO private keys / mnemonics
 *  • NO direct ALGO payment transactions — all payments flow through
 *    the contract's release_payout inner transaction only
 *  • All signing is delegated exclusively to Pera Wallet
 *
 * ABI methods exposed by the contract:
 *  register_student()                     → student opts-in then registers
 *  mark_milestone_complete(student:account) → authority only
 *  release_payout(student:account)          → triggers inner payment
 *
 * Usage — see bottom of file for example calls.
 */

import algosdk from 'algosdk'
import { getPeraWallet } from './perawallet'

// ─── Constants ────────────────────────────────────────────────────────────────

export const APP_ID      = 755808343
export const ALGOD_SERVER = 'https://testnet-api.algonode.cloud'
export const ALGOD_PORT   = 443
export const ALGOD_TOKEN  = ''   // AlgoNode public endpoints require no token

// ─── Algod client (singleton) ─────────────────────────────────────────────────

let _algod = null

/**
 * Returns a shared algosdk.Algodv2 client pointing at TestNet (AlgoNode).
 * @returns {algosdk.Algodv2}
 */
export function getAlgodClient() {
  if (!_algod) {
    _algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT)
  }
  return _algod
}

// ─── ABI Method descriptors ───────────────────────────────────────────────────
//
// These match EXACTLY the PyTEAL / Beaker method signatures compiled into the
// contract.  If the contract is ever recompiled with different signatures,
// update these strings accordingly.

const METHOD_REGISTER   = algosdk.ABIMethod.fromSignature('register_student()void')
const METHOD_MILESTONE  = algosdk.ABIMethod.fromSignature('mark_milestone_complete(account)void')
const METHOD_PAYOUT     = algosdk.ABIMethod.fromSignature('release_payout(account)void')

// ─── Pera Wallet → ATC signer adapter ────────────────────────────────────────
//
// algosdk's AtomicTransactionComposer expects a TransactionSigner with shape:
//   (txnGroup: Transaction[], indexesToSign: number[]) => Promise<Uint8Array[]>
//
// Pera Wallet's signTransaction expects:
//   [[{ txn: Transaction, signers?: string[] }, …], …]
//
// This adapter bridges the two.

/**
 * Build an algosdk-compatible TransactionSigner backed by Pera Wallet.
 *
 * @param {string} signerAddress  Connected wallet address (for signers field).
 * @returns {algosdk.TransactionSigner}
 */
export function makePeraSigner(signerAddress) {
  const pera = getPeraWallet()

  return async (txnGroup, indexesToSign) => {
    // Build the Pera signerTransaction array — only mark the indexes we need to sign
    const signerTxns = txnGroup.map((txn, i) => {
      const entry = { txn }
      // If this index is NOT in indexesToSign (e.g. a reference txn added by
      // ATC for fee / MBR coverage), tell Pera to skip it by providing an
      // empty signers array.
      if (!indexesToSign.includes(i)) {
        entry.signers = []
      }
      return entry
    })

    // Pera expects an outer array (one inner array per atomic group)
    const signed = await pera.signTransaction([signerTxns])

    // ATC expects only the signatures for the indexes it asked us to sign,
    // in the same order.  Pera returns null for entries with signers=[].
    return signed.filter((_, i) => indexesToSign.includes(i))
  }
}

// ─── Shared ATC builder ───────────────────────────────────────────────────────

/**
 * Internal helper: get suggested params and build a fresh ATC.
 */
async function _makeATC() {
  const algod  = getAlgodClient()
  const params = await algod.getTransactionParams().do()
  return { algod, params, atc: new algosdk.AtomicTransactionComposer() }
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. OPT-IN TO APPLICATION
//     Must happen before register_student — local state is allocated here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether an address has already opted in to the app.
 *
 * @param {string} address
 * @returns {Promise<boolean>}
 */
export async function isOptedIn(address) {
  const algod = getAlgodClient()
  try {
    const info = await algod.accountApplicationInformation(address, APP_ID).do()
    // If the key exists, the account has opted in
    return !!info['app-local-state']
  } catch {
    return false
  }
}

/**
 * Opt the connected wallet into the ScholarshipTreasury application.
 * Allocates local state (3 Uint64 slots).  Required before any other call.
 *
 * @param {string}   address  Connected wallet address
 * @param {Function} signer   algosdk TransactionSigner (use makePeraSigner)
 * @returns {Promise<{ txID: string }>}
 *
 * @throws if already opted in, or if the user rejects in Pera Wallet
 */
export async function optInToApp(address, signer) {
  if (await isOptedIn(address)) {
    throw new Error('Already opted in to ScholarshipTreasury')
  }

  const { algod, params } = await _makeATC()

  const txn = algosdk.makeApplicationOptInTxnFromObject({
    sender:            address,
    appIndex:          APP_ID,
    suggestedParams:   params,
  })

  const signed = await signer([txn], [0])

  const { txId } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txId, 4)

  return { txID: txId }
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. REGISTER STUDENT
//     register_student() — called by the student themselves after opting in.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register the connected wallet as a student in the scheme.
 * Contract asserts: is_registered == 0 (cannot register twice).
 *
 * @param {string}   studentAddress  Connected student wallet address
 * @param {Function} signer          algosdk TransactionSigner
 * @returns {Promise<{ txID: string }>}
 */
export async function registerStudent(studentAddress, signer) {
  if (!(await isOptedIn(studentAddress))) {
    throw new Error('Opt in to the app first before registering')
  }

  const { algod, params, atc } = await _makeATC()

  atc.addMethodCall({
    appID:           APP_ID,
    method:          METHOD_REGISTER,
    sender:          studentAddress,
    signer,
    suggestedParams: params,
    methodArgs:      [],
  })

  const result = await atc.execute(algod, 4)

  return { txID: result.txIDs[0] }
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. MARK MILESTONE COMPLETE
//     mark_milestone_complete(student: account) — authority wallet only.
//     Contract asserts: Txn.sender == authority (global state).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a student's milestone as complete.
 * MUST be called by the authority address stored in global state.
 *
 * @param {string}   authorityAddress  Connected authority wallet
 * @param {string}   studentAddress    The student's wallet address
 * @param {Function} signer            algosdk TransactionSigner
 * @returns {Promise<{ txID: string }>}
 */
export async function markMilestoneComplete(authorityAddress, studentAddress, signer) {
  if (!(await isOptedIn(studentAddress))) {
    throw new Error('Student has not opted in — cannot mark milestone')
  }

  const { algod, params, atc } = await _makeATC()

  atc.addMethodCall({
    appID:           APP_ID,
    method:          METHOD_MILESTONE,
    sender:          authorityAddress,
    signer,
    suggestedParams: params,
    // account-type ABI args are passed as the address string;
    // algosdk encodes them into the accounts array automatically
    methodArgs:      [studentAddress],
    // The student address must also appear in the accounts array so
    // the contract can read their local state
    accounts:        [studentAddress],
  })

  const result = await atc.execute(algod, 4)

  return { txID: result.txIDs[0] }
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. RELEASE PAYOUT
//     release_payout(student: account) — triggers an inner ALGO payment.
//     Contract checks: scheme_active, is_registered, milestone_completed,
//                      has_been_paid == 0, budget not exceeded.
//     The ALGO leaves the CONTRACT ACCOUNT — NOT the caller's wallet.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger the scholarship payout for a student.
 * The contract releases ALGO via an inner transaction — the caller sends
 * ZERO ALGO directly.
 *
 * @param {string}   callerAddress   Address triggering the payout (can be authority or student)
 * @param {string}   studentAddress  Recipient student address
 * @param {Function} signer          algosdk TransactionSigner
 * @returns {Promise<{ txID: string, innerTxID?: string }>}
 */
export async function releasePayout(callerAddress, studentAddress, signer) {
  if (!(await isOptedIn(studentAddress))) {
    throw new Error('Student has not opted in — payout cannot proceed')
  }

  const { algod, params, atc } = await _makeATC()

  // Increase fee to cover the inner transaction (1000 microALGO extra)
  const paramsWithFee = { ...params, fee: 2000, flatFee: true }

  atc.addMethodCall({
    appID:           APP_ID,
    method:          METHOD_PAYOUT,
    sender:          callerAddress,
    signer,
    suggestedParams: paramsWithFee,
    methodArgs:      [studentAddress],
    accounts:        [studentAddress],
  })

  const result = await atc.execute(algod, 4)

  return { txID: result.txIDs[0] }
}

// ─────────────────────────────────────────────────────────────────────────────
//  READ HELPERS — fetch on-chain state without sending transactions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read the contract's global state.
 * @returns {Promise<{ totalBudget: bigint, spentBudget: bigint, payoutAmount: bigint, schemeActive: boolean, authority: string }>}
 */
export async function getGlobalState() {
  const algod = getAlgodClient()
  const info  = await algod.getApplicationByID(APP_ID).do()
  const raw   = info.params['global-state'] ?? []

  const decode = (key) => {
    const entry = raw.find(
      (e) => Buffer.from(e.key, 'base64').toString('utf8') === key
    )
    if (!entry) return null
    const v = entry.value
    if (v.type === 1) return Buffer.from(v.bytes, 'base64').toString()   // bytes → string
    return BigInt(v.uint)                                                 // uint
  }

  return {
    totalBudget:  decode('total_budget'),
    spentBudget:  decode('spent_budget'),
    payoutAmount: decode('payout_amount'),
    schemeActive: decode('scheme_active') === 1n,
    authority:    decode('authority'),
  }
}

/**
 * Read a student's local state for this app.
 * @param {string} studentAddress
 * @returns {Promise<{ isRegistered: boolean, milestoneCompleted: boolean, hasBeenPaid: boolean } | null>}
 */
export async function getStudentState(studentAddress) {
  const algod = getAlgodClient()
  try {
    const info = await algod.accountApplicationInformation(studentAddress, APP_ID).do()
    const raw  = info['app-local-state']?.['key-value'] ?? []

    const decode = (key) => {
      const b64 = Buffer.from(key, 'utf8').toString('base64')
      const entry = raw.find((e) => e.key === b64)
      return entry ? BigInt(entry.value.uint) : 0n
    }

    return {
      isRegistered:       decode('is_registered')       === 1n,
      milestoneCompleted: decode('milestone_completed') === 1n,
      hasBeenPaid:        decode('has_been_paid')       === 1n,
    }
  } catch {
    return null   // not opted in
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXAMPLE USAGE (how a React component would call these)
// ─────────────────────────────────────────────────────────────────────────────
//
//  import {
//    makePeraSigner, optInToApp, registerStudent,
//    markMilestoneComplete, releasePayout,
//    getGlobalState, getStudentState, isOptedIn,
//  } from '../lib/scholarship-contract'
//
//  // Inside a React component that has `address` from Pera Wallet:
//  const signer = makePeraSigner(address)
//
//  // 1. Opt in (once per student)
//  const { txID } = await optInToApp(address, signer)
//
//  // 2. Register as student
//  const { txID } = await registerStudent(address, signer)
//
//  // 3. Authority marks milestone (authority calls with their own signer)
//  const authSigner = makePeraSigner(authorityAddress)
//  const { txID } = await markMilestoneComplete(authorityAddress, studentAddress, authSigner)
//
//  // 4. Trigger payout (contract inner-txn sends ALGO — caller sends 0 ALGO)
//  const { txID } = await releasePayout(authorityAddress, studentAddress, authSigner)
//
//  // Read state without sending a transaction
//  const global  = await getGlobalState()
//  console.log('Scheme active:', global.schemeActive)
//  console.log('Payout per student:', Number(global.payoutAmount) / 1e6, 'ALGO')
//
//  const student = await getStudentState(address)
//  console.log('Registered:', student?.isRegistered)
//  console.log('Milestone:', student?.milestoneCompleted)
//  console.log('Paid:', student?.hasBeenPaid)
