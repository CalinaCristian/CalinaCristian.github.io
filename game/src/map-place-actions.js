const icons = {
    mark: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    travel: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
};
const esc = value => String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export function mapPlaceActions(index, label) {
    return [['mark', 'data-nav', 'Mark', ''], ['travel', 'data-ft', 'Fast travel to', ' ft']].map(([action, attribute, verb, style]) => {
        const name = esc(`${verb} ${label}`);
        return `<button class="nav-action${style}" ${attribute}="${index}" aria-label="${name}" title="${name}"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[action]}</svg></button>`;
    }).join('');
}
