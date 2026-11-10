// Preserve original text and controls while making accent-insensitive hits visible.
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function matchRanges(text, terms) {
  let folded = '', offset = 0;
  const starts = [], ends = [], hits = [];
  for (const character of text) {
    const part = normalize(character);
    for (let i = 0; i < part.length; i++) { starts.push(offset); ends.push(offset + character.length); }
    if (!part && ends.length) ends[ends.length - 1] = offset + character.length;
    folded += part; offset += character.length;
  }
  for (const term of new Set(terms.map(normalize).filter(Boolean))) {
    for (let at = folded.indexOf(term); at !== -1; at = folded.indexOf(term, at + term.length)) hits.push([starts[at], ends[at + term.length - 1]]);
  }
  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged = [];
  for (const hit of hits) {
    const previous = merged.at(-1);
    if (previous && hit[0] < previous[1]) previous[1] = Math.max(previous[1], hit[1]);
    else merged.push(hit);
  }
  return merged;
}
export function clearHighlights(roots) {
  for (const root of roots) {
    for (const mark of root.querySelectorAll('mark.guide-match')) mark.replaceWith(...mark.childNodes);
    root.normalize();
  }
}
export function highlightMatches(roots, terms) {
  let count = 0;
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode(node) {
      return node.parentElement.closest('script,style,input,textarea,select,option,[hidden],[aria-hidden="true"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }});
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const ranges = matchRanges(node.data, terms); if (!ranges.length) continue;
      const fragment = document.createDocumentFragment(); let end = 0;
      for (const [from, to] of ranges) {
        fragment.append(node.data.slice(end, from));
        const mark = document.createElement('mark'); mark.className = 'guide-match'; mark.textContent = node.data.slice(from, to); fragment.append(mark); end = to; count++;
      }
      fragment.append(node.data.slice(end)); node.replaceWith(fragment);
    }
  }
  return count;
}
