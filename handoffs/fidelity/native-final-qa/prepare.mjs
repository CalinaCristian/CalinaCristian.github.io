// Read-only planning by default; source freezing needs --freeze after root supplies GO.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../..'),args={};
for(let i=2;i<process.argv.length;i++)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[++i]:true;
if(!/^[a-f0-9]{40}$/.test(args.source||''))throw Error('--source FULL_COMMIT_SHA required');
const git=a=>execFileSync('git',a,{cwd:repo,maxBuffer:128*1024*1024});
if(git(['rev-parse',args.source+'^{commit}']).toString().trim()!==args.source)throw Error('Not the named commit');
const selected=['game/src','game/data','game/vendor','game/assets','public','package.json','game/index.html','game/style.css','game/dev/harness/page','game/dev/harness/visual/page/ui.js'];
const files=git(['ls-tree','-r','-l','-z',args.source,'--',...selected]).toString().split('\0').filter(Boolean).map(row=>{const [h,name]=row.split('\t'),[mode,type,gitBlobSha1,bytes]=h.trim().split(/\s+/);if(type!=='blob'||mode==='120000')throw Error('Unsupported source entry '+name);return{name,gitBlobSha1,bytes:Number(bytes)};});
const districts=['bucharest-floreasca','bucharest-grozavesti','bucharest-pipera','bucharest-romana','bucharest-unirii','bucharest-otopeni','seattle-seatac','seattle-bellevue'];
for(const d of districts)if(!files.some(f=>f.name==='game/data/'+d+'.json'))throw Error('Missing all8 source '+d);
const plan={sourceCommit:args.source,gitTree:git(['rev-parse',args.source+'^{tree}']).toString().trim(),files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),districts,browserLaunched:false,networkUsed:false,policy:'Exact Git runtime plus native harness page/UI imports. No overview/research/proof copy; no source substitution.'};
if(!args.freeze){console.log(JSON.stringify(plan,null,2));process.exit(0);}
if(!args.archive||!args.out)throw Error('--freeze --archive NEW --out NEW required');
const archive=path.resolve(args.archive),out=path.resolve(args.out);if(fs.existsSync(archive)||fs.existsSync(out)||archive.startsWith(out+path.sep)||out.startsWith(archive+path.sep))throw Error('Fresh separate archive/output paths required');
fs.mkdirSync(archive,{recursive:true});fs.mkdirSync(out,{recursive:true});const manifest={commit:args.source,gitTree:plan.gitTree,preparedUtc:new Date().toISOString(),policy:plan.policy,files:{}};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const f of files){const b=git(['show',args.source+':'+f.name]),target=path.join(archive,f.name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b);manifest.files[f.name]={bytes:b.length,sha256:sha(b),gitBlobSha1:f.gitBlobSha1};}
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.cpSync(path.join(here,'bundle'),path.join(out,'tools'),{recursive:true,errorOnExist:true});
const tools={};const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
for(const f of walk(path.join(out,'tools')))tools[path.relative(out,f)]={bytes:fs.statSync(f).size,sha256:sha(fs.readFileSync(f))};
fs.copyFileSync(path.join(here,'run-queue.mjs'),path.join(out,'run-queue.mjs'));tools['run-queue.mjs']={bytes:fs.statSync(path.join(out,'run-queue.mjs')).size,sha256:sha(fs.readFileSync(path.join(out,'run-queue.mjs')))};
const preparation={...plan,archive,out,preparedUtc:manifest.preparedUtc,toolCommit:git(['rev-parse','HEAD']).toString().trim(),preparerSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),tools};
fs.writeFileSync(path.join(out,'preparation.json'),JSON.stringify(preparation,null,2)+'\n');
console.log(JSON.stringify({...plan,archive,out},null,2));
