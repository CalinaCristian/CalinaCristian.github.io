/** Optional dated evidence card. Mount only into a dedicated overview host. */
export async function mountCaruselStagingEvidence(host){
 if(!host)return null;
 const base=new URL('./',import.meta.url),response=await fetch(new URL('manifest.json',base));
 if(!response.ok)throw Error('Carusel staging manifest HTTP '+response.status);
 const data=await response.json(),section=document.createElement('section');section.className='carusel-staging-evidence';section.setAttribute('aria-label','Carusel dated staging walkthrough');
 const style=document.createElement('style');style.textContent=`
.carusel-staging-evidence{margin:1.5rem 0;padding:1rem;border:1px solid #8a979f;border-radius:12px;font:inherit}
.carusel-staging-evidence h3{margin:.25rem 0 .5rem}.carusel-staging-evidence p{max-width:76ch}
.carusel-staging-evidence .cse-date{display:inline-block;margin:0 0 .4rem;padding:.2rem .55rem;border:1px solid #8a979f;border-radius:5px;font-weight:700}
.carusel-staging-evidence .cse-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
.carusel-staging-evidence figure{margin:0;min-width:0;background:rgba(100,120,130,.07);border-radius:8px;overflow:hidden}
.carusel-staging-evidence figure:last-child{grid-column:1/-1;display:grid;grid-template-columns:minmax(180px,280px) minmax(0,1fr);align-items:center}
.carusel-staging-evidence img{display:block;width:100%;height:auto;max-height:520px;object-fit:contain;background:#171c20}
.carusel-staging-evidence figcaption{padding:.7rem;line-height:1.5}.carusel-staging-evidence figcaption b{display:block;margin-bottom:.3rem}
.carusel-staging-evidence details{margin-top:1rem}.carusel-staging-evidence summary{cursor:pointer;padding:.35rem 0;font-weight:700}
.carusel-staging-evidence code{overflow-wrap:anywhere}.carusel-staging-evidence a{color:inherit;text-decoration:underline;text-underline-offset:2px}
@media(max-width:680px){.carusel-staging-evidence .cse-grid{grid-template-columns:1fr}.carusel-staging-evidence figure:last-child{display:block}.carusel-staging-evidence figure:last-child img{max-height:580px}}
`;section.append(style);
 const badge=document.createElement('p');badge.className='cse-date';badge.textContent='Staging · 9 November 2026';section.append(badge);
 const title=document.createElement('h3');title.textContent='Cărturești Carusel · doorway, hall and gallery';section.append(title);
 const intro=document.createElement('p');intro.textContent='Original game captures from the dated street-to-bookshop walkthrough. Current live appearance and final visual acceptance remain unverified.';section.append(intro);
 const grid=document.createElement('div');grid.className='cse-grid';
 for(const f of data.frames){const fig=document.createElement('figure'),link=document.createElement('a'),img=document.createElement('img'),caption=document.createElement('figcaption'),label=document.createElement('b');link.href=new URL(f.file,base);link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',f.title+' — open original full-size game capture');img.src=link.href;img.alt=f.title+' at Cărturești Carusel in the dated staging game';img.width=f.viewport.width;img.height=f.viewport.height;img.loading='lazy';img.decoding='async';link.append(img);label.textContent=f.title;caption.append(label,document.createTextNode(f.caption));fig.append(link,caption);grid.append(fig);}section.append(grid);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Capture source, scope and retained limitations';details.append(summary);
 const scope=document.createElement('p');scope.textContent=data.modelScope;details.append(scope);
 const provenance=document.createElement('p'),code=document.createElement('code');provenance.append(document.createTextNode('Exact staging source: '));code.textContent=data.sourceCommit;provenance.append(code);details.append(provenance);
 const links=document.createElement('p');for(const[file,label]of[['manifest.json','Per-image date, camera, conditions and SHA256'],['selected-report.json','Selected checks and the retained favicon failure']]){const a=document.createElement('a');a.href=new URL(file,base);a.textContent=label;links.append(a,document.createElement('br'));}details.append(links);
 const limits=document.createElement('p');limits.textContent='The bounded run passed 27 checks and retained a final resource assertion failure from an omitted test favicon. A separate phone arrival frame shows a title/hint overlap. The full original evidence stays on the artifact branch; these selected pictures do not certify the whole current game.';details.append(limits);section.append(details);host.append(section);
 return{element:section,dispose(){section.remove();}};
}
