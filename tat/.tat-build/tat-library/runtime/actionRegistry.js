export function createActionRegistry() {
    return new Map();
}
export function registerAction(registry, action) {
    registry.set(action.bindingName, cloneRuntimeAction(action));
}
export function getAction(registry, bindingName) {
    const action = registry.get(bindingName);
    return action ? cloneRuntimeAction(action) : null;
}
export function hasAction(registry, bindingName) {
    return registry.has(bindingName);
}
export function cloneActionRegistry(registry) {
    const next = createActionRegistry();
    for (const [bindingName, action] of registry.entries()) {
        next.set(bindingName, cloneRuntimeAction(action));
    }
    return next;
}
function cloneRuntimeAction(action) {
    return {
        bindingName: action.bindingName,
        guard: action.guard ? cloneAstNode(action.guard) : null,
        pipeline: action.pipeline.map((step) => cloneAstNode(step)),
        project: action.project ? cloneAstNode(action.project) : null,
    };
}
function cloneAstNode(node) {
    return JSON.parse(JSON.stringify(node));
}
