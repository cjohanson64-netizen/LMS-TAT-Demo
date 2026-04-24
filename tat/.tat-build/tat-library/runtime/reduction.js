import { getAction } from "./actionRegistry.js";
import { evaluateValueExpr } from "./evaluateNodeCapture.js";
import { cloneGraphValue, getIncomingEdges, getOutgoingEdges, } from "./graph.js";
export const REDUCTION_OUTPUTS = ["javascript"];
export const REDUCTION_STRATEGIES = ["imperative"];
export const REDUCTION_INCLUDE_KEYS = [
    "nodes",
    "edges",
    "state",
    "meta",
    "history",
    "context",
];
export const REDUCTION_OPCODES = [
    "registerNode",
    "registerEdge",
    "registerAction",
    "selectNode",
    "selectEdge",
    "selectRelated",
    "setState",
    "mergeState",
    "setMeta",
    "resolveEdge",
    "invokeHandler",
    "transition",
    "assertGuard",
    "emitWarning",
    "noop",
];
export const REDUCTION_ERROR_CODES = [
    "INVALID_REDUCTION_SOURCE",
    "UNRESOLVED_GRAPH_REFERENCE",
    "UNRESOLVED_SOURCE_ITEM",
    "UNSUPPORTED_OUTPUT",
    "UNKNOWN_STRATEGY",
    "INVALID_INCLUDE_OPTION",
    "INVALID_HANDLER_MAP",
    "INVALID_SELECTION_TARGET",
    "INVALID_HANDLER_NAME",
    "MISSING_ACTION_BINDING",
    "INVALID_INSTRUCTION_OPCODE",
    "INVALID_INSTRUCTION_ARGS",
    "MISSING_SOURCE_REF",
    "DUPLICATE_REDUCED_ID",
];
export const REDUCTION_WARNING_CODES = [
    "EMPTY_SELECTION_RESULT",
    "UNRESOLVED_HANDLER",
    "FALLBACK_HANDLER_USED",
    "UNSUPPORTED_SEMANTIC_KIND",
    "LOWERING_SKIPPED",
    "AMBIGUOUS_ACTION_TARGET",
];
export function reduceGraphResult(context) {
    const artifact = createReductionArtifact(context.graphId, context.expr);
    const state = {
        artifact,
        seenNodeIds: new Set(),
        seenEdgeIds: new Set(),
        seenActionIds: new Set(),
        seenInstructionIds: new Set(),
        nextInstructionId: 1,
        handlers: normalizeHandlers(context, artifact),
        selectedNodeIds: resolveSelection(context, artifact),
    };
    if (context.graph === null) {
        pushDiagnostic(artifact, "errors", "UNRESOLVED_GRAPH_REFERENCE", `Graph "${context.graphId}" is not available for @reduce`, { kind: "graph", id: context.graphId });
        return artifact;
    }
    if (!isReductionOutput(artifact.output)) {
        pushDiagnostic(artifact, "errors", "UNSUPPORTED_OUTPUT", `Unsupported @reduce output "${artifact.output}"`, { kind: "graph", id: context.graphId }, { output: artifact.output });
    }
    if (!isReductionStrategy(artifact.strategy)) {
        pushDiagnostic(artifact, "errors", "UNKNOWN_STRATEGY", `Unknown @reduce strategy "${artifact.strategy}"`, { kind: "graph", id: context.graphId }, { strategy: artifact.strategy });
    }
    if (artifact.diagnostics.errors.length > 0) {
        return artifact;
    }
    const nodes = Array.from(context.graph.nodes.values()).filter((node) => state.selectedNodeIds ? state.selectedNodeIds.has(node.id) : true);
    const edges = context.graph.edges.filter((edge) => state.selectedNodeIds
        ? state.selectedNodeIds.has(edge.subject) && state.selectedNodeIds.has(edge.object)
        : true);
    for (const node of nodes) {
        reduceNode(node, context, state);
    }
    for (const edge of edges) {
        reduceEdge(edge, context, state);
    }
    for (const node of nodes) {
        reduceActionNode(node, context, state);
    }
    validateArtifactIntegrity(artifact);
    return artifact;
}
function createReductionArtifact(graphId, expr) {
    const argMap = new Map(expr.args
        .filter((arg) => arg.key)
        .map((arg) => [arg.key.name, arg.value]));
    const output = readStringLiteral(argMap.get("output")) ?? "javascript";
    const strategy = readStringLiteral(argMap.get("strategy")) ?? "imperative";
    const entry = readStringLiteral(argMap.get("entry")) ?? graphId;
    const debugEnabled = readBooleanLiteral(argMap.get("debug")) ?? false;
    const artifact = {
        type: "reduction",
        version: "1.0",
        output,
        strategy,
        source: {
            graphId,
            select: null,
        },
        entry: {
            name: entry,
            kind: "runtime",
        },
        include: {
            nodes: true,
            edges: true,
            state: true,
            meta: true,
            history: false,
            context: true,
        },
        payload: {
            nodes: [],
            edges: [],
            actions: [],
            instructions: [],
        },
        diagnostics: {
            warnings: [],
            errors: [],
        },
        debug: {
            enabled: debugEnabled,
            trace: [],
        },
    };
    const includeValue = argMap.get("include");
    if (includeValue && includeValue.type === "ObjectLiteral") {
        for (const property of includeValue.properties) {
            if (!isReductionIncludeKey(property.key)) {
                pushDiagnostic(artifact, "errors", "INVALID_INCLUDE_OPTION", `Invalid @reduce include key "${property.key}"`, { kind: "graph", id: graphId }, { key: property.key });
                continue;
            }
            if (property.value.type !== "BooleanLiteral") {
                pushDiagnostic(artifact, "errors", "INVALID_INCLUDE_OPTION", `@reduce include "${property.key}" must be a boolean literal`, { kind: "graph", id: graphId }, { key: property.key });
                continue;
            }
            artifact.include[property.key] = property.value.value;
        }
    }
    else if (includeValue) {
        pushDiagnostic(artifact, "errors", "INVALID_INCLUDE_OPTION", "@reduce include must be an object literal", { kind: "graph", id: graphId });
    }
    return artifact;
}
function normalizeHandlers(context, artifact) {
    const expr = context.expr.args.find((arg) => arg.key?.name === "handlers")?.value;
    const base = {
        relation: {},
        action: {},
        transition: {},
    };
    if (!expr) {
        return base;
    }
    if (expr.type !== "ObjectLiteral") {
        pushDiagnostic(artifact, "errors", "INVALID_HANDLER_MAP", "@reduce handlers must be an object literal", { kind: "graph", id: context.graphId });
        return base;
    }
    for (const section of expr.properties) {
        if (section.key !== "relation" &&
            section.key !== "action" &&
            section.key !== "transition") {
            pushDiagnostic(artifact, "errors", "INVALID_HANDLER_MAP", `Unknown @reduce handler section "${section.key}"`, { kind: "graph", id: context.graphId }, { section: section.key });
            continue;
        }
        if (section.value.type !== "ObjectLiteral") {
            pushDiagnostic(artifact, "errors", "INVALID_HANDLER_MAP", `@reduce handlers.${section.key} must be an object literal`, { kind: "graph", id: context.graphId }, { section: section.key });
            continue;
        }
        for (const entry of section.value.properties) {
            if (entry.value.type !== "StringLiteral") {
                pushDiagnostic(artifact, "errors", "INVALID_HANDLER_NAME", `@reduce handlers.${section.key}.${entry.key} must be a string literal`, { kind: "graph", id: context.graphId }, { section: section.key, key: entry.key });
                continue;
            }
            base[section.key][entry.key] = entry.value.value;
        }
    }
    return base;
}
function resolveSelection(context, artifact) {
    const selectArg = context.expr.args.find((arg) => arg.key?.name === "select")?.value;
    if (!selectArg) {
        artifact.source.select = null;
        return null;
    }
    const evaluated = evaluateValueExpr(selectArg, context.bindings, context.actions);
    artifact.source.select = cloneGraphValue(evaluated);
    if (typeof evaluated === "string") {
        const result = new Set([evaluated]);
        if (context.graph && !context.graph.nodes.has(evaluated)) {
            pushDiagnostic(artifact, "errors", "UNRESOLVED_SOURCE_ITEM", `Selected node "${evaluated}" does not exist in graph "${context.graphId}"`, { kind: "graph", id: context.graphId }, { select: evaluated });
        }
        return result;
    }
    if (Array.isArray(evaluated) && evaluated.every((item) => typeof item === "string")) {
        const result = new Set(evaluated);
        if (context.graph) {
            const missing = [...result].filter((item) => !context.graph.nodes.has(item));
            for (const nodeId of missing) {
                pushDiagnostic(artifact, "errors", "UNRESOLVED_SOURCE_ITEM", `Selected node "${nodeId}" does not exist in graph "${context.graphId}"`, { kind: "graph", id: context.graphId }, { select: nodeId });
            }
        }
        return result;
    }
    pushDiagnostic(artifact, "errors", "INVALID_SELECTION_TARGET", "@reduce select must resolve to a node id string or string array", { kind: "graph", id: context.graphId });
    return null;
}
function reduceNode(node, context, state) {
    if (state.seenNodeIds.has(node.id)) {
        pushDiagnostic(state.artifact, "errors", "DUPLICATE_REDUCED_ID", `Duplicate reduced node id "${node.id}"`, sourceRef("node", node.id));
        return;
    }
    state.seenNodeIds.add(node.id);
    state.artifact.payload.nodes.push({
        id: node.id,
        type: readNodeType(node),
        value: cloneGraphValue(node.value),
        state: state.artifact.include.state ? cloneRecord(node.state) : {},
        meta: state.artifact.include.meta ? cloneRecord(node.meta) : {},
        context: {},
        sourceRef: sourceRef("node", node.id),
    });
    emitInstruction(state, "registerNode", {
        id: node.id,
        nodeType: readNodeType(node),
    }, sourceRef("node", node.id));
}
function reduceEdge(edge, context, state) {
    if (state.seenEdgeIds.has(edge.id)) {
        pushDiagnostic(state.artifact, "errors", "DUPLICATE_REDUCED_ID", `Duplicate reduced edge id "${edge.id}"`, sourceRef("edge", edge.id));
        return;
    }
    state.seenEdgeIds.add(edge.id);
    state.artifact.payload.edges.push({
        id: edge.id,
        kind: normalizeEdgeKind(edge.kind),
        subject: edge.subject,
        relation: edge.relation,
        object: edge.object,
        state: {},
        meta: state.artifact.include.meta ? cloneRecord(edge.meta) : {},
        context: normalizeContextValue(state.artifact.include.context ? edge.context : null),
        sourceRef: sourceRef("edge", edge.id),
    });
    emitInstruction(state, "registerEdge", {
        id: edge.id,
        kind: edge.kind,
        subject: edge.subject,
        relation: edge.relation,
        object: edge.object,
    }, sourceRef("edge", edge.id));
    if (edge.kind === "progress") {
        const resolution = resolveHandler("transition", edge.relation, readEdgeLocalHandler(edge), state.handlers, state, sourceRef("edge", edge.id));
        emitInstruction(state, "transition", {
            edgeId: edge.id,
            from: edge.subject,
            relation: edge.relation,
            to: edge.object,
            handler: resolution.handler,
        }, sourceRef("edge", edge.id));
        return;
    }
    const resolution = resolveHandler("relation", edge.relation, readEdgeLocalHandler(edge), state.handlers, state, sourceRef("edge", edge.id));
    emitInstruction(state, "resolveEdge", {
        edgeId: edge.id,
        subject: edge.subject,
        relation: edge.relation,
        object: edge.object,
        handler: resolution.handler,
    }, sourceRef("edge", edge.id));
}
function reduceActionNode(node, context, state) {
    if (readNodeType(node) !== "action") {
        return;
    }
    if (state.seenActionIds.has(node.id)) {
        pushDiagnostic(state.artifact, "errors", "DUPLICATE_REDUCED_ID", `Duplicate reduced action id "${node.id}"`, sourceRef("node", node.id));
        return;
    }
    state.seenActionIds.add(node.id);
    const binding = readActionBinding(node);
    const label = readNodeLabel(node);
    const targetIds = resolveActionTargetIds(node, context.graph, state);
    const handlerResolution = binding
        ? resolveHandler("action", binding, readNodeLocalHandler(node), state.handlers, state, sourceRef("node", node.id))
        : { handler: null, resolutionMode: "unresolved" };
    state.artifact.payload.actions.push({
        id: node.id,
        binding,
        label,
        targetIds,
        handler: handlerResolution.handler,
        sourceRef: sourceRef("node", node.id),
    });
    if (!binding) {
        pushDiagnostic(state.artifact, "errors", "MISSING_ACTION_BINDING", `Action node "${node.id}" is missing a binding`, sourceRef("node", node.id));
        emitInstruction(state, "noop", {
            reason: "missingActionBinding",
            actionId: node.id,
        }, sourceRef("node", node.id));
        return;
    }
    emitInstruction(state, "registerAction", {
        id: node.id,
        binding,
        label,
        targetIds,
        handler: handlerResolution.handler,
    }, sourceRef("node", node.id));
    const runtimeAction = getAction(context.actions, binding);
    if (runtimeAction?.guard) {
        emitInstruction(state, "assertGuard", {
            binding,
            targetIds,
            guard: cloneGuard(runtimeAction.guard),
        }, sourceRef("node", node.id));
    }
}
function resolveActionTargetIds(node, graph, state) {
    const directTargets = getOutgoingEdges(graph, node.id, "branch")
        .filter((edge) => edge.relation === "targets")
        .map((edge) => edge.object);
    if (directTargets.length > 0) {
        return filterSelectedTargets(directTargets, state.selectedNodeIds);
    }
    const canSources = getIncomingEdges(graph, node.id, "branch")
        .filter((edge) => edge.relation === "can")
        .map((edge) => edge.subject);
    if (canSources.length > 1) {
        pushDiagnostic(state.artifact, "warnings", "AMBIGUOUS_ACTION_TARGET", `Action node "${node.id}" can be reached from multiple source nodes`, sourceRef("node", node.id), { sourceIds: canSources });
    }
    const inferredTargets = new Set();
    for (const subjectId of canSources) {
        for (const edge of getOutgoingEdges(graph, subjectId, "branch")) {
            if (edge.relation === "targets") {
                inferredTargets.add(edge.object);
            }
        }
    }
    return filterSelectedTargets([...inferredTargets], state.selectedNodeIds);
}
function filterSelectedTargets(targetIds, selectedNodeIds) {
    const filtered = selectedNodeIds
        ? targetIds.filter((targetId) => selectedNodeIds.has(targetId))
        : targetIds;
    return [...new Set(filtered)];
}
function resolveHandler(semanticType, semanticKey, localHandler, handlers, state, ref) {
    if (localHandler) {
        traceResolution(state, ref, semanticType, semanticKey, "local-explicit", localHandler);
        return {
            handler: localHandler,
            resolutionMode: "local-explicit",
        };
    }
    const scopedHandler = handlers[semanticType][semanticKey] ?? null;
    if (scopedHandler) {
        traceResolution(state, ref, semanticType, semanticKey, "scoped-handler", scopedHandler);
        return {
            handler: scopedHandler,
            resolutionMode: "scoped-handler",
        };
    }
    const fallbackHandler = buildFallbackHandlerName(semanticType, semanticKey);
    if (fallbackHandler) {
        traceResolution(state, ref, semanticType, semanticKey, "convention-fallback", fallbackHandler);
        pushDiagnostic(state.artifact, "warnings", "FALLBACK_HANDLER_USED", `Using fallback handler "${fallbackHandler}" for ${semanticType} "${semanticKey}"`, ref, {
            semanticType,
            semanticKey,
            handler: fallbackHandler,
        });
        return {
            handler: fallbackHandler,
            resolutionMode: "convention-fallback",
        };
    }
    traceResolution(state, ref, semanticType, semanticKey, "unresolved", null);
    pushDiagnostic(state.artifact, "warnings", "UNRESOLVED_HANDLER", `No handler found for ${semanticType} "${semanticKey}"`, ref, {
        semanticType,
        semanticKey,
    });
    return {
        handler: null,
        resolutionMode: "unresolved",
    };
}
function traceResolution(state, ref, semanticType, semanticKey, resolutionMode, handler) {
    if (!state.artifact.debug.enabled) {
        return;
    }
    state.artifact.debug.trace.push({
        step: "resolve-handler",
        sourceRef: ref,
        decision: {
            semanticType,
            semanticKey,
            resolutionMode,
            chosenHandler: handler,
        },
    });
}
function emitInstruction(state, op, args, ref) {
    if (!REDUCTION_OPCODES.includes(op)) {
        pushDiagnostic(state.artifact, "errors", "INVALID_INSTRUCTION_OPCODE", `Invalid reduction opcode "${op}"`, ref, { op });
        return;
    }
    if (!isJsonRecord(args)) {
        pushDiagnostic(state.artifact, "errors", "INVALID_INSTRUCTION_ARGS", `Invalid args for reduction opcode "${op}"`, ref, { op });
        return;
    }
    const id = `instr_${state.nextInstructionId++}`;
    if (state.seenInstructionIds.has(id)) {
        pushDiagnostic(state.artifact, "errors", "DUPLICATE_REDUCED_ID", `Duplicate reduction instruction id "${id}"`, ref);
        return;
    }
    state.seenInstructionIds.add(id);
    state.artifact.payload.instructions.push({
        id,
        op,
        args: cloneRecord(args),
        sourceRef: ref,
    });
}
function validateArtifactIntegrity(artifact) {
    for (const record of artifact.payload.nodes) {
        if (!record.sourceRef) {
            pushDiagnostic(artifact, "errors", "MISSING_SOURCE_REF", `Reduced node "${record.id}" is missing a sourceRef`, sourceRef("node", record.id));
        }
    }
    for (const record of artifact.payload.edges) {
        if (!record.sourceRef) {
            pushDiagnostic(artifact, "errors", "MISSING_SOURCE_REF", `Reduced edge "${record.id}" is missing a sourceRef`, sourceRef("edge", record.id));
        }
    }
    for (const record of artifact.payload.actions) {
        if (!record.sourceRef) {
            pushDiagnostic(artifact, "errors", "MISSING_SOURCE_REF", `Reduced action "${record.id}" is missing a sourceRef`, sourceRef("node", record.id));
        }
    }
    for (const record of artifact.payload.instructions) {
        if (!record.sourceRef) {
            pushDiagnostic(artifact, "errors", "MISSING_SOURCE_REF", `Reduction instruction "${record.id}" is missing a sourceRef`, sourceRef("graph", artifact.source.graphId));
        }
        if (!REDUCTION_OPCODES.includes(record.op)) {
            pushDiagnostic(artifact, "errors", "INVALID_INSTRUCTION_OPCODE", `Invalid reduction opcode "${record.op}"`, record.sourceRef);
        }
    }
}
function pushDiagnostic(artifact, channel, code, message, ref, details = {}) {
    artifact.diagnostics[channel].push({
        code,
        severity: channel === "warnings" ? "warning" : "error",
        message,
        sourceRef: ref,
        details: cloneRecord(details),
    });
}
function readStringLiteral(node) {
    return node?.type === "StringLiteral" ? node.value : null;
}
function readBooleanLiteral(node) {
    return node?.type === "BooleanLiteral" ? node.value : null;
}
function readNodeType(node) {
    return isRecord(node.value) && typeof node.value.type === "string"
        ? node.value.type
        : null;
}
function readNodeLabel(node) {
    if (typeof node.meta.label === "string") {
        return node.meta.label;
    }
    if (isRecord(node.value)) {
        if (typeof node.value.label === "string") {
            return node.value.label;
        }
        if (typeof node.value.name === "string") {
            return node.value.name;
        }
    }
    return null;
}
function readActionBinding(node) {
    return isRecord(node.value) && typeof node.value.binding === "string"
        ? node.value.binding
        : null;
}
function readNodeLocalHandler(node) {
    if (isRecord(node.value) && typeof node.value.handler === "string") {
        return node.value.handler;
    }
    if (typeof node.meta.handler === "string") {
        return node.meta.handler;
    }
    return null;
}
function readEdgeLocalHandler(edge) {
    if (typeof edge.meta.handler === "string") {
        return edge.meta.handler;
    }
    if (isRecord(edge.context) && typeof edge.context.handler === "string") {
        return edge.context.handler;
    }
    return null;
}
function buildFallbackHandlerName(semanticType, semanticKey) {
    if (!semanticKey) {
        return null;
    }
    if (semanticType === "transition") {
        return `${semanticKey}TransitionHandler`;
    }
    return `${semanticKey}Handler`;
}
function normalizeEdgeKind(kind) {
    if (kind === "branch" || kind === "progress") {
        return kind;
    }
    return "unknown";
}
function normalizeContextValue(value) {
    if (value === null) {
        return {};
    }
    if (isRecord(value)) {
        return cloneRecord(value);
    }
    return {
        value: cloneGraphValue(value),
    };
}
function sourceRef(kind, id) {
    return { kind, id };
}
function cloneGuard(guard) {
    return JSON.parse(JSON.stringify(guard));
}
function cloneRecord(value) {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
        out[key] = cloneGraphValue(entry);
    }
    return out;
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isJsonRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isReductionOutput(value) {
    return REDUCTION_OUTPUTS.includes(value);
}
function isReductionStrategy(value) {
    return REDUCTION_STRATEGIES.includes(value);
}
function isReductionIncludeKey(value) {
    return REDUCTION_INCLUDE_KEYS.includes(value);
}
