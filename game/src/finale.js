/**
 * "Story complete" end screen (note 71, cockpit-ui). Full-screen overlay over the softly blurred scene: hero header
 * (name, current role, location), a vertical timeline (one node per CV stop, company + role on their own lines, period
 * aligned, company colour + icon), skills as tags, contact buttons with icons, trip stats as tiles, actions.
 *
 * showFinale({ profile, stops, stats: { minutes, distanceKm, chapters: [done, total], achievements: [n, total],
 *   completion (0–100), photos, fines?: string }, actions: { cv?, explore?, spots?, replay?, close? } (callbacks; a missing
 *   one hides its button), onAction }) → Promise<string> (the action id chosen: 'cv' | 'explore' | 'spots' | 'replay' |
 *   'close'). Only CV content from data.js is shown; Escape / the ✕ closes.
 */
import { ACHIEVEMENTS } from './data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
// small inline icons (no external assets / trademarks: generic glyphs)
const ICON = {
    linkedin: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 10v7M7.5 7v.01M11 17v-4.5a2 2 0 0 1 4 0V17M11 10v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    github: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.3.2 2.3.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>',
    article: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z M8 8h8M8 12h8M8 16h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    qa: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 10h6" stroke="currentColor" stroke-width="2"/></svg>',
    bird: '<svg viewBox="0 0 24 24"><path d="M4 4l16 16M20 4L4 20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 7l9 6 9-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    cv: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v6m-3-3l3 3 3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};
const iconFor = (label) => { const l = label.toLowerCase(); return l.includes('linkedin') ? ICON.linkedin : l.includes('github') ? ICON.github : l.includes('medium') || l.includes('dev.to') ? ICON.article : l.includes('stack') ? ICON.qa : l.includes('twitter') ? ICON.bird : l.includes('cv') ? ICON.cv : ICON.link; };

export function showFinale({ profile, stops = [], stats = {}, actions = {}, onAction } = {}) {
    let el = document.getElementById('finale');
    if (!el) { el = document.createElement('div'); el.id = 'finale'; document.body.appendChild(el); }
    const P = profile || {};
    const links = (P.links || []).filter(l => !/cv/i.test(l.label));
    const cvLink = (P.links || []).find(l => /cv/i.test(l.label));
    const tiles = [
        ['⏱️', stats.minutes != null ? `${stats.minutes} min` : '—', 'Time played'],
        ['🛣️', stats.distanceKm != null ? `${stats.distanceKm.toFixed(1)} km` : '—', 'Distance driven'],
        ['📍', stats.chapters ? `${stats.chapters[0]}/${stats.chapters[1]}` : '—', 'Chapters'],
        ['🏆', stats.achievements ? `${stats.achievements[0]}/${stats.achievements[1] ?? ACHIEVEMENTS.length}` : `—/${ACHIEVEMENTS.length}`, 'Achievements'], // total = the live catalogue unless the caller passes one
        ['✅', stats.completion != null ? `${Math.round(stats.completion)}%` : '—', 'Completion'],
        ['📸', stats.photos != null ? String(stats.photos) : '—', 'Photos'],
    ];
    const act = (id, label, icon, primary = false) => (actions[id] || id === 'close' ? `<button class="fn-act${primary ? ' primary' : ''}" data-act="${id}">${icon}<span>${label}</span></button>` : '');
    el.innerHTML = `<div class="fn-wrap" role="dialog" aria-label="Story complete">
        <button class="fn-x" data-act="close" aria-label="Close">✕</button>
        <header class="fn-hero">
            <div class="fn-eyebrow">🏁 Story complete</div>
            <h1>${esc(P.name)}</h1>
            <p class="fn-role">${esc(P.title)} <span>· ${esc(P.location)}</span></p>
            ${P.summary ? `<p class="fn-sum">${esc(P.summary)}</p>` : ''}
        </header>
        <section class="fn-grid">
            <div class="fn-col">
                <h3>Timeline</h3>
                <ol class="fn-tl">${stops.map(st => `<li style="--c:${esc(st.color || '#fa4616')}"><span class="fn-node">${esc(st.icon || '')}</span><div class="fn-tl-body"><div class="fn-tl-row"><b>${esc(st.company)}</b><time>${esc(st.period)}</time></div><span>${esc(st.role)}</span></div></li>`).join('')}</ol>
            </div>
            <div class="fn-col">
                <h3>Trip</h3>
                <div class="fn-tiles">${tiles.map(([i, v, l]) => `<div class="fn-tile"><span class="fn-ti">${i}</span><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>
                ${stats.fines ? `<p class="fn-note">Fines: ${esc(stats.fines)}</p>` : ''}
                <h3>Skills</h3>
                <div class="fn-tags">${(P.topSkills || []).map(s => `<span>${esc(s)}</span>`).join('')}</div>
                <h3>Say hi</h3>
                <div class="fn-links">${links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${iconFor(l.label)}<span>${esc(l.label)}</span></a>`).join('')}${P.email ? `<a href="mailto:${esc(P.email)}">${ICON.mail}<span>Email</span></a>` : ''}</div>
            </div>
        </section>
        <footer class="fn-actions">
            ${cvLink || actions.cv ? `<a class="fn-act primary" data-act="cv" ${cvLink ? `href="${esc(cvLink.url)}" target="_blank" rel="noopener"` : ''}>${ICON.cv}<span>Download CV</span></a>` : ''}
            ${act('explore', 'Explore', '<span class="fn-e">🧭</span>')}
            ${act('spots', 'Tourist spots', '<span class="fn-e">🏛️</span>')}
            ${act('replay', 'Replay the story', '<span class="fn-e">↺</span>')}
        </footer>
    </div>`;
    document.body.classList.add('finale-open');
    requestAnimationFrame(() => el.classList.add('show'));
    return new Promise((resolve) => {
        const close = (id) => {
            el.classList.remove('show'); document.body.classList.remove('finale-open');
            removeEventListener('keydown', onKey, true);
            setTimeout(() => { el.innerHTML = ''; }, 350);
            try { onAction?.(id); } catch { /* ignore */ }
            try { actions[id]?.(); } catch (e) { console.warn('[finale]', e); }
            resolve(id);
        };
        const onKey = (e) => { if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close('close'); } };
        addEventListener('keydown', onKey, true);
        el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', (e) => { const id = b.dataset.act; if (id === 'cv' && b.getAttribute('href')) { try { actions.cv?.(); } catch { /* ignore */ } return; } e.preventDefault(); close(id); }));
    });
}
