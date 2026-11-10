// Numbered floors supplied/authorized by the owner on 2026-11-10.
// Metre elevations remain estimates; a floor number does not establish a window bearing.
export const OFFICE_FLOORS = Object.freeze({
  rosetti: Object.freeze({floor:2,basis:'owner-authorized assumption'}),
  upb: Object.freeze({floor:1,basis:'owner-provided',storeyM:3.8,heightBasis:'Retained Rectorat first upper-floor datum'}),
  gts: Object.freeze({floor:2,basis:'owner-provided',storeyM:2.8,heightBasis:'Estimated 2.8m storeys; retained facade/roof compatibility still required'}),
  arnia: Object.freeze({floor:6,basis:'owner-authorized assumption'}),
  db: Object.freeze({floor:6,basis:'owner-authorized assumption'}),
  'uipath-buc': Object.freeze({floor:6,basis:'owner-provided'}),
  'uipath-bel': Object.freeze({floor:6,basis:'owner-provided; applied to both UiPath chapters'})
});
export function officeFloorElevation(stopId, data, index) {
  const assignment=OFFICE_FLOORS[stopId];if(!assignment)return null;
  const row=data.buildings?.[index],dimensions=data.buildingDimensions?.[index],height=dimensions?.[0]??row?.[1]/10,levels=row?.[6];
  const storeyM=assignment.storeyM??(height>0&&levels>0?height/levels:null);
  if(!(storeyM>0&&Number.isFinite(storeyM)))return null;
  return {...assignment,storeyM,offsetM:assignment.floor*storeyM,heightBasis:assignment.heightBasis||'Prepared building envelope height divided by mapped levels; estimated floor spacing'};
}
