import {landmarkRangeSummary} from './landmark-ranges.js';

const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const cityNames={bucharest:'Bucharest',seattle:'Seattle',bellevue:'Bellevue'};
const bellevueLandmarks=new Set(['lincoln','onelincoln','lincolnsouth','plazacenter','sonic','bellevue600','bellevuetowers','bellevuesq']);
export function evidenceCities(entry){
    if(entry.city==='bucharest')return['bucharest'];
    if(entry.area==='bellevue'||entry.city==='bellevue'||bellevueLandmarks.has(entry.id))return['bellevue'];
    if(['rainier','olympics','murrowe','murroww'].includes(entry.id))return['seattle','bellevue'];
    return['seattle'];
}
const collator=new Intl.Collator('ro',{sensitivity:'base',numeric:true});
export function filterEvidenceEntries(entries,{query='',city='all'}={}){
    const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
    return entries.filter(entry=>(city==='all'||evidenceCities(entry).includes(city))&&terms.every(term=>normalize([entry.name,entry.id,...evidenceCities(entry).map(c=>cityNames[c])].join(' ')).includes(term))).sort((a,b)=>collator.compare(a.name,b.name)||a.id.localeCompare(b.id));
}

/** Search stays inside the picker; filtering never changes the inspected record. */
export function mountEvidencePicker(host,{entries,kind,onSelect}){
    const noun=kind==='landmark'?'landmark':'visit',uid=`${kind}-picker`,abort=new AbortController(),options={signal:abort.signal};
    host.classList.add('evidence-picker');
    host.innerHTML=`<span class="ep-label" id="${uid}-label">${kind==='landmark'?'Landmark':'Tourist destination'}</span>
      <button class="ep-trigger" type="button" aria-labelledby="${uid}-label ${uid}-value" aria-expanded="false" aria-controls="${uid}-panel"><span id="${uid}-value" class="ep-value"></span><svg class="ep-caret" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="ep-panel" id="${uid}-panel" hidden><div class="ep-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input type="search" autocomplete="off" placeholder="Search ${noun}s…" aria-label="Search ${noun}s" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="${uid}-results"></div>
      <div class="ep-cities" role="group" aria-label="Filter by city">${[['all','All cities'],...Object.entries(cityNames)].map(([id,label])=>`<button type="button" data-city="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</div>
      <p class="ep-count" role="status"></p><div class="ep-results" id="${uid}-results" role="listbox" aria-label="${kind==='landmark'?'Landmarks':'Visits'}"></div></div>`;
    const trigger=host.querySelector('.ep-trigger'),value=host.querySelector('.ep-value'),panel=host.querySelector('.ep-panel'),input=host.querySelector('input'),list=host.querySelector('.ep-results'),count=host.querySelector('.ep-count');
    let selected=null,city='all',shown=[],active=0;
    const locationLabel=entry=>evidenceCities(entry).map(id=>cityNames[id]).join(' / ');
    function render(){
        shown=filterEvidenceEntries(entries,{query:input.value,city});active=Math.min(active,Math.max(0,shown.length-1));list.replaceChildren();
        count.textContent=`${shown.length} ${shown.length===1?noun:noun+'s'} · A–Z`;
        shown.forEach((entry,i)=>{const row=document.createElement('button'),name=document.createElement('span'),meta=document.createElement('small');row.type='button';row.className='ep-option';row.id=`${uid}-option-${i}`;row.dataset.value=entry.id;row.setAttribute('role','option');row.setAttribute('aria-selected',String(entry.id===selected?.id));row.tabIndex=-1;name.textContent=entry.name;meta.textContent=locationLabel(entry)+(kind==='landmark'?' · '+landmarkRangeSummary(entry):'');row.append(name,meta);list.append(row);});
        if(!shown.length){const empty=document.createElement('p');empty.className='ep-empty';empty.textContent='No matches. Try another name or city.';list.append(empty);}
        highlight(false);
    }
    function highlight(scroll){const rows=[...list.querySelectorAll('.ep-option')];rows.forEach((row,i)=>row.classList.toggle('ep-active',i===active));if(rows[active]){input.setAttribute('aria-activedescendant',rows[active].id);if(scroll)rows[active].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
    function close(focus=false){panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus({preventScroll:true});}
    function open(){panel.hidden=false;trigger.setAttribute('aria-expanded','true');render();input.focus({preventScroll:true});}
    function choose(id){close(true);onSelect(id);}
    trigger.addEventListener('click',()=>panel.hidden?open():close(),options);
    trigger.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}},options);
    input.addEventListener('input',()=>{active=0;render();},options);
    input.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();active=e.key==='Home'?0:e.key==='End'?shown.length-1:Math.max(0,Math.min(shown.length-1,active+(e.key==='ArrowDown'?1:-1)));highlight(true);}else if(e.key==='Enter'&&shown[active]){e.preventDefault();choose(shown[active].id);}},options);
    host.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopPropagation();close(true);}},options);
    host.querySelector('.ep-cities').addEventListener('click',e=>{const button=e.target.closest('[data-city]');if(!button)return;city=button.dataset.city;active=0;host.querySelectorAll('[data-city]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();},options);
    list.addEventListener('click',e=>{const button=e.target.closest('[data-value]');if(button)choose(button.dataset.value);},options);
    document.addEventListener('pointerdown',e=>{if(!host.contains(e.target))close();},options);
    host.addEventListener('focusout',e=>{if(e.relatedTarget&&!host.contains(e.relatedTarget))close();},options);
    return{setValue(id){selected=entries.find(entry=>entry.id===id);if(!selected)return;value.replaceChildren();const name=document.createElement('strong'),meta=document.createElement('small');name.textContent=selected.name;meta.textContent=locationLabel(selected)+(kind==='landmark'?' · '+landmarkRangeSummary(selected):'');value.append(name,meta);if(!panel.hidden)render();},dispose(){abort.abort();host.replaceChildren();}};
}
