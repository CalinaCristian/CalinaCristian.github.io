// Reviewed source-structure associations. Dimensions/heights below are MODEL
// inputs; no OSM layer or level is converted to metres. Exact XY stays in data.
export const TRAM_BRIDGE_MODELS = [
    {
        id: 'grozavesti-lower-river-trams', kind: 'level', sourceLayer: 1,
        bridgeWays: ['w128304859', 'w660918286'],
        roadSources: ['w128304847', 'w128304855'],
        sourceStructureId: 'w902056192',
        basis: 'MODEL lower river rail bridge; exact mapped rail centre lines and matching lower source road profiles; not surveyed',
        deckHalfWidthM: 1.7, thicknessM: .4,
    },
    {
        id: 'basarab-central-trams', kind: 'station-plateau', sourceLayer: 2,
        bridgeWays: ['w118416425', 'w205971103'],
        stationNodes: [5865238769, 1775175278], stationRoadSources: ['w668700429', 'w23770172'],
        paths: [
            { ways: [['w660918280', 1], ['w314447163', 1], ['w118416425', 1], ['w118583391', 1]], southGround: 6187776680, southFlatBranch: 'w660918283', southGroundReference: 6233585073, northGround: 6262162593, southRoad: 'w665700250', northRoad: 'w23554680' },
            { ways: [['w132127990', -1], ['w660918284', -1], ['w205971103', -1], ['w660931074', -1]], southGround: 981543139, southFlatBranch: 'w660918281', southGroundReference: 6233585074, northGround: 6262162594, southRoad: 'w665700250', northRoad: 'w23554680' },
        ],
        basis: 'MODEL independent central rail viaduct; common cable-station profile, original source ground joins and smooth source-connected approaches; not surveyed',
        evidence: ['https://www.webuildgroup.ro/en/projects-romania/basarab-overpass/', 'https://www.midasbridge.com/en/project-application/the-basarab-overpass-0', 'https://doc.pmb.ro/primarul/prioritati_proiecte/pasajul_basarab/docs/pasaj.pdf'],
        // southClearSpacingM: the climb waits until the track is 3 m (deck half 1.7 + tram half 1.3) from the flat branch
        // (owner L17). The entry stays at 6.1 m (a tram passes under the bridge entry, 6.03 m tall with its pantograph), so the shorter south approach climbs at up
        // to 9 % (southMaxGrade); the deck rise keeps 8 %. MODEL estimates, not surveyed
        bridgeEntryHeightM: 6.1, bridgeRiseLengthM: 100, maxDeckGrade: .08, southClearSpacingM: 3, southMaxGrade: .09,
        // northDescentM: the trams come down beside the road ramp and reach street level where the source rail bridge ends
        // (Street View on Sos. Nicolae Titulescu, 2026-11-12); 190 m like the road ramp. MODEL estimate, not surveyed
        northDescentM: 190,
        maxGrade: .08, easeM: 20, deckHalfWidthM: 1.7, thicknessM: .4,
    },
];
