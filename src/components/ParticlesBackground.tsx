/**
 * Partículas de "poeira" em CSS puro.
 * Valores determinísticos (evita hydration mismatch e dispensa useEffect/useState).
 */

interface Particle {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

const PARTICLES: Particle[] = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  left: (i * 37 + 13) % 100,
  size: 2 + ((i * 13) % 20) / 10, // 2.0 a 3.9 px
  duration: 18 + ((i * 7) % 20), // 18 a 37 s
  delay: -((i * 11) % 35), // 0 a -35 s (já no meio da animação)
  opacity: 0.25 + ((i * 19) % 40) / 100, // 0.25 a 0.64
}));

export function ParticlesBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
