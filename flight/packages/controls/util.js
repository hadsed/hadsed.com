// Smooths a digital target toward a value, so keys feel like a stick.
export function ramp(current, target, dt, attack = 4, release = 6) {
  const rate = Math.abs(target) > Math.abs(current) ? attack : release;
  const step = rate * dt;
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}
