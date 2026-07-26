import { useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// The physics, in plain terms:
//
// Each particle has an ORIGIN (ox, oy) — its resting position — and a
// CURRENT position (x, y) plus a velocity (vx, vy). Every frame we compute
// three forces on the velocity and integrate:
//
//   1. REPULSION  — if the cursor is within REPEL_RADIUS of a particle, push
//      it directly away from the cursor. Force strength ramps up the closer
//      the cursor gets (falls off linearly with distance).
//   2. SPRING      — always pull the particle back toward its own origin,
//      proportional to how far it's drifted. This is what makes it "settle"
//      instead of flying off and never coming back.
//   3. DAMPING     — multiply velocity by a number slightly less than 1
//      every frame, so motion loses energy over time instead of oscillating
//      forever (like friction/air resistance).
//
// Tune the four constants below to change the feel: bigger REPEL_STRENGTH
// or REPEL_RADIUS = more dramatic scatter; bigger SPRING = snaps back
// faster/tighter; DAMPING closer to 1 = floatier, closer to 0 = stiffer.
// ---------------------------------------------------------------------------

const REPEL_RADIUS = 70;
const REPEL_STRENGTH = 3.2;
const SPRING = 0.03;
const DAMPING = 0.9;

export default function ParticleField({ density = 90 }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;

    function seedParticles(w, h) {
      particlesRef.current = Array.from({ length: density }, () => {
        const x = Math.random() * w;
        const y = Math.random() * h;
        return {
          ox: x,
          oy: y, // origin — where it rests when undisturbed
          x,
          y, // current position
          vx: 0,
          vy: 0,
          r: Math.random() * 1.3 + 0.4,
          phase: Math.random() * Math.PI * 2, // offsets each particle's twinkle
          speed: 0.4 + Math.random() * 0.6,
        };
      });
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedParticles(width, height);
    }

    function handleMove(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (mx >= -50 && mx <= rect.width + 50 && my >= -50 && my <= rect.height + 50) {
        mouseRef.current = { x: mx, y: my };
      } else {
        mouseRef.current = { x: -9999, y: -9999 };
      }
    }

    function handleLeave() {
      mouseRef.current = { x: -9999, y: -9999 };
    }

    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      for (const p of particlesRef.current) {
        ctx.beginPath();
        ctx.arc(p.ox, p.oy, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();
      }
    }

    let t = 0;
    function tick() {
      t += 0.016;
      ctx.clearRect(0, 0, width, height);

      for (const p of particlesRef.current) {
        // 1. Repulsion from the cursor
        const dx = p.x - mouseRef.current.x;
        const dy = p.y - mouseRef.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist < REPEL_RADIUS) {
          const falloff = (REPEL_RADIUS - dist) / REPEL_RADIUS; // 1 = right on top, 0 = at the edge
          p.vx += (dx / (dist || 1)) * falloff * REPEL_STRENGTH;
          p.vy += (dy / (dist || 1)) * falloff * REPEL_STRENGTH;
        }

        // 2. Spring back toward resting position
        p.vx += (p.ox - p.x) * SPRING;
        p.vy += (p.oy - p.y) * SPRING;

        // 3. Damping so it settles instead of oscillating forever
        p.vx *= DAMPING;
        p.vy *= DAMPING;

        p.x += p.vx;
        p.y += p.vy;

        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * p.speed + p.phase));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleLeave);

    if (prefersReducedMotion) {
      drawStatic(); // no motion, no listeners needed beyond resize
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [density]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}
