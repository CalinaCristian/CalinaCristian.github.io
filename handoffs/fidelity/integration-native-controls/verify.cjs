const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('assert/strict');
const load=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'proof',p,'report.json.gz'))));
const c=load('conditions');assert.equal(c.passed,124);assert.equal(c.failed,0);assert.deepEqual(c.errors,[]);assert(c.checks.every(q=>q.pass));
const o=load('office'),rows=o.viewports.flatMap(v=>v.offices);assert.equal(rows.length,32);assert.equal(rows.reduce((n,r)=>n+r.taps,0),104);assert(rows.every(r=>!r.blocked.length&&!r.openedAchievements&&r.completed&&r.closed));assert.deepEqual(o.errors,[]);
console.log(JSON.stringify({conditions:124,offices:32,dialogueTaps:104,blockedTargets:0,pageErrors:0}));
