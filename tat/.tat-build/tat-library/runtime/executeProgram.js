import { addHistoryEntry, addNode, addBranch, addProgress, clearEdgeContext, cloneGraph, createGraph, removeBranch, removeNode, removeNodeMeta, removeNodeState, setEdgeContext, setNodeMeta, setNodeState, } from "./graph.js";
import { classifyBindValue, evaluateBindExpr, } from "./bindUtils.js";
import { createRuntimeBindings, evaluateNodeCapture, evaluateValueExpr, registerNodeBinding, registerValueBinding, } from "./evaluateNodeCapture.js";
import { executeQuery } from "./executeQuery.js";
import { executeAction } from "./executeAction.js";
import { createActionRegistry, registerAction, } from "./actionRegistry.js";
import { REACTIVE_TRIGGER_SAFETY_CAP, evaluateGraphControlExpr, } from "./evaluateGraphControl.js";
import { projectGraphResult } from "./projection.js";
import { reduceGraphResult } from "./reduction.js";
import { graphInteractionFromAst, } from "./executeGraphInteraction.js";
export function executeProgram(program, options) {
    const initialState = options?.initialState;
    const state = {
        bindings: initialState?.bindings ?? createRuntimeBindings(),
        actions: initialState?.actions ?? createActionRegistry(),
        assetKinds: initialState?.assetKinds ?? new Map(),
        seed: initialState?.seed ?? null,
        seedGraph: initialState?.seedGraph ?? null,
        graphs: initialState?.graphs ?? new Map(),
        graphFocus: initialState?.graphFocus ?? new Map(),
        projectionDefinitions: initialState?.projectionDefinitions ?? new Map(),
        projections: initialState?.projections ?? new Map(),
        graphInteractions: initialState?.graphInteractions ?? new Map(),
        anonymousGraphInteractions: initialState?.anonymousGraphInteractions ?? [],
        interactionHistory: initialState?.interactionHistory ?? [],
        systemRelations: initialState?.systemRelations ?? [],
        queries: initialState?.queries ?? [],
        queryResults: initialState?.queryResults ?? [],
        whenTriggers: initialState?.whenTriggers ?? [],
        lastGraphName: initialState?.lastGraphName ?? null,
        terminalProjectReached: initialState?.terminalProjectReached ?? false,
    };
    for (const statement of program.body) {
        executeStatement(statement, state);
    }
    return { state };
}
export function reprojectRuntimeState(program, state, options) {
    const projections = new Map();
    for (const statement of program.body) {
        if (statement.type === "GraphPipeline") {
            const graph = state.graphs.get(statement.name.name);
            if (!graph) {
                continue;
            }
            projections.set(statement.name.name, executeTerminalGraphExpr(statement.name.name, graph, withResolvedProjectionFocus(statement.name.name, statement.name.name, statement.projection, state, options), state));
            continue;
        }
        if (statement.type === "GraphProjection") {
            const graph = state.graphs.get(statement.source.name);
            if (!graph) {
                continue;
            }
            projections.set(statement.name.name, executeTerminalGraphExpr(statement.name.name, graph, withResolvedProjectionFocus(statement.name.name, statement.source.name, statement.projection, state, options), state, statement.source.name));
        }
    }
    return projections;
}
export function setRuntimeFocus(program, state, request) {
    const graph = state.graphs.get(request.graphBinding);
    if (!graph) {
        throw new Error(`Graph "${request.graphBinding}" is not available in runtime state`);
    }
    if (!graph.nodes.has(request.nodeId)) {
        throw new Error(`Focus node "${request.nodeId}" does not exist in graph "${request.graphBinding}"`);
    }
    const graphFocus = new Map(state.graphFocus);
    graphFocus.set(request.graphBinding, request.nodeId);
    const nextState = {
        ...state,
        graphFocus,
    };
    return {
        ...nextState,
        projections: reprojectRuntimeState(program, nextState),
    };
}
export function applyRuntimeAction(program, state, request, options) {
    const originalGraph = state.graphs.get(request.graphBinding);
    if (!originalGraph) {
        throw new Error(`Graph "${request.graphBinding}" is not available in runtime state`);
    }
    const graph = cloneGraph(originalGraph);
    const result = applyRuntimeActionToGraph(graph, state, request);
    if (!result.didRun) {
        return state;
    }
    const graphs = new Map(state.graphs);
    graphs.set(request.graphBinding, graph);
    const nextState = {
        ...state,
        graphs,
    };
    return {
        ...nextState,
        projections: reprojectRuntimeState(program, nextState, options),
    };
}
export function applyRuntimeActionToGraph(graph, state, request, options) {
    const actionName = request.action ?? request.hook;
    if (!actionName) {
        throw new Error("Runtime action request requires an action or hook");
    }
    const action = state.actions.get(actionName);
    if (!action) {
        throw new Error(`@apply could not find action "${actionName}"`);
    }
    const resolvedTarget = resolveRuntimeActionTarget(graph, action, request);
    const reactive = createReactiveCycleState(graph, state);
    const applyEvent = addHistoryEntry(graph, {
        op: "@apply",
        payload: {
            from: request.from,
            action: actionName,
            hook: request.hook ?? actionName,
            to: resolvedTarget ?? null,
        },
    }, { causedBy: options?.causedBy });
    const result = executeAction(graph, action, {
        from: request.from,
        to: resolvedTarget,
        payload: request.payload,
    }, state.actions, {
        causedBy: applyEvent.id,
        onGraphMutation: () => flushReactiveTriggers(graph, state, reactive),
    });
    if (!result.didRun) {
        graph.history = graph.history.filter((entry) => entry.id !== applyEvent.id);
    }
    return { didRun: result.didRun };
}
function resolveRuntimeActionTarget(graph, action, request) {
    if (request.to) {
        return request.to;
    }
    if (request.target) {
        return request.target;
    }
    const generatedTargetExpr = findGeneratedNodeIdExpr(action.pipeline);
    if (!generatedTargetExpr) {
        return undefined;
    }
    return generateRuntimeNodeIdForAction(graph, generatedTargetExpr.prefix?.value ?? null);
}
function findGeneratedNodeIdExpr(steps) {
    for (const step of steps) {
        if (step.type === "RuntimeAddNodeExpr" && step.node.type === "RuntimeGenerateNodeIdExpr") {
            return step.node;
        }
        if (step.type === "IfExpr") {
            const thenMatch = findGeneratedNodeIdExpr(step.then);
            if (thenMatch)
                return thenMatch;
            const elseMatch = step.else ? findGeneratedNodeIdExpr(step.else) : null;
            if (elseMatch)
                return elseMatch;
        }
        if (step.type === "LoopExpr") {
            const loopMatch = findGeneratedNodeIdExpr(step.pipeline);
            if (loopMatch)
                return loopMatch;
        }
    }
    return null;
}
function generateRuntimeNodeIdForAction(graph, prefix) {
    const normalizedPrefix = prefix?.trim() || "node";
    const counter = graph.history.length + 1;
    return `${normalizedPrefix}Node_${counter}`;
}
function executeStatement(statement, state) {
    switch (statement.type) {
        case "ImportDeclaration":
        case "ExportDeclaration":
            return;
        case "ValueBinding":
            executeValueBinding(statement, state);
            return;
        case "BindStatement":
            ensureProjectNotTerminal(state, "@bind");
            executeBindStatement(statement, state);
            return;
        case "OperatorBinding":
            executeOperatorBinding(statement, state);
            return;
        case "ProjectionDef":
            executeProjectionDefinition(statement, state);
            return;
        case "SeedBlock":
            state.seed = statement;
            state.seedGraph = buildSeedGraph(statement, state.bindings);
            return;
        case "GraphPipeline":
            executeGraphPipeline(statement, state);
            return;
        case "GraphProjection":
            executeGraphProjection(statement, state);
            return;
        case "WhenExpr":
            executeWhenExpr(statement, state);
            return;
        case "GraphInteractionDefinition":
            executeGraphInteractionDefinition(statement, state);
            return;
        case "SystemRelation":
            executeSystemRelation(statement, state);
            return;
        case "QueryStatement":
            executeQueryStatement(statement, state);
            return;
        default: {
            const _exhaustive = statement;
            throw new Error(`Unsupported statement type: ${JSON.stringify(_exhaustive)}`);
        }
    }
}
function executeProjectionDefinition(statement, state) {
    state.projectionDefinitions.set(statement.name.name, statement);
    state.assetKinds.set(statement.name.name, "projection");
}
function withResolvedProjectionFocus(projectionName, graphBinding, projection, state, options) {
    if (!projection) {
        return projection;
    }
    const focusOverrides = options?.focusOverrides;
    const runtimeFocus = state.graphFocus.get(graphBinding) ?? null;
    const fallbackOverride = focusOverrides?.[projectionName] ?? null;
    const resolvedFocus = runtimeFocus ?? fallbackOverride;
    const argumentOverrides = options?.argumentOverrides?.[projectionName] ?? {};
    const nextArgs = projection.args.filter((arg) => {
        const key = arg.key?.name ?? null;
        if (key === "focus" && resolvedFocus) {
            return false;
        }
        if (key && Object.prototype.hasOwnProperty.call(argumentOverrides, key)) {
            return false;
        }
        return true;
    });
    if (resolvedFocus) {
        nextArgs.push({
            type: "Argument",
            key: {
                type: "Identifier",
                name: "focus",
            },
            value: {
                type: "StringLiteral",
                value: resolvedFocus,
                raw: JSON.stringify(resolvedFocus),
            },
        });
    }
    for (const [key, value] of Object.entries(argumentOverrides)) {
        nextArgs.push({
            type: "Argument",
            key: {
                type: "Identifier",
                name: key,
            },
            value: graphValueToValueExpr(value),
        });
    }
    return {
        ...projection,
        args: nextArgs,
    };
}
function graphValueToValueExpr(value) {
    if (typeof value === "string") {
        const node = {
            type: "StringLiteral",
            value,
            raw: JSON.stringify(value),
        };
        return node;
    }
    if (typeof value === "number") {
        const node = {
            type: "NumberLiteral",
            value,
            raw: String(value),
        };
        return node;
    }
    if (typeof value === "boolean") {
        const node = {
            type: "BooleanLiteral",
            value,
            raw: String(value),
        };
        return node;
    }
    if (Array.isArray(value)) {
        const node = {
            type: "ArrayLiteral",
            elements: value.map((item) => graphValueToValueExpr(item)),
        };
        return node;
    }
    if (value && typeof value === "object") {
        const node = {
            type: "ObjectLiteral",
            properties: Object.entries(value).map(([key, entryValue]) => ({
                type: "ObjectProperty",
                key,
                value: graphValueToValueExpr(entryValue),
            })),
        };
        return node;
    }
    throw new Error("Runtime projection argument overrides do not support null values");
}
function executeValueBinding(statement, state) {
    const name = statement.name.name;
    if (statement.value.type === "NodeCapture") {
        const evaluated = evaluateNodeCapture(name, statement.value, state.bindings, state.actions);
        registerNodeBinding(state.bindings, name, evaluated.node);
        state.assetKinds.set(name, "node");
        return;
    }
    const value = evaluateValueExpr(statement.value, state.bindings, state.actions);
    registerValueBinding(state.bindings, name, value);
}
function executeBindStatement(statement, state) {
    const graph = getCurrentGraph(state);
    const value = evaluateBindExpr(statement.expression, state.bindings, state.actions, graph);
    if (statement.entity) {
        const kind = classifyBindValue(value);
        if (kind !== "empty" && kind !== statement.entity) {
            throw new Error(`@bind.${statement.layer ?? "ctx"}.${statement.entity} expected ${statement.entity} result, got ${kind}`);
        }
    }
    const layer = statement.layer ?? "ctx";
    switch (layer) {
        case "ctx":
            writeBindToContext(state, statement.name.name, value);
            return;
        case "state": {
            const target = requireCurrentGraph(state, "@bind.state");
            target.state[statement.name.name] = deepCloneBindValue(value);
            return;
        }
        case "meta": {
            const target = requireCurrentGraph(state, "@bind.meta");
            target.meta[statement.name.name] = deepCloneBindValue(value);
            return;
        }
        default: {
            const _exhaustive = layer;
            throw new Error(`Unsupported @bind layer: ${JSON.stringify(_exhaustive)}`);
        }
    }
}
function executeOperatorBinding(statement, state) {
    const name = statement.name.name;
    switch (statement.value.type) {
        case "ActionExpr":
            registerAction(state.actions, {
                bindingName: name,
                guard: statement.value.guard,
                pipeline: statement.value.pipeline,
                project: statement.value.project,
            });
            state.assetKinds.set(name, "program");
            return;
        case "CtxExpr":
            return;
        case "ProjectExpr":
        case "ReduceExpr":
            return;
        default: {
            const _exhaustive = statement.value;
            throw new Error(`Unsupported operator binding type: ${JSON.stringify(_exhaustive)}`);
        }
    }
}
function buildSeedGraph(seed, bindings) {
    const stateValue = evaluateValueExpr(seed.state, bindings, createActionRegistry());
    const metaValue = evaluateValueExpr(seed.meta, bindings, createActionRegistry());
    if (!isRecordValue(stateValue)) {
        throw new Error(`@seed state must resolve to an object`);
    }
    if (!isRecordValue(metaValue)) {
        throw new Error(`@seed meta must resolve to an object`);
    }
    const graph = createGraph(seed.root.name, stateValue, metaValue);
    for (const nodeRef of seed.nodes) {
        const node = bindings.nodes.get(nodeRef.ref.name);
        if (!node) {
            throw new Error(`Seed references unknown node binding "${nodeRef.ref.name}"`);
        }
        addNode(graph, cloneRuntimeNode(node));
    }
    for (const edge of seed.edges) {
        const entry = materializeSeedEdgeEntry(edge);
        const before = graph.edges.length;
        addBranch(graph, entry.subject, entry.relation, entry.object);
        if (entry.id && graph.edges.length > before) {
            graph.edges[graph.edges.length - 1].id = entry.id;
        }
    }
    return graph;
}
function materializeSeedEdgeEntry(entry) {
    if (entry.type === "SeedEdgeBinding") {
        return {
            id: entry.name.name,
            subject: entry.edge.left.name,
            relation: entry.edge.relation.value,
            object: entry.edge.right.name,
        };
    }
    return {
        id: null,
        subject: entry.left.name,
        relation: entry.relation.value,
        object: entry.right.name,
    };
}
function executeGraphPipeline(pipeline, state) {
    const graph = materializeGraphSource(pipeline.source, state);
    const reactive = createReactiveCycleState(graph, state);
    for (const mutation of pipeline.mutations) {
        executeGraphPipelineStep(graph, mutation, state, reactive);
    }
    state.graphs.set(pipeline.name.name, graph);
    initializeGraphFocus(state, pipeline.name.name, graph, pipeline.projection);
    state.assetKinds.set(pipeline.name.name, "graph");
    state.projections.set(pipeline.name.name, executeTerminalGraphExpr(pipeline.name.name, graph, pipeline.projection, state));
    state.lastGraphName = pipeline.name.name;
    if (pipeline.projection) {
        state.terminalProjectReached = true;
    }
}
function executeGraphProjection(statement, state) {
    const graphName = statement.source.name;
    const graph = state.graphs.get(graphName);
    if (!graph) {
        if (statement.projection.type === "ReduceExpr") {
            const result = reduceGraphResult({
                graphId: graphName,
                graph: null,
                expr: statement.projection,
                bindings: state.bindings,
                actions: state.actions,
            });
            state.projections.set(statement.name.name, result);
            state.assetKinds.set(statement.name.name, "projection");
            return;
        }
        throw new Error(`${statement.projection.name} source "${graphName}" is not a graph value — ensure it is declared before this projection`);
    }
    initializeGraphFocus(state, graphName, graph, statement.projection);
    const result = executeTerminalGraphExpr(statement.name.name, graph, statement.projection, state, statement.source.name);
    state.projections.set(statement.name.name, result);
    state.assetKinds.set(statement.name.name, "projection");
}
function executeTerminalGraphExpr(projectionName, graph, projection, state, sourceGraphId) {
    if (!projection || projection.type === "ProjectExpr") {
        return projectGraphResult(graph, projection, state);
    }
    return reduceGraphResult({
        graphId: sourceGraphId ?? projectionName,
        graph,
        expr: projection,
        bindings: state.bindings,
        actions: state.actions,
    });
}
function initializeGraphFocus(state, graphBinding, graph, projection) {
    if (state.graphFocus.has(graphBinding)) {
        return;
    }
    const initialFocus = resolveInitialGraphFocus(projection, graph, state);
    if (initialFocus) {
        state.graphFocus.set(graphBinding, initialFocus);
    }
}
function executeWhenExpr(statement, state) {
    if (!statement.query) {
        throw new Error("@when requires a query");
    }
    if (!statement.pipeline.length) {
        throw new Error("@when requires a pipeline");
    }
    state.whenTriggers.push({
        id: `when_${state.whenTriggers.length}`,
        query: statement.query,
        pipeline: statement.pipeline,
    });
}
function createReactiveCycleState(graph, state) {
    const triggerStates = new Map();
    for (const trigger of state.whenTriggers) {
        triggerStates.set(trigger.id, evaluateGraphControlExpr(graph, trigger.query, {
            bindings: state.bindings,
            actions: state.actions,
        }));
    }
    return {
        triggerStates,
        fireCount: 0,
    };
}
function executeGraphPipelineStep(graph, step, state, reactive) {
    if (step.type === "IfExpr") {
        executeGraphIfExpr(graph, step, state, reactive);
        return;
    }
    if (step.type === "WhenExpr") {
        executeInlineWhenExpr(graph, step, state, reactive);
        return;
    }
    executeGraphMutationStep(graph, step, state, reactive);
}
function executeInlineWhenExpr(graph, step, state, reactive) {
    if (!step.query) {
        throw new Error("@when requires a query");
    }
    if (!step.pipeline.length) {
        throw new Error("@when requires a pipeline");
    }
    const id = `when_${state.whenTriggers.length}`;
    const current = evaluateGraphControlExpr(graph, step.query, {
        bindings: state.bindings,
        actions: state.actions,
    });
    state.whenTriggers.push({
        id,
        query: step.query,
        pipeline: step.pipeline,
    });
    reactive.triggerStates.set(id, current);
}
function executeGraphIfExpr(graph, step, state, reactive) {
    if (!step.when) {
        throw new Error("@if requires a when clause");
    }
    if (!step.then.length) {
        throw new Error("@if requires a then pipeline");
    }
    const branch = evaluateGraphControlExpr(graph, step.when, {
        bindings: state.bindings,
        actions: state.actions,
    })
        ? step.then
        : step.else;
    if (!branch) {
        return;
    }
    for (const branchStep of branch) {
        executeGraphPipelineStep(graph, branchStep, state, reactive);
    }
}
function executeGraphMutationStep(graph, mutation, state, reactive) {
    switch (mutation.type) {
        case "GraftBranchExpr":
            {
                const metadata = mutation.metadata
                    ? evaluateValueExpr(mutation.metadata, state.bindings, state.actions)
                    : null;
                if (metadata !== null && (typeof metadata !== "object" || Array.isArray(metadata))) {
                    throw new Error("@graft.branch metadata must evaluate to an object");
                }
                addBranch(graph, mutation.subject.name, mutation.relation.value, mutation.object.name, {
                    metadata: (metadata ?? undefined),
                });
                flushReactiveTriggers(graph, state, reactive);
                return;
            }
        case "GraftStateExpr": {
            const value = evaluateValueExpr(mutation.value, state.bindings, state.actions);
            setNodeState(graph, mutation.node.name, mutation.key.value, value);
            flushReactiveTriggers(graph, state, reactive);
            return;
        }
        case "GraftMetaExpr": {
            const value = evaluateValueExpr(mutation.value, state.bindings, state.actions);
            setNodeMeta(graph, mutation.node.name, mutation.key.value, value);
            flushReactiveTriggers(graph, state, reactive);
            return;
        }
        case "GraftProgressExpr":
            addProgress(graph, mutation.from.name, mutation.relation.value, mutation.to.name);
            flushReactiveTriggers(graph, state, reactive);
            return;
        case "PruneBranchExpr":
            {
                const metadata = mutation.metadata
                    ? evaluateValueExpr(mutation.metadata, state.bindings, state.actions)
                    : null;
                if (metadata !== null && (typeof metadata !== "object" || Array.isArray(metadata))) {
                    throw new Error("@prune.branch metadata must evaluate to an object");
                }
                removeBranch(graph, mutation.subject.name, mutation.relation.value, mutation.object.name, {
                    metadata: (metadata ?? undefined),
                });
                flushReactiveTriggers(graph, state, reactive);
                return;
            }
        case "PruneStateExpr":
            removeNodeState(graph, mutation.node.name, mutation.key.value);
            flushReactiveTriggers(graph, state, reactive);
            return;
        case "PruneMetaExpr":
            removeNodeMeta(graph, mutation.node.name, mutation.key.value);
            flushReactiveTriggers(graph, state, reactive);
            return;
        case "PruneNodesExpr":
            executePruneNodesExpr(graph, mutation, state);
            flushReactiveTriggers(graph, state, reactive);
            return;
        case "PruneEdgesExpr":
            executePruneEdgesExpr(graph, mutation, state);
            flushReactiveTriggers(graph, state, reactive);
            return;
        case "CtxSetExpr": {
            const context = evaluateValueExpr(mutation.context, state.bindings, state.actions);
            setEdgeContext(graph, mutation.edge.name, context);
            flushReactiveTriggers(graph, state, reactive);
            return;
        }
        case "CtxClearExpr":
            clearEdgeContext(graph, mutation.edge.name);
            flushReactiveTriggers(graph, state, reactive);
            return;
        case "ApplyExpr":
            executeApplyExpr(graph, mutation, state, reactive);
            return;
        default: {
            throw new Error(`Unsupported mutation type: ${JSON.stringify(mutation)}`);
        }
    }
}
function flushReactiveTriggers(graph, state, reactive) {
    if (state.whenTriggers.length === 0) {
        return;
    }
    while (true) {
        let fired = false;
        for (const trigger of state.whenTriggers) {
            const current = evaluateGraphControlExpr(graph, trigger.query, {
                bindings: state.bindings,
                actions: state.actions,
            });
            const previous = reactive.triggerStates.get(trigger.id) ?? false;
            if (!current) {
                reactive.triggerStates.set(trigger.id, false);
                continue;
            }
            if (previous) {
                continue;
            }
            reactive.triggerStates.set(trigger.id, true);
            reactive.fireCount += 1;
            if (reactive.fireCount > REACTIVE_TRIGGER_SAFETY_CAP) {
                throw new Error(`@when exceeded reactive safety cap of ${REACTIVE_TRIGGER_SAFETY_CAP} firings in a single execution cycle`);
            }
            for (const step of trigger.pipeline) {
                executeGraphPipelineStep(graph, step, state, reactive);
            }
            fired = true;
            break;
        }
        if (!fired) {
            return;
        }
    }
}
function executeGraphInteractionDefinition(statement, state) {
    const fallbackId = `__interaction_${state.anonymousGraphInteractions.length}`;
    const interaction = graphInteractionFromAst(statement, fallbackId);
    if (statement.name) {
        state.graphInteractions.set(statement.name.name, interaction);
        state.assetKinds.set(statement.name.name, "interaction");
        return;
    }
    state.anonymousGraphInteractions.push(interaction);
}
function materializeGraphSource(source, state) {
    if (source.type === "SeedSource") {
        if (!state.seedGraph) {
            throw new Error(`Cannot execute graph pipeline from @seed before @seed is defined`);
        }
        return cloneGraph(state.seedGraph);
    }
    return executeComposeSource(source, state);
}
function executeComposeSource(compose, state) {
    const mergeSymbol = compose.merge.name;
    const mergeNodeId = resolveMergeNodeId(mergeSymbol, state);
    const out = createGraph(mergeNodeId);
    for (const asset of compose.assets) {
        const assetName = asset.name;
        const kind = state.assetKinds.get(assetName);
        if (!kind) {
            throw new Error(`@compose input "${assetName}" is unresolved`);
        }
        if (kind !== "graph" && kind !== "fragment") {
            throw new Error(`Invalid @compose input kind for "${assetName}": expected graph or fragment, got ${kind}`);
        }
        const sourceGraph = state.graphs.get(assetName);
        if (!sourceGraph) {
            throw new Error(`@compose input "${assetName}" is not a graph value`);
        }
        const sourceMergeNode = sourceGraph.nodes.get(mergeNodeId);
        if (!sourceMergeNode) {
            throw new Error(`Missing merge anchor "${mergeNodeId}" in composed asset "${assetName}"`);
        }
        if (!out.nodes.has(mergeNodeId)) {
            addNode(out, cloneRuntimeNode(sourceMergeNode));
        }
        for (const [nodeId, node] of sourceGraph.nodes.entries()) {
            if (nodeId === mergeNodeId) {
                continue;
            }
            if (out.nodes.has(nodeId)) {
                throw new Error(`Duplicate non-merge node id "${nodeId}" during @compose`);
            }
            addNode(out, cloneRuntimeNode(node));
        }
        for (const edge of sourceGraph.edges) {
            out.edges.push({ ...edge });
        }
        for (const entry of sourceGraph.history) {
            out.history.push({
                id: entry.id,
                op: entry.op,
                payload: deepCloneRecord(entry.payload),
            });
        }
    }
    out.root = mergeNodeId;
    return out;
}
function resolveMergeNodeId(mergeSymbol, state) {
    if (state.bindings.nodes.has(mergeSymbol)) {
        return state.bindings.nodes.get(mergeSymbol).id;
    }
    if (state.bindings.values.has(mergeSymbol)) {
        const resolved = state.bindings.values.get(mergeSymbol);
        if (typeof resolved === "string") {
            return resolved;
        }
    }
    throw new Error(`Invalid merge symbol "${mergeSymbol}": expected an in-scope node symbol`);
}
function executePruneNodesExpr(graph, mutation, state) {
    const targets = Array.from(graph.nodes.values())
        .filter((node) => evaluatePruneWhereNode(mutation.where.expression, node, state.bindings))
        .map((node) => node.id);
    for (const nodeId of targets) {
        removeNode(graph, nodeId);
    }
}
function executePruneEdgesExpr(graph, mutation, state) {
    const removeIds = new Set(graph.edges
        .filter((edge) => evaluatePruneWhereEdge(mutation.where.expression, edge, state.bindings))
        .map((edge) => edge.id));
    graph.edges = graph.edges.filter((edge) => !removeIds.has(edge.id));
}
function resolveInitialGraphFocus(projection, graph, state) {
    const focusArg = projection?.args.find((arg) => arg.key?.name === "focus") ?? null;
    const effectiveFocusValue = focusArg?.value ??
        (projection?.type === "ProjectExpr" && projection.projectionName
            ? state.projectionDefinitions.get(projection.projectionName.name)?.focus ?? null
            : null);
    if (!effectiveFocusValue) {
        return graph.root;
    }
    if (effectiveFocusValue.type === "Identifier" && state.bindings.nodes.has(effectiveFocusValue.name)) {
        return state.bindings.nodes.get(effectiveFocusValue.name).id;
    }
    const value = evaluateValueExpr(effectiveFocusValue, state.bindings, state.actions);
    if (typeof value === "string" && graph.nodes.has(value)) {
        return value;
    }
    return graph.root;
}
function executeApplyExpr(graph, mutation, state, reactive) {
    const targetValue = evaluateValueExpr(mutation.target, state.bindings, state.actions);
    if (!isRecordValue(targetValue) || targetValue.kind !== "traversal") {
        throw new Error(`@apply target must resolve to a traversal value`);
    }
    const steps = targetValue.steps;
    if (!Array.isArray(steps)) {
        throw new Error(`@apply target must resolve to a traversal value`);
    }
    if (steps.length === 0) {
        throw new Error(`@apply traversal must contain at least one step`);
    }
    const firstStep = steps[0];
    if (!isRecordValue(firstStep) || typeof firstStep.binding !== "string") {
        throw new Error(`@apply traversal step is missing an action binding`);
    }
    if (typeof firstStep.fromRef !== "string") {
        throw new Error(`@apply traversal step is missing fromRef`);
    }
    if (typeof firstStep.toRef !== "string") {
        throw new Error(`@apply traversal step is missing toRef`);
    }
    const action = state.actions.get(firstStep.binding);
    if (!action) {
        throw new Error(`@apply could not find action "${firstStep.binding}"`);
    }
    const applyEvent = addHistoryEntry(graph, {
        op: "@apply",
        payload: {
            from: firstStep.fromRef,
            action: firstStep.binding,
            to: firstStep.toRef,
        },
    });
    executeAction(graph, action, {
        from: firstStep.fromRef,
        to: firstStep.toRef,
    }, state.actions, reactive
        ? {
            causedBy: applyEvent.id,
            onGraphMutation: () => flushReactiveTriggers(graph, state, reactive),
        }
        : { causedBy: applyEvent.id });
}
function executeSystemRelation(statement, state) {
    const left = statement.left.name;
    const right = statement.right.name;
    if (!state.graphs.has(left)) {
        throw new Error(`System relation references unknown graph "${left}"`);
    }
    if (!state.graphs.has(right)) {
        throw new Error(`System relation references unknown graph "${right}"`);
    }
    state.systemRelations.push({
        left,
        relation: statement.relation ? statement.relation.value : null,
        right,
    });
}
function executeQueryStatement(statement, state) {
    let graph = getCurrentGraph(state);
    let graphName = state.lastGraphName ?? "seed";
    if (!graph) {
        throw new Error(`Cannot execute query before @seed or any graph pipeline has run`);
    }
    const result = executeQuery(graph, statement.expr, state.bindings, state.actions, createQueryWorkspace(state));
    state.queries.push(statement);
    state.queryResults.push({
        query: statement,
        graphName,
        result,
    });
}
function createQueryWorkspace(state) {
    const graphs = new Map(state.graphs);
    if (state.seedGraph && !graphs.has("seed")) {
        graphs.set("seed", state.seedGraph);
    }
    return {
        graphs,
        interactionHistory: state.interactionHistory,
    };
}
function getCurrentGraph(state) {
    if (state.lastGraphName) {
        return state.graphs.get(state.lastGraphName) ?? null;
    }
    return state.seedGraph;
}
function ensureProjectNotTerminal(state, opName) {
    if (state.terminalProjectReached) {
        throw new Error(`${opName} cannot execute after terminal @project(...) or @reduce(...)`);
    }
}
function requireCurrentGraph(state, opName) {
    const graph = getCurrentGraph(state);
    if (!graph) {
        throw new Error(`${opName} requires an active graph from @seed or a graph pipeline`);
    }
    return graph;
}
function writeBindToContext(state, name, value) {
    if (isGraphNodeLike(value)) {
        registerNodeBinding(state.bindings, name, value);
        return;
    }
    registerValueBinding(state.bindings, name, deepCloneBindValue(value));
}
function isGraphNodeLike(value) {
    return (!!value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof value.id === "string" &&
        "value" in value &&
        "state" in value &&
        "meta" in value);
}
function deepCloneBindValue(value) {
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => deepCloneBindValue(item));
    }
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        out[key] = deepCloneBindValue(item);
    }
    return out;
}
function evaluatePruneWhereNode(expr, node, bindings) {
    return evaluatePruneExpr(expr, "node", node, bindings);
}
function evaluatePruneWhereEdge(expr, edge, bindings) {
    return evaluatePruneExpr(expr, "edge", edge, bindings);
}
function evaluatePruneExpr(expr, context, item, bindings) {
    switch (expr.type) {
        case "GroupedBooleanExpr":
            return evaluatePruneExpr(expr.expression, context, item, bindings);
        case "BinaryBooleanExpr":
            if (expr.operator === "&&") {
                return (evaluatePruneExpr(expr.left, context, item, bindings) &&
                    evaluatePruneExpr(expr.right, context, item, bindings));
            }
            if (expr.operator === "||") {
                return (evaluatePruneExpr(expr.left, context, item, bindings) ||
                    evaluatePruneExpr(expr.right, context, item, bindings));
            }
            throw new Error(`Malformed @where predicate syntax: unsupported boolean operator "${expr.operator}"`);
        case "ComparisonExpr": {
            if (expr.operator !== "==" && expr.operator !== "!=") {
                throw new Error(`Malformed @where predicate syntax: unsupported comparison operator "${expr.operator}"`);
            }
            const left = resolvePruneValue(expr.left, context, item, bindings);
            const right = resolvePruneValue(expr.right, context, item, bindings);
            const equal = comparePruneValue(left, right);
            return expr.operator === "==" ? equal : !equal;
        }
        default:
            throw new Error(`Malformed @where predicate syntax: expected comparisons grouped with && / ||`);
    }
}
function resolvePruneValue(value, context, item, bindings) {
    switch (value.type) {
        case "StringLiteral":
            return value.value;
        case "NumberLiteral":
            return value.value;
        case "BooleanLiteral":
            return value.value;
        case "RegexLiteral":
            throw new Error(`Malformed @where predicate syntax: regex is not supported in prune predicates`);
        case "Identifier":
            return resolveIdentifierOperand(value.name, context, item, bindings);
        case "PropertyAccess":
            return resolvePropertyOperand(value, context, item);
        case "DeriveStateExpr":
        case "DeriveMetaExpr":
        case "DeriveCountExpr":
        case "DeriveEdgeCountExpr":
        case "DeriveExistsExpr":
        case "DerivePathExpr":
        case "DeriveCollectExpr":
        case "DeriveSumExpr":
        case "DeriveMinExpr":
        case "DeriveMaxExpr":
        case "DeriveAvgExpr":
        case "DeriveAbsExpr":
        case "DeriveBinaryExpr":
            throw new Error(`Malformed @where predicate syntax: derive expressions are not supported in prune predicates`);
        default: {
            const _exhaustive = value;
            throw new Error(`Malformed @where predicate syntax: unsupported value ${JSON.stringify(_exhaustive)}`);
        }
    }
}
function resolveIdentifierOperand(name, context, item, bindings) {
    if (context === "node") {
        const node = item;
        if (name === "id")
            return node.id;
        if (name === "type")
            return readObjectField(node.value, "type");
        if (name === "key")
            return readObjectField(node.value, "key");
        if (name === "value")
            return node.value;
    }
    if (context === "edge") {
        const edge = item;
        if (name === "source")
            return edge.subject;
        if (name === "target")
            return edge.object;
        if (name === "rel")
            return edge.relation;
    }
    if (bindings.nodes.has(name)) {
        return bindings.nodes.get(name).id;
    }
    if (bindings.values.has(name)) {
        return deepClone(bindings.values.get(name));
    }
    if (context === "node") {
        if (name === "source" || name === "target" || name === "rel") {
            throw new Error(`Invalid @where field for node prune: "${name}"`);
        }
    }
    if (context === "edge") {
        if (name === "id" ||
            name === "type" ||
            name === "key" ||
            name === "value" ||
            name === "state" ||
            name === "meta") {
            throw new Error(`Invalid @where field for edge prune: "${name}"`);
        }
    }
    throw new Error(`Unresolved symbol "${name}" in @where predicate`);
}
function resolvePropertyOperand(value, context, item) {
    if (context === "edge") {
        throw new Error(`Invalid @where field for edge prune: "${value.object.name}"`);
    }
    const node = item;
    if (value.object.name === "state") {
        return digPruneValue(node.state, value.chain.map((part) => part.name));
    }
    if (value.object.name === "meta") {
        return digPruneValue(node.meta, value.chain.map((part) => part.name));
    }
    throw new Error(`Invalid @where field for node prune: "${value.object.name}"`);
}
function readObjectField(value, field) {
    if (!isRecordValue(value))
        return undefined;
    if (!(field in value))
        return undefined;
    return value[field];
}
function digPruneValue(value, path) {
    let current = value;
    for (const part of path) {
        if (!isRecordValue(current)) {
            return undefined;
        }
        if (!(part in current)) {
            return undefined;
        }
        current = current[part];
    }
    return current;
}
function comparePruneValue(a, b) {
    if (a === undefined || b === undefined) {
        return false;
    }
    return JSON.stringify(a) === JSON.stringify(b);
}
function cloneRuntimeNode(node) {
    return {
        id: node.id,
        semanticId: node.semanticId,
        contract: cloneNodeContract(node.contract),
        value: deepClone(node.value),
        state: deepCloneRecord(node.state),
        meta: deepCloneRecord(node.meta),
    };
}
function deepClone(value) {
    if (value === null)
        return value;
    if (Array.isArray(value)) {
        return value.map((item) => deepClone(item));
    }
    if (typeof value === "object") {
        const out = {};
        for (const [key, v] of Object.entries(value)) {
            out[key] = deepClone(v);
        }
        return out;
    }
    return value;
}
function deepCloneRecord(record) {
    const out = {};
    for (const [key, value] of Object.entries(record)) {
        out[key] = deepClone(value);
    }
    return out;
}
function cloneNodeContract(contract) {
    if (!contract) {
        return undefined;
    }
    return {
        ...(contract.in ? { in: [...contract.in] } : {}),
        ...(contract.out ? { out: [...contract.out] } : {}),
    };
}
function isRecordValue(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
