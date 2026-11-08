#!/usr/bin/env node
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
    const server = http.createServer((req, res) => {
        const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
        fs.readFile(f, (e, b) => { res.writeHead(e ? 404 : 200, { 'content-type': path.extname(f) === '.js' ? 'text/javascript' : 'text/html' }); res.end(e ? 'missing' : b); });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await chromium.launch({ args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}/game/index.html`, { waitUntil: 'domcontentloaded' });
        const result = await page.evaluate(async () => {
            const T = await import('/game/vendor/three.module.min.js');
            const { batchWaterChunks } = await import('/game/src/water-batch.js');
            const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
            const getExtension = gl.getExtension.bind(gl);
            gl.getExtension = name => name === 'WEBGL_multi_draw' ? null : getExtension(name);
            const renderer = new T.WebGLRenderer({ canvas, context: gl, antialias: false }); renderer.setSize(48, 48); renderer.setClearColor('#142230');
            const material = new T.MeshBasicMaterial({ vertexColors: true, depthWrite: false }), scene = new T.Scene();
            let oldDisposed = 0, materialDisposed = 0; material.addEventListener('dispose', () => materialDisposed++);
            const make = () => {
                const group = new T.Group(); group.renderOrder = -18;
                for (const [i, x] of [-3, 0, 3, 0, 0].entries()) {
                    const g = new T.BufferGeometry(), positions = new Float32Array([x-.4,-.4,0,x+.4,-.4,0,x+.4,.4,0,x-.4,-.4,0,x+.4,.4,0,x-.4,.4,0]);
                    if(i===4)for(let k=2;k<positions.length;k+=3)positions[k]=-.1;g.setAttribute('position', new T.BufferAttribute(positions, 3));
                    const colours = new Float32Array(18); for (let k = 0; k < 6; k++) colours[k*3+i%3] = 1;
                    g.setAttribute('color', new T.BufferAttribute(colours, 3)); g.setAttribute('aFoamReliable', new T.BufferAttribute(new Float32Array([0,0,0,1,1,1]), 1)); g.setAttribute('aShore', new T.BufferAttribute(new Float32Array([0,1,2,3,4,5]), 1));
                    g.setAttribute('normal',new T.BufferAttribute(new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1]),3));g.setAttribute('uv',new T.BufferAttribute(new Float32Array([0,0,1,0,1,1,0,0,1,1,0,1]),2));g.setAttribute('aSource',new T.BufferAttribute(new Uint8Array([1,2,3,4,5,6]),1,true));if(i===4)g.setIndex([3,4,5,0,1,2]);g.computeBoundingSphere(); const m = new T.Mesh(g, material); m.name = 'source-' + i; m.renderOrder = -18; m.matrixAutoUpdate = false; group.add(m);
                }
                return group;
            };
            const reference = make(), input = make(), originals = input.children.slice(), attrBytes = {};
            for (const k of Object.keys(originals[0].geometry.attributes)) attrBytes[k] = originals.flatMap(m => Array.from(m.geometry.attributes[k].array));
            for (const m of originals) m.geometry.addEventListener('dispose', () => oldDisposed++);
            const expectedIndices=originals.flatMap((m,i)=>Array.from({length:m.geometry.index?.count??m.geometry.attributes.position.count},(_,j)=>i*6+(m.geometry.index?m.geometry.index.getX(j):j)));const batch = batchWaterChunks(input); if (!batch) throw new Error('compatible source chunks rejected');
            if(!expectedIndices.every((v,i)=>v===batch.geometry.index.array[i]))throw new Error('changed original index order');for (const [k, values] of Object.entries(attrBytes)) if (!values.every((v, i) => Object.is(v, batch.geometry.attributes[k].array[i]))) throw new Error('changed source attribute ' + k);
            const draws = [], rows = []; let commands = 0;
            for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const fn = gl[name].bind(gl); gl[name] = (...args) => { commands++; return fn(...args); }; }
            const camera = new T.OrthographicCamera(-.5,.5,.5,-.5,.1,20);
            const render = (group, x, yaw=0, half=.5) => {camera.left=-half;camera.right=half;camera.updateProjectionMatrix();
                scene.clear(); scene.add(group); camera.position.set(x,0,5); camera.lookAt(x,0,0); if (yaw) camera.rotateY(yaw); camera.updateMatrixWorld(true);
                renderer.info.reset(); commands = 0; renderer.render(scene, camera);
                const pixels = new Uint8Array(48*48*4); gl.readPixels(0,0,48,48,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
                return { pixels, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, commands, selected: batch.userData.waterBatch.selected.slice() };
            };
            for (const [x, yaw, half] of [[-3,0,.5],[3,0,.5],[0,0,.5],[-3,0,.5],[1.0,0,.5],[1.4,0,.5],[8,0,.5],[3,.12,.5],[-3,0,.5],[0,0,5]]) {
                const before = render(reference, x, yaw, half), after = render(input, x, yaw, half);
                let changed = 0; for (let i=0;i<before.pixels.length;i++) if(before.pixels[i]!==after.pixels[i]) changed++;
                if (changed || before.triangles !== after.triangles || after.calls !== 1 || after.commands !== after.calls) throw new Error(JSON.stringify({x,yaw,changed,before:{calls:before.calls,triangles:before.triangles},after:{calls:after.calls,triangles:after.triangles,commands:after.commands,selected:after.selected}}));
                rows.push({x,yaw,changedBytes:changed,referenceCalls:before.calls,batchedCalls:after.calls,triangles:after.triangles,actualGLCommands:after.commands,selected:after.selected});
            }
            if(oldDisposed!==5||materialDisposed!==0)throw new Error('source/material ownership changed');
            let mergedDisposed=0;batch.geometry.addEventListener('dispose',()=>mergedDisposed++);batch.geometry.dispose();
            renderer.renderLists.dispose(); renderer.dispose();
            return { passed:true, sourceAttributes:Object.keys(attrBytes), oldGeometryDisposals:oldDisposed, mergedGeometryDisposals:mergedDisposed, sharedMaterialDisposals:materialDisposed, forcedMultiDrawUnavailable:true, rows };
        });
        console.log(JSON.stringify(result, null, 2));
    } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exit(1); });
