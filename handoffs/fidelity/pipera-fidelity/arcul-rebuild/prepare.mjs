// Exact minimal runtime + native harness modules; never copies a working file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const [repoArg,commit,archiveArg,outArg]=process.argv.slice(2);
if(!repoArg||!/^[a-f0-9]{40}$/.test(commit||'')||!archiveArg||!outArg)throw Error('REPO FULLSHA NEW_ARCHIVE NEW_OUTPUT');
const repo=fs.realpathSync(repoArg),archive=path.resolve(archiveArg),out=path.resolve(outArg);
if(fs.existsSync(archive)||fs.existsSync(out))throw Error('Preserve earlier source/output; use new paths');
const git=args=>execFileSync('git',args,{cwd:repo,maxBuffer:128*1024*1024}),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(git(['rev-parse',commit+'^{commit}']).toString().trim()!==commit)throw Error('Not exact source commit');
const names=['game/src','game/data','game/vendor','game/assets','game/dev/harness/page','game/index.html','game/style.css','public','package.json'];
const entries=git(['ls-tree','-r','-l','-z',commit,'--',...names]).toString().split('\0').filter(Boolean).map(row=>{
    const[head,name]=row.split('\t'),[mode,type,blob,bytes]=head.trim().split(/\s+/);return{name,mode,type,blob,bytes:+bytes};
});
fs.mkdirSync(archive,{recursive:true});fs.mkdirSync(out,{recursive:true});const files={};
for(const e of entries){
    if(e.type!=='blob'||e.mode==='120000')throw Error('Unsupported source entry '+e.name);
    const b=git(['show',commit+':'+e.name]),dest=path.join(archive,e.name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b);
    files[e.name]={bytes:b.length,sha256:sha(b),gitBlobSha1:e.blob};
}
const manifest={commit,gitTree:git(['rev-parse',commit+'^{tree}']).toString().trim(),preparedUtc:new Date().toISOString(),files,
    policy:'Every source file from exact Git blob. Overview/research/handoffs omitted; all runtime datasets and native harness page modules retained. No source substitution.'};
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({commit,archive,out,files:entries.length,bytes:entries.reduce((n,e)=>n+e.bytes,0)}));
