/**
 * algorand.js — Algorand TestNet Indexer + Algod API helpers
 *
 * All calls go to public AlgoNode TestNet endpoints.
 * No private keys, no signing — read-only except for transaction building
 * (signing is delegated exclusively to Pera Wallet).
 *
 * TestNet nodes:
 *   Indexer : https://testnet-idx.algonode.cloud
 *   Algod   : https://testnet-api.algonode.cloud
 */

const INDEXER_BASE = 'https://testnet-idx.algonode.cloud/v2'
const ALGOD_BASE   = 'https://testnet-api.algonode.cloud/v2'

// ─── Internal fetch helper ────────────────────────────────────────────────────
async function get(url) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`Algorand API error ${res.status}: ${url}`)
  return res.json()
}

// ─── Format helpers ───────────────────────────────────────────────────────────

/** Convert microAlgos → ALGO (6 decimals) */
export function microToAlgo(microAlgos) {
  return (microAlgos / 1_000_000).toFixed(4)
}

/** Shorten an Algorand address for display: ABCDE...WXYZ */
export function shortAddr(addr) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Unix timestamp → readable date */
export function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

// ─── Account ──────────────────────────────────────────────────────────────────

/**
 * Fetch account info including ALGO balance and asset holdings.
 * @param {string} address
 * @returns {{ balance: string, minBalance: string, assets: Array, status: string }}
 */
export async function getAccountInfo(address) {
  const data = await get(`${INDEXER_BASE}/accounts/${address}`)
  const acc  = data.account

  return {
    balance:    microToAlgo(acc.amount ?? 0),
    minBalance: microToAlgo(acc['min-balance'] ?? 0),
    status:     acc.status ?? 'Offline',
    rewards:    microToAlgo(acc.rewards ?? 0),
    // assets: array of { assetId, amount, frozen }
    assets: (acc.assets ?? []).map(a => ({
      assetId: a['asset-id'],
      amount:  a.amount,
      frozen:  a['is-frozen'],
    })),
  }
}

// ─── Transactions ─────────────────────────────────────────────────────────────

/**
 * Fetch last N transactions for an address.
 * @param {string} address
 * @param {number} limit  default 10
 * @returns {Array}
 */
export async function getRecentTransactions(address, limit = 10) {
  const data = await get(
    `${INDEXER_BASE}/accounts/${address}/transactions?limit=${limit}`
  )
  return (data.transactions ?? []).map(tx => ({
    id:        tx.id,
    type:      tx['tx-type'],           // pay, axfer, appl, ...
    roundTime: tx['round-time'],
    sender:    tx.sender,
    // payment fields
    receiver:  tx['payment-transaction']?.receiver ?? null,
    amount:    tx['payment-transaction']?.amount ?? 0,
    // asset transfer fields
    assetId:   tx['asset-transfer-transaction']?.['asset-id'] ?? null,
    assetAmt:  tx['asset-transfer-transaction']?.amount ?? 0,
    assetRcv:  tx['asset-transfer-transaction']?.receiver ?? null,
    fee:       tx.fee,
    note:      tx.note ? atob(tx.note) : null,  // base64 note field
  }))
}

// ─── Assets ───────────────────────────────────────────────────────────────────

/**
 * Fetch asset metadata from Indexer for a given asset ID.
 * Returns name, unit-name, decimals, total, url, whether it looks like an NFT.
 */
export async function getAssetInfo(assetId) {
  try {
    const data = await get(`${INDEXER_BASE}/assets/${assetId}`)
    const p = data.asset?.params ?? {}
    return {
      assetId,
      name:     p.name              ?? `Asset #${assetId}`,
      unitName: p['unit-name']      ?? '???',
      decimals: p.decimals          ?? 0,
      total:    p.total             ?? 0,
      url:      p.url               ?? null,
      reserve:  p.reserve           ?? null,
      // Heuristic: total supply == 1 and decimals == 0 → likely NFT
      isNFT:    p.total === 1 && p.decimals === 0,
    }
  } catch {
    return { assetId, name: `Asset #${assetId}`, unitName: '???', decimals: 0, total: 0, url: null, isNFT: false }
  }
}

/**
 * Enrich an array of asset holdings with metadata.
 * Limits to first 20 to avoid rate-limiting on public nodes.
 */
export async function getEnrichedAssets(holdings) {
  const slice = holdings.slice(0, 20)
  return Promise.all(slice.map(async h => {
    const meta = await getAssetInfo(h.assetId)
    const displayAmount = h.amount / Math.pow(10, meta.decimals)
    return { ...meta, ...h, displayAmount }
  }))
}

// ─── Network status ───────────────────────────────────────────────────────────

/** Returns the current TestNet round (block height). */
export async function getNetworkStatus() {
  try {
    const data = await get(`${ALGOD_BASE}/status`)
    return {
      lastRound:    data['last-round'],
      catchupTime:  data['catchup-time'],
      network:      'TestNet',
    }
  } catch {
    return { lastRound: null, network: 'TestNet' }
  }
}
