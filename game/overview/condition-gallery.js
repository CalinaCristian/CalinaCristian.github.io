// Matched, original game captures. Only the selected condition loads images.
export const CONDITION_IDS = ['summer-day', 'summer-night', 'winter-day', 'winter-night'];
let instance = 0;
const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
export function matchedConditions(sets) {
  if (!Array.isArray(sets) || sets.length !== 4 || CONDITION_IDS.some((id, i) => sets[i]?.id !== id)) return false;
  const ids = sets[0].captures?.map(c => c.id);
  return ids?.length >= 4 && new Set(ids).size === ids.length && sets.every(set => set.captures?.length === ids.length && set.captures.every((c, i) => c.id === ids[i]));
}
export function mountConditionGallery(root, gallery, { resolveImage = value => value, manifestURL } = {}) {
  if (!matchedConditions(gallery.conditionSets)) throw new Error('Four complete, matched ground-view sets are required.');
  const prefix = 'ground-gallery-' + ++instance, sets = gallery.conditionSets;
  const section = node('section', undefined, 'condition-gallery'), tabs = node('div', undefined, 'condition-tabs'), panel = node('div'), status = node('p', undefined, 'condition-status');
  tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Season and time of day');
  panel.id = prefix + '-panel'; panel.setAttribute('role', 'tabpanel');
  section.append(node('p', gallery.notice || 'Matched walking-height views from the recorded production game source. Open a picture at its original size.', 'notice'), tabs, status, panel);
  root.replaceChildren(section);
  const buttons = sets.map((set, i) => {
    const button = node('button', set.label); button.type = 'button'; button.id = prefix + '-tab-' + i;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id);
    button.addEventListener('click', () => show(i));
    button.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (i + 1) % 4 : event.key === 'ArrowLeft' ? (i + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null;
      if (next !== null) { event.preventDefault(); show(next); buttons[next].focus(); }
    });
    tabs.append(button); return button;
  });
  function show(index) {
    const set = sets[index];
    buttons.forEach((button, i) => { button.setAttribute('aria-selected', String(i === index)); button.tabIndex = i === index ? 0 : -1; });
    panel.setAttribute('aria-labelledby', buttons[index].id); panel.replaceChildren();
    status.textContent = `${set.captures.length} matched viewpoints · ${set.period === 'night' ? '23:00' : '12:00'} local · ${set.weather === 'snow' ? 'snowy winter scenario' : 'clear summer scenario'} · High quality`;
    const grid = node('div', undefined, 'condition-grid');
    for (const capture of set.captures) {
      const src = resolveImage(capture.image); if (!src) throw new Error('Unsafe ground capture path');
      const figure = node('figure'), link = node('a'), image = node('img'), caption = node('figcaption');
      link.href = src; link.target = '_blank'; link.rel = 'noopener';
      image.src = src; image.alt = `${capture.label} · ${set.label}`; image.loading = 'lazy'; image.decoding = 'async';
      image.width = capture.viewport.width; image.height = capture.viewport.height;
      link.append(image); caption.append(node('b', capture.label), node('p', capture.purpose));
      const date = new Intl.DateTimeFormat('en-GB', {timeZone:'America/Los_Angeles',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(capture.capturedAt));
      caption.append(node('small', `${capture.viewport.width} × ${capture.viewport.height} · captured ${date} Pacific`));
      figure.append(link, caption); grid.append(figure);
    }
    const details = node('details'), summary = node('summary', 'Camera, conditions and source');
    const source = captureSource(set), sourceLink = node('a', 'Game source ' + source.slice(0, 7));
    sourceLink.href = 'https://github.com/CalinaCristian/CalinaCristian.github.io/commit/' + source;
    details.append(summary, node('p', gallery.setup || 'Production renderer; fixed on-foot cameras 1.65 m above supporting surfaces. Controlled appearance captures, without gameplay HUD. These pictures do not verify route access, activity completion or hardware FPS.'), sourceLink);
    details.append(node('p', 'Summer uses 15 July and clear weather; winter uses 15 January and the game’s snow preset. These are controlled scenarios, not a claim about the typical weather of a city.'));
    for(const limitation of gallery.limitations || []) details.append(node('p', limitation, 'notice'));
    if(manifestURL){const link=node('a','Download capture manifest');link.href=manifestURL;const p=node('p');p.append(link);details.append(p);}
    const pre = node('pre', JSON.stringify(set.captures.map(c => ({id:c.id,capturedAt:c.capturedAt,sourceCommit:c.sourceCommit,pose:c.pose,condition:c.condition,sha256:c.sha256})), null, 2));
    details.append(pre); panel.append(grid, details);
  }
  show(0);
  return {dispose() { section.remove(); }};
}
function captureSource(set) {
  const source = set.captures[0]?.sourceCommit;
  if (!/^[a-f0-9]{40}$/.test(source || '')) throw new Error('Missing game source');
  return source;
}
