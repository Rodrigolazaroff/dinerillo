// El festejo chico de la app: confeti con los colores de la marca, menos de
// un segundo. Solo para hitos de verdad (saldar el mes con la pareja), no para
// cada cosa que se guarda. Con "reducir movimiento" no sale.

const COLORES = ["#1d52de", "#8ddafc", "#bdf370", "#ffffff"];

export async function festejar() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Se carga recién acá: no pesa en la app hasta el día que se festeja.
  const { default: confetti } = await import("canvas-confetti");
  const base = { colors: COLORES, disableForReducedMotion: true, ticks: 160, scalar: 0.9, zIndex: 60 };
  confetti({ ...base, particleCount: 70, spread: 70, startVelocity: 38, origin: { x: 0.5, y: 0.35 } });
  setTimeout(() => {
    confetti({ ...base, particleCount: 35, angle: 60, spread: 55, origin: { x: 0, y: 0.55 } });
    confetti({ ...base, particleCount: 35, angle: 120, spread: 55, origin: { x: 1, y: 0.55 } });
  }, 140);
}
