"""Lossless typed-block transport shared by producer/auditor; no geometry edits."""
import json,struct
import numpy as np
def metadata(data):
 if data[:8]not in(b'DMCCACHE',b'DMCXOR02')or len(data)<16:raise ValueError('Unknown context transport')
 version,n=struct.unpack_from('<II',data,8);assert version==1;body=16+(n+3)//4*4;assert body<=len(data);return json.loads(data[16:16+n]),body
def blocks(meta):
 for b in meta['batches']:
  for d in b['attributes'].values():yield d,d['itemSize']
  yield b['index'],1
def encode(data,meta):
 old,body=metadata(data);assert data[:8]==b'DMCCACHE';text=json.dumps(meta,separators=(',',':')).encode();newbody=16+(len(text)+3)//4*4;out=bytearray(newbody+len(data)-body);out[:8]=b'DMCXOR02';struct.pack_into('<II',out,8,1,len(text));out[16:16+len(text)]=text
 for d,stride in blocks(old):
  assert d['type']in('Float32Array','Uint32Array')and d['count']%stride==0;bits=np.frombuffer(data,dtype='<u4',count=d['count'],offset=body+d['byteOffset']);delta=bits.copy();delta[stride:]=bits[stride:]^bits[:-stride];encoded=delta.view('u1').reshape(-1,stride,4).transpose(2,1,0).copy().tobytes();off=newbody+d['byteOffset'];out[off:off+d['byteLength']]=encoded
 return out
def decode(data):
 meta,body=metadata(data)
 if data[:8]==b'DMCCACHE':return data
 out=bytearray(data);out[:8]=b'DMCCACHE'
 for d,stride in blocks(meta):
  off=body+d['byteOffset'];delta=np.frombuffer(data,dtype='u1',count=d['byteLength'],offset=off).reshape(4,stride,-1).transpose(2,1,0).copy().view('<u4').ravel();bits=np.empty(len(delta),dtype='<u4')
  for axis in range(stride):bits[axis::stride]=np.bitwise_xor.accumulate(delta[axis::stride])
  out[off:off+d['byteLength']]=bits.tobytes()
 return out
