'use strict';
// Read-only shader-link attribution for the unchanged canonical headlight tool.
const fs=require('node:fs'),{chromium}=require('playwright'),launch=chromium.launch.bind(chromium);
chromium.launch=async(...args)=>{
 const browser=await launch(...args),newPage=browser.newPage.bind(browser);
 browser.newPage=async(...options)=>{
  const page=await newPage(...options);
  page.on('console',m=>{const s=m.text();if(s.startsWith('COCKPIT_PROGRAM_LINK '))fs.appendFileSync(process.env.COCKPIT_PROGRAM_LOG,s.slice(21)+'\n');});
  await page.addInitScript(()=>{
   const proto=WebGL2RenderingContext.prototype,original=proto.linkProgram;
   proto.linkProgram=function(program){
    const result=original.call(this,program),sources=(this.getAttachedShaders(program)||[]).map(shader=>{const s=this.getShaderSource(shader)||'';return{type:this.getShaderParameter(shader,this.SHADER_TYPE),name:s.match(/#define SHADER_NAME ([^\n]+)/)?.[1]||null,shaderType:s.match(/#define SHADER_TYPE ([^\n]+)/)?.[1]||null};});
    console.info('COCKPIT_PROGRAM_LINK '+JSON.stringify({t:performance.now(),state:window.game?.state,quality:window.game?.r3d?.stats?.quality,headlights:window.game?.headlights,on:window.game?.headlightsOn,sources}));return result;
   };
  });return page;
 };return browser;
};
