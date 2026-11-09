import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../../..');
const [source,archiveArg,outArg]=process.argv.slice(2);
if(!/^[a-f0-9]{40}$/.test(source||''))throw Error('Expected full source SHA, fresh archive, fresh output');
const archive=path.resolve(archiveArg),out=path.resolve(outArg),git=a=>execFileSync('git',a,{cwd:repo,maxBuffer:150*1024*1024});
if(fs.existsSync(archive)||fs.existsSync(out))throw Error('Preserve existing archive/output');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const paths=['game/src','game/data','game/vendor','game/assets','public','package.json','game/index.html','game/style.css'];
const files=git(['ls-tree','-r','-l','-z',source,'--',...paths]).toString().split('\0').filter(Boolean);
const manifest={commit:source,preparedUtc:new Date().toISOString(),files:{}};
for(const line of files){const [header,name]=line.split('\t'),[mode,type,gitBlobSha1]=header.split(/\s+/);if(type!=='blob'||mode==='120000')throw Error(name);const b=git(['show',source+':'+name]),p=path.join(archive,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);manifest.files[name]={bytes:b.length,sha256:sha(b),gitBlobSha1};}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({source,archive,out,files:files.length,bytes:Object.values(manifest.files).reduce((s,v)=>s+v.bytes,0)}));
