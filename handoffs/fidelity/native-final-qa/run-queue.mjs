// One stage at a time, bounded native runners unchanged in lifecycle/GC protocol.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url),prep=JSON.parse(fs.readFileSync(path.join(out,'preparation.json'))),manifest=JSON.parse(fs.readFileSync(path.join(out,'source-manifest.json'))),guard=require('./tools/source-guard.cjs');
const args=Object.fromEntries(process.argv.slice(2).filter(s=>s.startsWith('--')).map(s=>{const[k,...v]=s.slice(2).split('=');return[k,v.join('=')||true];}));
if(args.source!==manifest.commit||args.source!==prep.sourceCommit)throw Error('--source=FULL_EXPECTED_SHA must match prepared source');
const verify=()=>{const n=guard.verify(prep.archive,manifest);for(const[f,want]of Object.entries(prep.tools)){const b=fs.readFileSync(path.join(out,f));if(b.length!==want.bytes||crypto.createHash('sha256').update(b).digest('hex')!==want.sha256)throw Error('Frozen tool changed '+f);}return n;};
const stages=[['transitions','integration-transitions.cjs',[prep.archive,path.join(out,'transitions/report.json'),'auto','chromium'],'transitions/report.json'],['phone','integration-ui-check.cjs',[prep.archive,path.join(out,'phone')],'phone/report.json'],['headlights-keyboard','headlights-check.cjs',[prep.archive,path.join(out,'headlights-keyboard'),'keyboard','high'],'headlights-keyboard/result.json'],['headlights-touch','headlights-check.cjs',[prep.archive,path.join(out,'headlights-touch'),'touch','auto'],'headlights-touch/result.json']];
if(!args.go){console.log(JSON.stringify({sourceCommit:manifest.commit,archiveVerifiedFiles:verify(),browserLaunched:false,pending:stages.map(([name,tool,argv])=>({name,tool,argv})),physicalAcceptance:false},null,2));process.exit(0);}
if(fs.existsSync(path.join(out,'queue-report.json')))throw Error('Refuse to overwrite earlier complete/incomplete queue');
if(!args['root-go'])throw Error('--root-go=REFERENCE required; source must be explicitly released for these gates');
const report={sourceCommit:manifest.commit,rootGoReference:args['root-go'],toolCommit:prep.toolCommit,startedUtc:new Date().toISOString(),pid:process.pid,complete:false,stages:[],scope:'MobileAuto15/all8 lifecycle+first-publication body OBB, phone37, cold keyboardHigh/touchAuto headlights. Independent rail/whole-scene physical acceptance, 900s/budgets, telemetry and release remain separate.'};
const persist=()=>fs.writeFileSync(path.join(out,'queue-report.json'),JSON.stringify(report,null,2)+'\n');persist();
try{
 for(const[name,tool,argv,reportName]of stages){
  if(fs.existsSync(path.join(out,name)))throw Error('Stage output already exists '+name);fs.mkdirSync(path.join(out,name));
  const stage={name,tool,argv,startedUtc:new Date().toISOString(),copiedFilesBefore:verify()},ledger=path.join(out,name,'served-files.json'),log=fs.openSync(path.join(out,name,'runner.log'),'wx');report.stages.push(stage);persist();
  const env={...process.env,QA_FREEZE_ROOT:prep.archive,QA_SOURCE_MANIFEST:path.join(out,'source-manifest.json'),QA_HTTP_LEDGER:ledger,PROBE_CHECKS:'1',PROBE_CYCLES:'2',BRIDGE_DUMP_PAYLOAD:path.join(out,'tools/bridge-native-dump.cjs'),BRIDGE_DUMP_TARGETS:path.join(out,'tools/bridge-targets.json'),HEADLIGHTS_TRAVEL_PROBE:'1'};
  stage.exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(out,'tools',tool),...argv],{cwd:out,env,stdio:['ignore',log,log]});stage.pid=child.pid;persist();child.on('error',reject);child.on('close',(code,signal)=>{stage.signal=signal;resolve(code);});});fs.closeSync(log);
  stage.endedUtc=new Date().toISOString();stage.copiedFilesAfter=verify();const served=JSON.parse(fs.readFileSync(ledger));stage.servedFiles=Object.keys(served.servedFiles).length;stage.servedFailures=served.failures;
  const raw=JSON.parse(fs.readFileSync(path.join(out,reportName)));stage.nativeComplete=raw.complete===true;stage.nativeFailures=(raw.checks||[]).filter(c=>!c.pass);stage.reportSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(out,reportName))).digest('hex');
  if(name==='transitions'){stage.actualLoads=raw.stages?.length;stage.actualDistricts=[...new Set(raw.sequence)];if(stage.actualLoads!==15||stage.actualDistricts.length!==8||raw.initialBodyAudit?.coverage?.length!==15)throw Error('Final transition coverage incomplete');}
  if(name==='phone'&&raw.checks?.length!==37)throw Error('Phone check coverage differs from reviewed37; classify before proceeding');
  persist();if(stage.exitCode!==0||!stage.nativeComplete||stage.nativeFailures.length||stage.servedFailures.length)throw Error('Failed native stage '+name+'; preserve raw and stop remaining queue');
 }
 report.complete=true;
}catch(e){report.fatal=String(e.stack||e);process.exitCode=1;}finally{report.endedUtc=new Date().toISOString();persist();}
