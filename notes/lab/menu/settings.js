// Player settings for the menu prototype, kept in this browser only.
const KEY = 'fly-settings-v1';
const DEFAULTS = { invertY: false, look: 'real' };

export function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
