"""Refresh only the two render-selection consumers; retain every encoded numeric bit."""
import argparse, gzip, hashlib, json, pathlib, re, struct, subprocess

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-source',required=True)
parser.add_argument('--report',required=True)
args=parser.parse_args()
if not re.fullmatch('[0-9a-f]{40}',args.base_source):raise ValueError('An exact base revision is required')
root=pathlib.Path(__file__).resolve().parents[2]
allowed=['game/src/spots/source-regional-terrain.js','game/src/spots/source-terrain-visibility.js']
sha=lambda b:hashlib.sha256(b).hexdigest()
before={p:sha(subprocess.check_output(['git','show',args.base_source+':'+p],cwd=root)) for p in allowed}
after={p:sha((root/p).read_bytes()) for p in allowed}
manifest_path=root/'game/data/spots/seattle-regional-manifest.json'
manifest=json.loads(manifest_path.read_text());pending=[];report={'baseSource':args.base_source,'scope':'Runtime index selection and upload caching only; no source, geometry, projection or material rebake','consumersBefore':before,'consumersAfter':after,'scenes':{}}
for scene,asset in manifest['scenes'].items():
 path=manifest_path.parent/asset['path'];encoded=path.read_bytes();raw=gzip.decompress(encoded)
 if sha(encoded)!=asset['sha256'] or sha(raw)!=asset['uncompressedSHA256']:raise ValueError('Original manifest mismatch '+scene)
 if raw[:8] not in [b'DMCXOR02',b'DMCCACHE']:raise ValueError('Unknown cache container')
 version,size=struct.unpack_from('<II',raw,8);body=16+(size+3)//4*4
 if version!=1 or body>len(raw):raise ValueError('Invalid numeric header')
 header=raw[16:16+size].decode();original=json.loads(header)
 marker=re.search(r'"sourceConsumerHashes"\s*:\s*\{',header)
 if not marker:raise ValueError('Missing root runtime consumers')
 start=marker.end()-1;section,end=json.JSONDecoder().raw_decode(header[start:]);section_text=header[start:start+end]
 if section!=original['sourceConsumerHashes']:raise ValueError('Ambiguous runtime consumer section')
 for p in allowed:
  if original['sourceConsumerHashes'].get(p)!=before[p]:raise ValueError('Base source is not the pinned runtime: '+p)
  pattern='('+re.escape(json.dumps(p))+r'\s*:\s*")'+before[p]+'(")'
  section_text,count=re.subn(pattern,lambda m:m.group(1)+after[p]+m.group(2),section_text)
  if count!=1:raise ValueError('Ambiguous consumer pin '+p)
 header=header[:start]+section_text+header[start+end:];text=header.encode()
 if len(text)!=size:raise ValueError('Header size changed')
 updated=json.loads(header);comparison=json.loads(header);comparison['sourceConsumerHashes']=original['sourceConsumerHashes']
 if comparison!=original:raise ValueError('Non-runtime metadata changed')
 changed=raw[:16]+text+raw[16+size:]
 if changed[body:]!=raw[body:]:raise ValueError('Numeric transport payload changed')
 packed=gzip.compress(changed,compresslevel=9,mtime=0);pending.append((path,packed))
 report['scenes'][scene]={'encodedNumericPayloadSHA256':sha(raw[body:]),'numericPayloadBytes':len(raw)-body,'numericBitsUnchanged':True,'priorUncompressedSHA256':sha(raw),'updatedUncompressedSHA256':sha(changed)}
 asset.update(bytes=len(packed),sha256=sha(packed),uncompressedBytes=len(changed),uncompressedSHA256=sha(changed))
for path,packed in pending:path.write_bytes(packed)
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
pathlib.Path(args.report).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'scenes':len(report['scenes']),'numericBitsUnchanged':True}))
