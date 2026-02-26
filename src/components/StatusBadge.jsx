export default function StatusBadge({ status }) {
  const map = {
    'Completed':    'badge-success',
    'Approved':     'badge-success',
    'AI Verified':  'badge-success',
    'verified':     'badge-success',
    'redeemable':   'badge-success',
    'active':       'badge-success',
    'Pending':      'badge-warn',
    'Pending Review':'badge-warn',
    'pending':      'badge-warn',
    'Processing':   'badge-info',
    'draft':        'badge-default',
    'Rejected':     'badge-danger',
    'redeemed':     'badge-default',
  }
  const dot = {
    'badge-success': '●',
    'badge-warn':    '●',
    'badge-danger':  '●',
    'badge-info':    '●',
    'badge-default': '●',
  }
  const cls = map[status] || 'badge-default'
  return <span className={`badge ${cls}`}><span>{dot[cls]}</span>{status}</span>
}
