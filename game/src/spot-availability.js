// Menu access is separate from the historical architectural review flag.
export const MENU_ORDER = [
    'fremont-troll', 'peoples-salvation-cathedral', 'old-town-lipscani',
    'kerry-park', 'space-needle', 'pike-place', 'waterfront', 'pioneer-square', 'chihuly', 'mopop',
    'bel-lincoln-square', 'stavropoleos-cec', 'athenaeum-revolution', 'arcul-de-triumf', 'spring-palace',
    'palace-parliament', 'gas-works', 'cismigiu', 'bel-meydenbauer', 'bel-downtown-park', 'bel-botanical-garden',
];
export const MENU_AVAILABLE = new Set(MENU_ORDER);
export const RECOMMENDED_SPOTS = new Set(MENU_ORDER.slice(0, 3));
export const PARK_WALKS = new Set(['cismigiu', 'herastrau-park', 'village-museum', 'bel-downtown-park', 'bel-botanical-garden']);
export function activityAvailable(achievement, available = MENU_AVAILABLE) {
    return !achievement.activity || achievement.activity.startsWith('*:') || available.has(achievement.activity.split(':')[0]);
}
export function touristTarget(id, fallback, spots) {
    if (!Array.isArray(spots)) return fallback;
    if (id === 'postcards-all') return spots.length;
    if (id === 'spots-buc' || id === 'tours-buc') return spots.filter(s => s.city === 'bucharest').length;
    if (id === 'spots-sea' || id === 'tours-sea') return spots.filter(s => s.city === 'seattle').length;
    return fallback;
}
