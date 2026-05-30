export function SakuraPetals() {
  // Generate deterministic but natural-looking variation
  const petals = Array.from({ length: 28 }, (_, index) => {
    const seed = (index * 137.5 + 42) % 360;
    const size = 8 + (seed % 7) * 1.5; // 8–18 px height
    const left = ((seed * 1.618 + index * 7) % 100);
    const delay = -((seed * 2.3 + index * 1.9) % 20);
    const duration = 12 + (seed % 9) * 1.8; // 12–26 s
    const hue = 340 + (seed % 16) - 4; // 336–352 pink range
    const drift = ((seed * 0.7 + index * 3.1) % 12) - 6; // -6…6 vw
    return { size, left, delay, duration, hue, drift, index };
  });

  return (
    <div className="sakura-petals" aria-hidden="true">
      {petals.map((p) => (
        <span
          className="sakura-petal"
          key={p.index}
          style={{
            '--petal-h': `${p.size}px`,
            '--petal-w': `${p.size * 0.7}px`,
            '--petal-hue': p.hue,
            '--petal-drift': `${p.drift}vw`,
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
