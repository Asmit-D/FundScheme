import { useEffect, useRef } from 'react'

/**
 * Full-screen sparkle canvas — tiny glittering stars that float and fade.
 * Completely passive (pointer-events: none), renders behind all content.
 */
export default function Sparkles() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let W, H
    const SPARKS = []
    const COUNT = 90

    const resize = () => {
      W = canvas.width  = window.innerWidth
      H = canvas.height = document.documentElement.scrollHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // palette: accent teal + blue + white
    const COLORS = ['#00E8C6', '#00A8FF', '#ffffff', '#7FFFEF', '#B0F0FF']

    for (let i = 0; i < COUNT; i++) SPARKS.push(mkSpark(true))

    function mkSpark(randomY = false) {
      return {
        x:     Math.random() * W,
        y:     randomY ? Math.random() * H : -10,
        size:  Math.random() * 2.8 + 0.6,
        speedY: Math.random() * 0.4 + 0.15,
        speedX: (Math.random() - 0.5) * 0.4,
        alpha: Math.random(),
        fade:  Math.random() * 0.008 + 0.002,
        dir:   Math.random() > 0.5 ? 1 : -1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.04 + 0.01,
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H)

      for (const s of SPARKS) {
        s.twinkle += s.twinkleSpeed
        const alpha = s.alpha * (0.5 + 0.5 * Math.sin(s.twinkle))

        // draw a 4-point star
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle = s.color
        ctx.translate(s.x, s.y)
        ctx.beginPath()
        drawStar(ctx, 0, 0, s.size * 0.35, s.size, 4)
        ctx.fill()

        // soft glow halo
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.size * 2.5)
        g.addColorStop(0, s.color + '55')
        g.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(0, 0, s.size * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
        ctx.restore()

        // drift
        s.x += s.speedX + s.dir * Math.sin(s.twinkle * 0.3) * 0.3
        s.y += s.speedY
        s.alpha -= s.fade
        if (s.alpha <= 0 || s.y > H + 20) Object.assign(s, mkSpark(false))
      }

      animId = requestAnimationFrame(draw)
    }

    function drawStar(ctx, cx, cy, innerR, outerR, points) {
      const step = Math.PI / points
      ctx.moveTo(cx, cy - outerR)
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR
        const angle = i * step - Math.PI / 2
        ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
      }
      ctx.closePath()
    }

    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        opacity: 0.65,
      }}
    />
  )
}
