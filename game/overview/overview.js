'use strict';
const $ = s => document.querySelector(s);
const normal = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const repo = 'https://github.com/CalinaCristian/CalinaCristian.github.io';
let inventory;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table = (caption, headings, rows) => `<table><caption>${caption}</caption><thead><tr>${headings.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
const sourceURL = path => `${repo}/blob/${inventory.sourceSha}/${path}`;
const sourceLink = (path, label) => `<a href="${sourceURL(path)}">${esc(label || path)}</a>`;
const districtFor = lm => inventory.districts.filter(d=>d.landmarks.includes(lm.id));
const hasComparison = id => ['romana','floreasca'].includes(id);
function compareLink(location,label,{lat,lon,targetLabel,scope='core'}={}) {
  const params=new URLSearchParams({compareLocation:location,compareScope:scope});
  let extra='';
  if(Number.isFinite(lat)&&Number.isFinite(lon)){params.set('compareLat',lat);params.set('compareLon',lon);extra+=` data-compare-lat="${lat}" data-compare-lon="${lon}"`;}
  if(targetLabel){params.set('compareLabel',targetLabel);extra+=` data-compare-label="${esc(targetLabel)}"`;}
  return `<a href="?${esc(params.toString())}#comparisons" data-compare-location="${esc(location)}" data-compare-scope="${esc(scope)}"${extra}>${esc(label)}</a>`;
}
let viewer;
const comparisonReady=import('./comparison-viewer.js').then(async ({mountComparisonViewer})=>{
  viewer=await mountComparisonViewer($('#comparison-viewer'),{baseURL:new URL('./comparison-data/',import.meta.url)});
  return viewer;
}).catch(error=>{ $('#comparison-viewer').innerHTML='<p class="notice">Comparison viewer is unavailable in this copy. The source inventories and technical guide remain available.</p>'; console.error('Comparison viewer could not load:',error.message); return null; });
document.addEventListener('click',async event=>{
  const link=event.target.closest('a[data-compare-location]');if(!link||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();$('#search').value='';applySearch();
  const control=await comparisonReady;
  const data=link.dataset;
  const state={location:data.compareLocation,scope:data.compareScope||'core',query:'',label:data.compareLabel||''};
  if(data.compareLat && data.compareLon){state.lat=Number(data.compareLat);state.lon=Number(data.compareLon);}
  if(control?.setState)await control.setState(state);else if(control)await control.setLocation(state.location,{scope:state.scope});
  $('#comparisons').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  $('#comparisons').focus({preventScroll:true});
});
async function initInventory() {
  try {
    const response = await fetch('inventory.json');
    if (!response.ok) throw new Error(`Inventory HTTP ${response.status}`);
    inventory = await response.json();
    for (const selector of ['#hero-sha','#source-sha']) { const e=$(selector); e.textContent=selector==='#hero-sha'?inventory.sourceSha.slice(0,7):inventory.sourceSha; e.href=`${repo}/tree/${inventory.sourceSha}`; }
    document.querySelectorAll('[data-inventory-count]').forEach(el=>{const n=inventory.counts[el.dataset.inventoryCount];if(Number.isFinite(n))el.textContent=String(n);});
    $('#repo-link').href=`${repo}/tree/${inventory.sourceSha}`;
    document.querySelectorAll('[data-sources]').forEach(el=>{ el.innerHTML=el.dataset.sources.split(',').map(p=>sourceLink(p,p.split('/').pop())).join(' '); });
    $('#district-table').innerHTML=table('Configured district inventory · source-linked, not a fidelity grade',['District / chapters','Included landmark IDs','Comparison evidence'], inventory.districts.map(d=>`<tr><th scope="row">${esc(d.name)}<small>${esc(d.city==='bucharest'?'Bucharest, Romania':'Washington, USA')}<br>${d.chapters.map(c=>`${c.year} · ${esc(c.title)}`).join('<br>')}</small></th><td>${d.landmarks.map(id=>`<a href="#landmark-${id}">${esc(id)}</a>`).join(', ')}<small>${sourceLink(d.data,'District JSON')}</small></td><td>${compareLink(d.id,hasComparison(d.id)?'Inspect district ↓':'Check availability ↓')}<small>${hasComparison(d.id)?'Source and scope shown in viewer':'No public comparison dataset yet'}</small></td></tr>`));
    $('#landmark-table').innerHTML=table('61 catalogue entries · 60 distinct builders',['Landmark / ID','Configured district use','Model / comparison evidence'],inventory.landmarks.map(lm=>{const ds=districtFor(lm);const supported=ds.filter(d=>hasComparison(d.id));return `<tr id="landmark-${esc(lm.id)}"><th scope="row">${esc(lm.name)}<small>${esc(lm.id)}</small></th><td>${ds.length?ds.map(d=>`${esc(d.name)}${d.scenery.includes(lm.id)?' · scenery only':''}`).join('<br>'):'<span class="tag pending">Outside current district lists</span>'}<small>${lm.city==='bucharest'?'Bucharest':'Seattle / Bellevue'}</small></td><td>${sourceLink('game/src/landmarks.js',lm.builder)} · <a href="../dev/landmarks.html?id=${encodeURIComponent(lm.id)}">Model viewer</a><small>${supported.length?supported.map(d=>compareLink(d.id,`${d.name} survey ↓`,{lat:lm.lat,lon:lm.lon,targetLabel:lm.name})).join('<br>'):'Reality comparison: not published'}${supported.length?'<br>Nearest survey tile; no dedicated landmark pair.':''}</small></td></tr>`;}));
    $('#spot-table').innerHTML=table('24 destinations · 19 shared scene IDs · 12 historical READY flags',['Destination','Scene / sharing','Historical menu gate'],inventory.spots.map(s=>`<tr><th scope="row">${esc(s.name)}<small>${esc(s.area==='bellevue'?'Bellevue':s.city==='bucharest'?'Bucharest':'Seattle')} · ${esc(s.id)}</small></th><td>${sourceLink('game/src/spots/index.js',s.scene)}<small>${inventory.spots.filter(x=>x.scene===s.scene).length} destination(s) in scene</small></td><td><span class="tag ${s.historicalReady?'sourced':'pending'}">${s.historicalReady?'Listed':'Developer only'}</span><small>Current fidelity: requires review</small></td></tr>`));
    $('#source-index').innerHTML=inventory.sources.map(s=>`<li>${sourceLink(s.path)}</li>`).join('');
    applySearch();
  } catch (err) {
    $('#load-error').hidden=false;
    $('#hero-sha').textContent='Source inventory unavailable';
    $('#source-sha').textContent='See inventory.json';
    console.error('Overview inventory could not load:',err.message);
  }
}
const sections=[...document.querySelectorAll('section[data-search]')];
let beforeSearch=null;
function applySearch(){
  const query=normal($('#search').value.trim());
  const terms=query.split(/\s+/).filter(Boolean);
  if(terms.length && !beforeSearch) beforeSearch=new Map([...document.querySelectorAll('.content details')].map(d=>[d,d.open]));
  let matches=0;
  for(const section of sections){
    const hit=!terms.length || terms.every(t=>normal(section.textContent).includes(t));
    section.classList.toggle('search-hidden',!hit);
    if(hit) matches++;
    if(terms.length && hit) section.querySelectorAll('details').forEach(d=>{d.open=terms.some(t=>normal(d.textContent).includes(t));});
  }
  if(!terms.length && beforeSearch){for(const[d,open]of beforeSearch)d.open=open;beforeSearch=null;}
  $('#no-results').hidden=matches!==0;
  $('#clear-search').hidden=!terms.length;
  $('#search-status').textContent=terms.length?`${matches} of ${sections.length} sections match. Matching detail panels are open.`:'';
  $('#toc').querySelectorAll('a').forEach(a=>{a.hidden=!!terms.length && $(`${a.hash}`)?.classList.contains('search-hidden');});
}
$('#search').addEventListener('input',applySearch);
$('#clear-search').addEventListener('click',()=>{$('#search').value='';applySearch();$('#search').focus();});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!e.metaKey&&!e.ctrlKey){e.preventDefault();$('#search').focus();}if(e.key==='Escape'&&document.activeElement===$('#search')){$('#search').value='';applySearch();$('#search').blur();}});
// Inventory targets live inside collapsed panels: reveal ancestors for both direct and clicked anchors.
function revealHash(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=document.getElementById(id);if(!target)return;let p=target.parentElement;while(p){if(p.tagName==='DETAILS')p.open=true;p=p.parentElement;}if(target.closest('.search-hidden')){$('#search').value='';applySearch();}if(id.startsWith('landmark-'))requestAnimationFrame(()=>target.scrollIntoView({block:'center'}));}
window.addEventListener('hashchange',revealHash);
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#landmark-"]');if(a)setTimeout(revealHash,0);});
const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){document.querySelectorAll('#toc a').forEach(a=>a.classList.toggle('active',a.hash===`#${entry.target.id}`));}},{rootMargin:'-8% 0px -65% 0px'});
sections.forEach(s=>observer.observe(s));
initInventory().then(revealHash);
