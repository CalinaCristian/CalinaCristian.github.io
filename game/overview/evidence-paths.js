// Public game evidence only: local assets or the retained tourist proof tree.
const proofRoot = '../../handoffs/fidelity/tourist-context-activities/proof/';
const safeTail = /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:png|jpe?g|webp)$/;
export function evidenceAsset(value, { kind, id } = {}) {
    if (typeof value !== 'string') return null;
    if (kind === 'spot' && id === 'old-town-lipscani' && /^evidence\/carusel-staging-20261109\/[a-z0-9-]+\.png$/.test(value)) return value;
    // The Unirii fountains record cites its three published district views (overview "fountain-tree-fix" entry).
    if (kind === 'landmark' && id === 'fountains' && /^fix-fountain-trees\/(?:after|ultra|plaza)\.png$/.test(value)) return value;
    if (/^assets\/(?:landmarks|spots)\/[a-zA-Z0-9_/-]+\.(?:png|jpe?g|webp)$/.test(value)) {
        if (kind === 'spot' && id && !value.startsWith(`assets/spots/${id}/`)) return null;
        if (kind === 'landmark' && id && !value.startsWith(`assets/landmarks/${id}/`)) return null;
        return value;
    }
    return kind !== 'landmark' && value.startsWith(proofRoot) && safeTail.test(value.slice(proofRoot.length)) ? value : null;
}
export function evidenceReport(value) {
    if (typeof value !== 'string') return null;
    if (/^evidence\/carusel-staging-20261109\/(?:manifest|selected-report)\.json$/.test(value)) return value;
    if (/^assets\/(?:landmarks|spots)\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.json$/.test(value)) return value;
    return value.startsWith(proofRoot) && /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.json$/.test(value.slice(proofRoot.length)) ? value : null;
}
