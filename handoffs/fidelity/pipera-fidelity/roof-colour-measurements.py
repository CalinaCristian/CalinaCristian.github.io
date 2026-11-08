#!/usr/bin/env python3
"""Measure colour reliability independently of shape, using retained roof registration.

No imagery is written. The earlier registration shifts have 0.1m precision;
this replay therefore records up to 0.05m registration rounding uncertainty.
"""
import argparse
import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[3])
    ap.add_argument('--mosaic', type=Path, required=True)
    ap.add_argument('--osm', nargs='+', required=True)
    ap.add_argument('--registered-roofs', type=Path, required=True)
    ap.add_argument('--roof-input', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    a = ap.parse_args()
    spec = importlib.util.spec_from_file_location('roof_measurements', a.root / 'tools/aerial/roofs.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    nodes, ways = module.load_osm(a.osm)
    meta = json.loads(a.mosaic.with_suffix('.json').read_text())
    image = Image.open(a.mosaic.with_suffix('.jpg')).convert('RGB')
    registered = json.loads(a.registered_roofs.read_text())['roofs']
    wanted = json.loads(a.roof_input.read_text())['roofs']
    n = 2 ** meta['z'] * 256

    def px(lat, lon):
        return [(lon + 180) / 360 * n - meta['px0'],
                (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n - meta['py0']]

    records, unavailable = {}, []
    for source_id in wanted:
        if source_id not in ways or source_id not in registered:
            unavailable.append(source_id)
            continue
        refs, _ = ways[source_id]
        points = np.array([px(*nodes[r]) for r in refs if r in nodes])
        if len(points) < 4:
            unavailable.append(source_id)
            continue
        shift = registered[source_id]['shift']
        points += [shift[0] / meta['mPerPx'], -shift[1] / meta['mPerPx']]
        centre = points.mean(axis=0)
        sample_ring = centre + (points - centre) * 0.72
        lo = np.floor(sample_ring.min(axis=0)).astype(int)
        hi = np.ceil(sample_ring.max(axis=0)).astype(int) + 1
        if min(lo) < 0 or hi[0] > image.width or hi[1] > image.height:
            unavailable.append(source_id)
            continue
        mask = Image.new('L', tuple(hi - lo), 0)
        ImageDraw.Draw(mask).polygon([tuple(p - lo) for p in sample_ring], fill=1)
        pixels = np.asarray(image.crop((*lo, *hi)), dtype=np.float32)[np.asarray(mask).astype(bool)]
        if len(pixels) < 12:
            unavailable.append(source_id)
            continue
        median = np.median(pixels, axis=0)
        luma = pixels @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
        median_luma = float(np.median(luma))
        spread = float(np.percentile(luma, 85) - np.percentile(luma, 15)) / max(1, median_luma)
        green = float(np.mean(((2 * pixels[:, 1] - pixels[:, 0] - pixels[:, 2]) > 34) & (pixels[:, 1] > 55)))
        shadow = float(np.mean(luma < 40))
        score = 0.9 - green * 1.5 - max(0, spread - 0.6) * 0.25 - max(0, shadow - 0.1) * 0.8
        if green > 0.20 or median_luma < 50 or shadow > 0.35:
            score = 0
        if len(pixels) < 30:
            score *= 0.5
        records[source_id] = {
            'hex': '#%02x%02x%02x' % tuple(int(v) for v in median),
            'confidence': round(max(0, min(0.9, score)), 2),
            'samplePixels': len(pixels), 'medianLuma': round(median_luma, 1),
            'shadowFraction': round(shadow, 3), 'vegetationFraction': round(green, 3),
            'lumaSpread': round(spread, 3), 'registrationShiftM': shift,
        }
    result = {
        'schemaVersion': 1, 'source': 'Independent Esri World Imagery median roof pixels',
        'accessDate': '2026-11-08', 'acquisitionDate': None,
        'registration': 'Retained independent edge registration, rounded to0.1m; maximum0.05m replay rounding uncertainty per axis',
        'policy': 'Same current tools/aerial/roofs.py reliability formula; score>=0.65 admissible separately from shape; OSM colour/material wins',
        'colourMeasurements': records, 'unavailable': unavailable,
        'summary': {'inputs': len(wanted), 'measured': len(records),
                    'admissible': sum(v['confidence'] >= 0.65 for v in records.values()),
                    'rejectedOrUncertain': sum(v['confidence'] < 0.65 for v in records.values())},
    }
    a.out.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps(result['summary']))


if __name__ == '__main__':
    main()
