// Office speech uses a scoped facade over the real HUD. World callers retain
// the original HUD, so their anchors never become office-local accidentally.
const OWNER = Symbol('office-bubble-owner');
export function createOfficeBubbleScope(hud) {
  const token = Symbol('office-visit');
  let disposed = false;
  const calls = new Map();
  const scoped = new Proxy(hud, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (key === 'say' || key === 'bubble') {
        if (!calls.has(key)) calls.set(key, (...args) => {
          if (disposed) return false;
          const before = new Set(target.bubbles || []);
          const result = Reflect.apply(target[key], target, args);
          for (const bubble of target.bubbles || []) if (!before.has(bubble)) bubble[OWNER] = token;
          return result;
        });
        return calls.get(key);
      }
      // Panel/modal state must stay on the actual HUD, not on a copied object.
      return value.bind(target);
    },
    set(target, key, value) { return Reflect.set(target, key, value, target); }
  });
  return {
    hud: scoped,
    accepts: bubble => bubble[OWNER] === token,
    dispose() {
      if (disposed) return;
      disposed = true;
      hud.bubbles = (hud.bubbles || []).filter(bubble => {
        if (bubble[OWNER] !== token) return true;
        bubble.el.remove(); return false;
      });
      calls.clear();
    }
  };
}
