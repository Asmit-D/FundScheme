/**
 * perawallet.js — Pera Wallet Connect wrapper
 *
 * Handles connect / disconnect / session-reconnect.
 * Signing is fully delegated to the Pera Wallet app — no private keys here.
 *
 * Security:
 *   • We ONLY store the wallet address (public data).
 *   • Private keys / mnemonics never touch this code.
 *   • All transaction signing goes through peraWallet.signTransaction().
 */

import { PeraWalletConnect } from '@perawallet/connect'

// Singleton — one instance per page session
let _pera = null

/** Return (or create) the shared PeraWalletConnect instance. */
export function getPeraWallet() {
  if (!_pera) {
    _pera = new PeraWalletConnect({
      chainId: 416002,          // Algorand TestNet chain ID
      shouldShowSignTxnToast: true,
    })
  }
  return _pera
}

// ─── Storage key (address only — never store keys/mnemonics) ─────────────────
const ADDR_KEY = 'pera_connected_address'

export function saveAddress(addr)   { localStorage.setItem(ADDR_KEY, addr) }
export function loadAddress()       { return localStorage.getItem(ADDR_KEY) }
export function clearAddress()      { localStorage.removeItem(ADDR_KEY) }

// ─── Connect ──────────────────────────────────────────────────────────────────

/**
 * Opens the Pera Wallet Connect modal (QR code on desktop, deep-link on mobile).
 * Returns the connected wallet address string, or throws on rejection.
 *
 * @returns {Promise<string>} connected address
 */
export async function connectWallet() {
  const pera = getPeraWallet()

  // Returns an array of accounts — we use the first one
  const accounts = await pera.connect()

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts returned from Pera Wallet')
  }

  const address = accounts[0]
  saveAddress(address)   // persist so we can reconnect on refresh
  return address
}

// ─── Reconnect (on page refresh) ─────────────────────────────────────────────

/**
 * Attempts to silently restore an existing WalletConnect session.
 * Returns the address if a session exists, null otherwise.
 *
 * @returns {Promise<string|null>}
 */
export async function reconnectWallet() {
  const pera = getPeraWallet()
  try {
    const accounts = await pera.reconnectSession()
    if (accounts && accounts.length > 0) {
      const address = accounts[0]
      saveAddress(address)
      return address
    }
  } catch {
    // No previous session — silent fail
  }
  return null
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

/**
 * Disconnects the current Pera Wallet session and clears stored address.
 */
export async function disconnectWallet() {
  const pera = getPeraWallet()
  try {
    await pera.disconnect()
  } catch {
    // Ignore errors on disconnect
  }
  clearAddress()
}

// ─── Sign transactions (example helper) ──────────────────────────────────────

/**
 * Sign one or more transactions via Pera Wallet app.
 * The user approves on their phone — we only receive the signed bytes.
 *
 * @param {Array<{txn: algosdk.Transaction}>} txGroups
 * @returns {Promise<Uint8Array[]>} signed transaction bytes
 */
export async function signTransactions(txGroups) {
  const pera = getPeraWallet()
  return pera.signTransaction([txGroups])
}
