// Menu access is separate from the historical architectural review flag.
export const MENU_ORDER = [
    'old-town-lipscani', 'cismigiu', 'arcul-de-triumf',
    'pike-place', 'space-needle', 'bel-meydenbauer', 'bel-downtown-park',
];
export const MENU_AVAILABLE = new Set(MENU_ORDER);
export const RECOMMENDED_SPOTS = new Set(MENU_ORDER);
export const PARK_WALKS = new Set(['cismigiu', 'herastrau-park', 'village-museum', 'bel-downtown-park', 'bel-botanical-garden']);
// (owner, 2026-11-15) retired with the photo walks / framing rings, the look-out and walk-to goals and the baguette catch:
// none of them is offered any more, so none counts in the panel or the %
const RETIRED_ACTIVITIES = new Set(['cismigiu:chess', 'arcul-de-triumf:terrace', 'old-town-lipscani:curtea-veche', 'old-town-lipscani:dristor-shaorma', 'old-town-lipscani:shoteria-shot',
    'old-town-lipscani:lipscani-photo-walk', 'herastrau-park:nymph', 'palace-parliament:balcony', 'palace-parliament:pace', 'cismigiu:rotunda',
    'bel-meydenbauer:pier-end', 'bel-downtown-park:loop', 'bel-botanical-garden:bridge', 'bel-lincoln-square:badge-in',
    'space-needle:lm-chihuly-glasshouse', 'space-needle:loupe', 'mopop:mopop-lobes', 'athenaeum-revolution:concert-hall', 'spring-palace:residence-tour',
    'pioneer-square:lm-totem-read', 'pioneer-square:lm-underground', 'kerry-park:blue-hour', 'arcul-de-triumf:arcul-baguette']);
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
