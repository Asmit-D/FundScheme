/* ─────────────────────────────────────────────
   ExcessScheme — Landing Page JS (main.js)
───────────────────────────────────────────── */

/* ── NETWORK CANVAS  ── */
const canvas = document.getElementById('networkCanvas');
const ctx    = canvas ? canvas.getContext('2d') : null;
let nodes = [], W, H, animId;

function initCanvas() {
  if (!canvas) return;
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  nodes = Array.from({length: 60}, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - .5) * .4,
    vy: (Math.random() - .5) * .4,
    r: Math.random() * 2 + 1
  }));
}

function drawNetwork() {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  // Move
  nodes.forEach(n => {
    n.x += n.vx; n.y += n.vy;
    if (n.x < 0 || n.x > W) n.vx *= -1;
    if (n.y < 0 || n.y > H) n.vy *= -1;
  });
  // Lines
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d  = Math.sqrt(dx*dx + dy*dy);
      if (d < 120) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.strokeStyle = `rgba(0,232,198,${.12 * (1 - d/120)})`;
        ctx.lineWidth = .6;
        ctx.stroke();
      }
    }
  }
  // Dots
  nodes.forEach(n => {
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,232,198,.35)';
    ctx.fill();
  });
  animId = requestAnimationFrame(drawNetwork);
}

window.addEventListener('resize', initCanvas);
initCanvas();
drawNetwork();

/* ── COUNTER ANIMATION ── */
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target    = parseFloat(el.dataset.count);
    const prefix    = el.dataset.prefix || '';
    const suffix    = el.dataset.suffix || '';
    const isShort   = el.dataset.short === 'true';
    const duration  = 1800;
    const start     = performance.now();

    function format(val) {
      if (isShort) {
        if (val >= 1e9)  return prefix + (val/1e9).toFixed(1) + 'B' + suffix;
        if (val >= 1e7)  return prefix + (val/1e7).toFixed(1) + 'Cr' + suffix;
        if (val >= 1e5)  return prefix + (val/1e5).toFixed(1) + 'L' + suffix;
        return prefix + val.toLocaleString('en-IN') + suffix;
      }
      if (Number.isInteger(target)) return prefix + Math.round(val).toLocaleString('en-IN') + suffix;
      return prefix + val.toFixed(1) + suffix;
    }

    function step(ts) {
      const progress = Math.min((ts - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = format(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

const counterObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { animateCounters(); counterObs.disconnect(); } });
}, { threshold: .3 });
const statsEl = document.querySelector('.hero-stats');
if (statsEl) counterObs.observe(statsEl);

/* ── LOGIN MODAL ── */
let currentRole = 'gov';

function openLogin(role) {
  currentRole = role;
  const modal    = document.getElementById('loginModal');
  const title    = document.getElementById('modalTitle');
  const sub      = document.getElementById('modalSub');
  const idInput  = document.getElementById('loginId');
  if (role === 'gov') {
    title.textContent    = 'Government Officer Login';
    sub.textContent      = 'Access the Gov Scheme Management Portal';
    idInput.placeholder  = 'Officer ID — e.g. GOV-2026-001';
  } else {
    title.textContent    = 'Student Login';
    sub.textContent      = 'Access your Scholarship Portal';
    idInput.placeholder  = 'Student ID — e.g. STU-2026-0042';
  }
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLogin() {
  document.getElementById('loginModal').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('loginModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeLogin();
});

function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Authenticating…';
  btn.disabled = true;
  setTimeout(() => {
    closeLogin();
    window.location.href = currentRole === 'gov' ? 'gov-dashboard.html' : 'user-dashboard.html';
  }, 1200);
}

/* ── SMOOTH NAV ── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({behavior:'smooth'}); }
  });
});

/* ── NAVBAR SCROLL ── */
window.addEventListener('scroll', () => {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  nav.style.background = window.scrollY > 30
    ? (light ? 'rgba(240,247,245,.98)' : 'rgba(5,10,14,.96)')
    : (light ? 'rgba(240,247,245,.88)' : 'rgba(5,10,14,.82)');
});
