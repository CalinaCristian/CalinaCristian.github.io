// Prototype mixins: a large class (Game in main.js, Renderer3D in render.js) keeps its methods in several modules,
// each a plain class of methods. mixin() copies their methods and accessors onto the target prototype as if they were
// written in its class body (same property descriptors: non-enumerable methods, getters / setters kept).
export function mixin(target, ...sources) {
    for (const source of sources) {
        for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(source.prototype))) {
            if (key === 'constructor') continue;
            if (Object.prototype.hasOwnProperty.call(target.prototype, key)) throw new Error(`mixin: ${target.name}.${key} is defined twice`);
            Object.defineProperty(target.prototype, key, desc);
        }
    }
    return target;
}
