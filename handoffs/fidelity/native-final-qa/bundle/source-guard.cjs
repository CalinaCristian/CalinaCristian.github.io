// Server-side evidence guard. Does not alter any served source bytes or browser lifecycle.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const digest=b=>({sha256:crypto.createHash('sha256').update(b).digest('hex'),gitBlobSha1:crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex'),bytes:b.length});
function verify(root,manifest){
 for(const [name,want] of Object.entries(manifest.files)){
  const file=path.resolve(root,name);if(!file.startsWith(path.resolve(root)+path.sep)||!fs.lstatSync(file).isFile())throw Error('Invalid archived file '+name);
  const got=digest(fs.readFileSync(file));for(const k of ['sha256','gitBlobSha1','bytes'])if(got[k]!==want[k])throw Error('Immutable archive changed '+name+' '+k);
 }
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Archive symlink '+f);return e.isDirectory()?walk(f):[path.relative(root,f)];});
 if(JSON.stringify(walk(root).sort())!==JSON.stringify(Object.keys(manifest.files).sort()))throw Error('Physical archive inventory changed');
 return Object.keys(manifest.files).length;
}
function create({root,manifest,ledger}){
 root=path.resolve(root);const report={sourceCommit:manifest.commit,startedUtc:new Date().toISOString(),servedFiles:{},failures:[]};
 const persist=()=>fs.writeFileSync(ledger,JSON.stringify(report,null,2)+'\n');persist();
 return {readFile(file,callback){
  fs.readFile(file,(error,bytes)=>{
   let failure=error;const name=path.relative(root,path.resolve(file));
   try{if(error)throw error;if(name.startsWith('..')||path.isAbsolute(name))throw Error('Source traversal');const want=manifest.files[name];if(!want)throw Error('Unmanifested source request '+name);const got=digest(bytes);for(const k of ['sha256','gitBlobSha1','bytes'])if(got[k]!==want[k])throw Error('Served source changed '+name+' '+k);const row=report.servedFiles[name]||={...got,requests:0};row.requests++;}
   catch(e){failure=e;report.failures.push({name,error:String(e.message||e),atUtc:new Date().toISOString()});}
   persist();callback(failure,bytes);
  });
 }};
}
function fromEnvironment(){
 for(const name of ['QA_FREEZE_ROOT','QA_SOURCE_MANIFEST','QA_HTTP_LEDGER'])if(!process.env[name])throw Error('Final queue requires '+name);
 return create({root:process.env.QA_FREEZE_ROOT,manifest:JSON.parse(fs.readFileSync(process.env.QA_SOURCE_MANIFEST)),ledger:process.env.QA_HTTP_LEDGER});
}
module.exports={digest,verify,create,fromEnvironment};
