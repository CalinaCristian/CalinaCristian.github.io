// Menu access is separate from the historical architectural review flag.
export const MENU_ORDER = [
    'old-town-lipscani', 'cismigiu', 'arcul-de-triumf',
    'pike-place', 'space-needle', 'bel-meydenbauer', 'bel-downtown-park',
];
export const MENU_AVAILABLE = new Set(MENU_ORDER);
export const RECOMMENDED_SPOTS = new Set(MENU_ORDER);
export const PARK_WALKS = new Set(['cismigiu', 'herastrau-park', 'village-museum', 'bel-downtown-park', 'bel-botanical-garden']);
export const RETIRED_ACTIVITIES = new Set(['cismigiu:chess', 'old-town-lipscani:curtea-veche', 'old-town-lipscani:dristor-shaorma', 'old-town-lipscani:shoteria-shot']);
export function activityAvailable(achievement, available = MENU_AVAILABLE) {
    return !achievement.activity || !RETIRED_ACTIVITIES.has(achievement.activity) && (achievement.activity.startsWith('*:') || available.has(achievement.activity.split(':')[0]));
}
export function touristTarget(id, fallback, spots) {
    if (!Array.isArray(spots)) return fallback;
    if (id === 'postcards-all') return spots.length;
    if (id === 'spots-buc' || id === 'tours-buc') return spots.filter(s => s.city === 'bucharest').length;
    if (id === 'spots-sea' || id === 'tours-sea') return spots.filter(s => s.city === 'seattle').length;
    return fallback;
}
