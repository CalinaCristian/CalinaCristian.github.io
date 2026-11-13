// ============================================================================
//  Landmarks — Anchors: lat, lon and yaw (radians) of every landmark model, from OpenStreetMap.
//  Part of the landmark models of landmarks.js (split out of it, spec 22); conventions in landmarks.js' header.
// ============================================================================

export const A = {
    parliament: [44.4275038, 26.0874035, -0.0698], cathedral: [44.4259297, 26.0822981, -0.0873], arcul: [44.4671902, 26.078127, -2.7925],
    casapresei: [44.4815236, 26.0709515, -1.2217], grandhotel: [44.4372925, 26.1022881, -2.7751], univ: [44.4355639, 26.1007589, -2.7925],
    tnb: [44.4370273, 26.1036159, -1.1868], ateneu: [44.441344, 26.0973695, -2.5307], regal: [44.4394699, 26.0960493, -1.0996],
    victoria: [44.4528232, 26.0874287, -1.501], cec: [44.4320212, 26.0964749, -0.2094], mnir: [44.4313746, 26.097758, -0.2094],
    marriott: [44.4257465, 26.0766337, -0.6981], unirea: [44.4280154, 26.1048886, -1.501], skytower: [44.4779551, 26.1047395, -1.3265],
    promenada: [44.4781916, 26.1034126, -1.1868], baneasasc: [44.507022, 26.0897843, -0.1745], romexpo: [44.4762793, 26.065137, -0.5411],
    gara: [44.4466161, 26.0748974, -2.3213], opera: [44.4360568, 26.0795203, -0.0873], politehnica: [44.438429, 26.0515105, 0],
    hermes: [44.4810862, 26.1140757, -1.1519], baneasaterm: [44.4962356, 26.0814666, -2.7751], otp: [44.5708154, 26.0795884, -1.4661],
    ase: [44.447807, 26.0971572, 0], ambasador: [44.441963, 26.099535, -1.501], aro: [44.4424337, 26.0992711, -3.0543],
    fountains: [44.4268, 26.1025, 0], aviatorilor: [44.4597696, 26.0860782, 0],
    antipa: [44.4530955, 26.0846273, 0], catargiu: [44.4491223, 26.0929099, 0], veronafountain: [44.4427623, 26.0980117, 0], // (Romană lane 2026-11-12) OSM w23610985 / w800350070 / w1183885625 bbox centres
    spaceneedle: [47.6205063, -122.3493043, -0.1571], columbia: [47.6045425, -122.3307183, -1.0123], smith: [47.6019654, -122.331729, -2.6005],
    tmobile: [47.5913642, -122.3324281, 0], spheres: [47.6156773, -122.3394897, -0.7505], seatac: [47.4423743, -122.3012208, -1.4137],
    seatower: [47.4557242, -122.3013712, -0.2618], bellevuetowers: [47.6143271, -122.1981129, 0],
    bellevuesq: [47.615653, -122.2035769, -1.5359],
    lumen: [47.5952, -122.3316, 0], greatwheel: [47.60615, -122.34262, -1.01],
    mtbaker: [47.5901, -122.2885856, 0],               // actual highway tunnel mouths at the east facade
    rainier: [46.8529, -121.7604, 0], olympics: [47.70, -123.15, 0],
    // district-era landmarks (P2 footprints): anchor = bbox centre of the OSM footprints, rotation 0 (+x east)
    lincoln: [47.6168559, -122.2010316, 0], onelincoln: [47.6159634, -122.2008866, 0], lincolnsouth: [47.6147631, -122.2008325, 0], plazacenter: [47.6178822, -122.1940388, 0],
    sonic: [47.6148782, -122.1968365, 0], bellevue600: [47.6160667, -122.1942494, 0],
    // Murrow high-rise arches: anchor ON the I-90 EB carriageway centreline (world edge 'I-90 — Lacey V. Murrow Memorial Bridge'),
    // rotation = road heading (model +x along the road): west high-rise dir (0.9995, 0.0326), east (0.9991, 0.0433)
    murroww: [47.5898848, -122.28406, -0.0326], murrowe: [47.5892424, -122.25540, -0.0433],
    seagarage: [47.4432823, -122.2992416, 0], sealink: [47.4452089, -122.2969786, 0],
    gts: [44.433369, 26.1176015, 0], rosetti: [44.4671565, 26.106133, 0], dinamo: [44.4551306, 26.1023192, 0], bob: [44.479608, 26.1147802, 0], thelandmark: [44.450012, 26.0946079, 0], europehouse: [44.4511557, 26.087697, 0], halatraian: [44.4333566, 26.120567, 0], globalworth: [44.4792401, 26.1024141, 0], thebridge1: [44.44481317, 26.06011122, 0],
    cetgrozavesti: [44.440165, 26.062861, 0], orhideeasign: [44.444574, 26.062252, 0],
    nobildac: [44.4466925, 26.0945949, 0], enescu: [44.4437403, 26.0980397, 0], // (round 2b) OSM w1170480716 / w1171605516 bbox centres
    otpgara: [44.569035, 26.0751467, 0],                                        // (round 2b) OSM w813193384 bbox centre
    turnulapa: [44.4479069, 26.062282, 0], automatica: [44.4640864, 26.1010897, 0], // (round 3) OSM w678037221 / w39348916 node centroids
    urseanudome: [44.4485165, 26.0929986, 0],                                   // (round 3) OSM w1220336122 node centroid
    grozmetro: [44.442853, 26.059936, 0],                                       // (round 3) OSM n610921621 (subway entrance)
};
