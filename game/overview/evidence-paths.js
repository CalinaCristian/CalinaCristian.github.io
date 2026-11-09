// Public game evidence only: local assets or the retained tourist proof tree.
const proofRoot = '../../handoffs/fidelity/tourist-context-activities/proof/';
const safeTail = /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:png|jpe?g|webp)$/;
export function evidenceAsset(value, { kind, id } = {}) {
    if (typeof value !== 'string') return null;
    if (/^assets\/(?:landmarks|spots)\/[a-zA-Z0-9_/-]+\.(?:png|jpe?g|webp)$/.test(value)) {
        if (kind === 'spot' && id && !value.startsWith(`assets/spots/${id}/`)) return null;
        return value;
    }
    return kind !== 'landmark' && value.startsWith(proofRoot) && safeTail.test(value.slice(proofRoot.length)) ? value : null;
}
export function evidenceReport(value) {
    return typeof value === 'string' && value.startsWith(proofRoot) && /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.json$/.test(value.slice(proofRoot.length)) ? value : null;
}
