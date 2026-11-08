(async()=>{for(const p of await vqa.plans())await vqa.sampleRoute(p);let v=await vqa.runGeometry(false);return {geometry:v,issues:vqa.issues(),plans:await vqa.plans()};})()
