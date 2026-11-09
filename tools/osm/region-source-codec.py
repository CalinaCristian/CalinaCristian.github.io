"""Lossless Float64 water-ring storage; no rounding or coordinate transforms."""
import base64
import numpy as np

FORMAT = 'float64-le-xor-byteplanes-base64'

def pack_water_coordinates(source):
    if 'waterCoordinates' in source:
        raise ValueError('Water coordinates already packed')
    values, features = [], []
    for f in source['waterFeatures']:
        refs = []
        for ring in f['rings']:
            start = len(values) // 2
            for point in ring:
                if len(point) != 2:
                    raise ValueError('Only explicit two-dimensional source rings supported')
                values.extend(point)
            refs.append([start, len(ring)])
        features.append({**{k:v for k,v in f.items() if k != 'rings'}, 'ringRefs': refs})
    original = np.asarray(values, dtype='<f8')
    if not np.isfinite(original).all():
        raise ValueError('Non-finite source coordinate')
    bits = original.view('<u8')
    delta = bits.copy()
    delta[2:] ^= bits[:-2]
    planes = delta.view('u1').reshape(-1, 8).T.copy().tobytes()
    result = {**source, 'waterFeatures': features, 'waterCoordinates': {
        'format': FORMAT, 'pointCount': len(values)//2, 'stride': 2,
        'data': base64.b64encode(planes).decode(),
        'basis': 'Original Float64 bits; each axis XORs its previous value, then bytes are transposed into eight planes. No quantization.'}}
    restored = decode_water_coordinates(result)
    assert np.array_equal(restored.view('<u8'), bits), 'Source coordinate bits changed'
    return result

def decode_water_coordinates(source):
    block = source['waterCoordinates']
    if block['format'] != FORMAT or block['stride'] != 2:
        raise ValueError('Unknown water coordinate encoding')
    count = block['pointCount']*2
    raw = base64.b64decode(block['data'])
    if len(raw) != count*8:
        raise ValueError('Invalid source coordinate bytes')
    delta = np.frombuffer(raw,dtype='u1').reshape(8,count).T.copy().view('<u8').ravel()
    bits = np.empty(count,dtype='<u8')
    bits[0::2] = np.bitwise_xor.accumulate(delta[0::2])
    bits[1::2] = np.bitwise_xor.accumulate(delta[1::2])
    return bits.view('<f8')

def water_rings(source):
    """Yield original feature metadata and original ordered Float64 ring views."""
    if 'waterCoordinates' not in source:
        for f in source['waterFeatures']:
            yield f, [np.asarray(r,dtype='<f8') for r in f['rings']]
        return
    points = decode_water_coordinates(source).reshape(-1,2)
    for f in source['waterFeatures']:
        rings = []
        for start,count in f['ringRefs']:
            if start<0 or count<0 or start+count>len(points):
                raise ValueError('Invalid original ring range')
            rings.append(points[start:start+count])
        yield f, rings
