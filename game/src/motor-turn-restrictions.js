// Literal OSM motor-turn relations. This module never joins graph geometry,
// infers an angle, changes a source record or consumes random numbers.
const KINDS = new Set(['no_left_turn','no_right_turn','no_straight_on','no_u_turn','no_entry','no_exit','only_left_turn','only_right_turn','only_straight_on','only_u_turn']);
const MODES = {
    motorcar: ['motorcar','motor_vehicle','vehicle'],
    taxi: ['taxi','psv','motorcar','motor_vehicle','vehicle'],
    bus: ['bus','psv','motor_vehicle','vehicle'],
    hgv: ['hgv','goods','motor_vehicle','vehicle'],
    goods: ['goods','motor_vehicle','vehicle'],
    motorcycle: ['motorcycle','motor_vehicle','vehicle'],
    motor_vehicle: ['motor_vehicle','vehicle'],
};
const KNOWN_EXCEPT = new Set([...Object.keys(MODES),'vehicle','psv','bicycle','foot','agricultural','forestry','emergency','delivery']);
const ref = (value, prefix) => {
    const s = String(value ?? ''), raw = s.startsWith(prefix) ? s.slice(1) : s;
    return /^[1-9][0-9]*$/.test(raw) ? prefix + raw : null;
};
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}' : JSON.stringify(value);
function wayOf(edge) {
    const access = ref(edge?.access?.sourceId, 'w'), direct = ref(edge?.sourceId, 'w');
    return access && direct && access !== direct ? null : access || direct;
}
const viaOf = node => ref(node?.sourceId, 'n');
function kindFor(tags, except, mode) {
    const chain = MODES[mode] || MODES.motor_vehicle;
    if (chain.some(m => except.has(m))) return null;
    for (const m of chain) if (Object.hasOwn(tags, 'restriction:' + m)) return tags['restriction:' + m];
    return tags.restriction ?? null;
}

export function buildMotorTurnRestrictions(data, edges = []) {
    const full = data?.roadRestrictions, fallback = data?.district?.sourceReturns?.restrictions;
    const records = new Map(), conflicts = new Set(), unresolved = [], modeOnly = [], rules = [], byVia = new Map();
    for (const source of [Array.isArray(full) ? full : [], Array.isArray(fallback) ? fallback : []]) for (const raw of source) {
        const id = ref(raw?.sourceId, 'r');
        if (!id) { unresolved.push({sourceId: raw?.sourceId ?? null, reasons:['missing-relation-source-id']}); continue; }
        const dto = {sourceId:id, tags:{...raw.tags}, members:Array.isArray(raw.members) ? raw.members.map(m => ({...m})) : []};
        const previous = records.get(id);
        if (previous && canonical({tags:previous.tags,members:previous.members}) !== canonical({tags:dto.tags,members:dto.members})) conflicts.add(id);
        else if (!previous) records.set(id, dto);
    }
    const incoming = new Set(), outgoing = new Set();
    for (const e of edges) for (const dir of [1,-1]) {
        const way = wayOf(e); if (!way || e.virtual || e.rail || e.publicDrive === false || (dir < 0 && e.oneway) || (dir > 0 ? e.lanesF ?? e.lanes ?? 1 : e.lanesB ?? e.lanes ?? 1) <= 0) continue;
        const a = dir > 0 ? e.a : e.b, b = dir > 0 ? e.b : e.a;
        if (viaOf(b)) incoming.add(way + '/' + viaOf(b));
        if (viaOf(a)) outgoing.add(way + '/' + viaOf(a));
    }
    const missingRuntimeIncidence = [];
    for (const dto of records.values()) {
        const reasons = [], tags = dto.tags, members = dto.members;
        const from = members.filter(m => m.role === 'from'), via = members.filter(m => m.role === 'via'), to = members.filter(m => m.role === 'to');
        if (conflicts.has(dto.sourceId)) reasons.push('conflicting-duplicate-relation');
        if (tags.type !== 'restriction') reasons.push('unsupported-relation-type');
        if (Object.keys(tags).some(k => k === 'conditional' || k.startsWith('restriction') && k.endsWith(':conditional'))) reasons.push('conditional-restriction-unresolved');
        if (from.length !== 1 || from[0]?.type !== 'way' || !ref(from[0]?.ref,'w')) reasons.push('missing-or-ambiguous-from-way');
        if (to.length !== 1 || to[0]?.type !== 'way' || !ref(to[0]?.ref,'w')) reasons.push('missing-or-ambiguous-to-way');
        if (via.some(m => m.type === 'way')) reasons.push('via-way-sequence-unresolved');
        if (via.length !== 1 || via[0]?.type !== 'node' || !ref(via[0]?.ref,'n')) reasons.push('missing-or-ambiguous-via-node');
        if (members.some(m => !['from','via','to'].includes(m.role))) reasons.push('unrecognized-member-role');
        const except = new Set(String(tags.except || '').split(';').map(s => s.trim().toLowerCase()).filter(Boolean));
        if ([...except].some(s => !KNOWN_EXCEPT.has(s))) reasons.push('unsupported-exception-unresolved');
        const modeRules = {}, unsupportedModes = [];
        for (const mode of Object.keys(MODES)) {
            const value = kindFor(tags, except, mode);
            if (value !== null && !KINDS.has(value)) unsupportedModes.push({mode,value});
            modeRules[mode] = KINDS.has(value) ? value : null;
        }
        if (unsupportedModes.length) reasons.push('unsupported-restriction-value');
        const unknownKeys = Object.keys(tags).filter(k => k.startsWith('restriction:') && !Object.keys(MODES).some(mode => MODES[mode].includes(k.slice(12))));
        if (unknownKeys.length) reasons.push('unsupported-mode-key');
        if (reasons.length) { unresolved.push({...dto,reasons,unsupportedModes,unknownKeys}); continue; }
        if (!Object.values(modeRules).some(Boolean)) { modeOnly.push({...dto,reason:'no-applicable-known-motor-restriction'}); continue; }
        const fromWay = ref(from[0].ref,'w'), toWay = ref(to[0].ref,'w'), viaNode = ref(via[0].ref,'n');
        if (fromWay === toWay && Object.values(modeRules).some(k => k && !['no_u_turn','only_u_turn'].includes(k))) { unresolved.push({...dto,reasons:['same-way-non-uturn-ambiguous']}); continue; }
        const rule = Object.freeze({sourceId:dto.sourceId,fromWay,toWay,viaNode,modeRules:Object.freeze(modeRules)});
        rules.push(rule); let list = byVia.get(viaNode); if (!list) byVia.set(viaNode,list=[]); list.push(rule);
        if (!incoming.has(fromWay+'/'+viaNode) || !outgoing.has(toWay+'/'+viaNode)) missingRuntimeIncidence.push({sourceId:dto.sourceId,incomingPresent:incoming.has(fromWay+'/'+viaNode),outgoingPresent:outgoing.has(toWay+'/'+viaNode)});
    }
    return {rules,byVia,report:{catalogueScope:data?.roadRestrictionCoverage?.scope || 'reviewed source-return restriction subset only',records:records.size,accepted:rules.length,unresolved,modeOnly,missingRuntimeIncidence}};
}

/** The actual graph node/direction establishes incidence. Missing native source
 * identity grants no invented relation and is visible in the policy report. */
export function motorTurnAllowed(policy, incoming, inDir, outgoing, outDir, {mode='motorcar'} = {}) {
    if (!policy?.rules?.length || incoming?.rail || outgoing?.rail) return true;
    const node = inDir > 0 ? incoming?.b : incoming?.a, start = outDir > 0 ? outgoing?.a : outgoing?.b;
    if (!node || node !== start) return false;
    const list = policy.byVia.get(viaOf(node)); if (!list) return true;
    const fromWay = wayOf(incoming), toWay = wayOf(outgoing); if (!fromWay || !toWay) return true;
    for (const rule of list) {
        if (rule.fromWay !== fromWay) continue;
        const kind = Object.hasOwn(rule.modeRules,mode) ? rule.modeRules[mode] : rule.modeRules.motor_vehicle; if (!kind) continue;
        let target = rule.toWay === toWay;
        if (target && rule.fromWay === rule.toWay && ['no_u_turn','only_u_turn'].includes(kind)) target = outgoing === incoming && outDir === -inDir;
        if (kind.startsWith('only_') ? !target : target) return false;
    }
    return true;
}

/** Model names do not supply gross mass, emergency duty or delivery permission. */
export function motorRestrictionMode(actor) {
    if (actor?.osmMotorMode && MODES[actor.osmMotorMode]) return actor.osmMotorMode;
    if (actor?.bus || actor?.trolley) return 'bus';
    if (actor?.kind === 'taxi') return 'taxi';
    if (['hatch','compact-sedan','estate','small-suv','sedan','crossover','ev-sedan','suv','minivan'].includes(actor?.kind)) return 'motorcar';
    return 'motor_vehicle';
}
