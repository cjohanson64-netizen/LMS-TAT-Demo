import { printAST } from "../ast/printAST.js";
import { tokenize } from "../lexer/tokenize.js";
import { parse, ParseError } from "../parser/parse.js";
import { applyRuntimeAction, applyRuntimeActionToGraph, executeProgram, reprojectRuntimeState, setRuntimeFocus, } from "./executeProgram.js";
import { addHistoryEntry, addBranch, addNode, addProgress, cloneGraph, cloneGraphValue, graphToDebugObject, hasDirectedContractEligibility, hasHandshakeContractEligibility, removeNode, } from "./graph.js";
import { validateProgram } from "./validateProgram.js";
import { executeTatModule as executeTatModuleInternal } from "./executeModule.js";
import { compareGenealogyRelationship, queryGenealogyCommonAncestors, } from "./relationshipComparison.js";
import { executeGraphInteraction, graphInteractionFromAst, } from "./executeGraphInteraction.js";
export function prepareTatMutationTransaction(session, request) {
    const graphBinding = request.actions[0]?.payload.graphBinding;
    if (!graphBinding) {
        return request;
    }
    const graph = session.state.graphs.get(graphBinding);
    if (!graph) {
        return request;
    }
    return {
        ...request,
        actions: request.actions.map((action) => {
            if (action.type !== "action" || action.payload.target) {
                return action;
            }
            const actionName = action.payload.action ?? action.payload.hook;
            if (!actionName) {
                return action;
            }
            const runtimeAction = session.state.actions.get(actionName);
            if (!runtimeAction) {
                return action;
            }
            const generatedPrefix = findGeneratedNodeIdPrefix(runtimeAction.pipeline);
            if (!generatedPrefix) {
                return action;
            }
            return {
                ...action,
                payload: {
                    ...action.payload,
                    target: generateRuntimeNodeId(graph, generatedPrefix),
                },
            };
        }),
    };
}
export function tokenizeTat(source) {
    return tokenize(source);
}
export function parseTatToAst(source) {
    const tokens = tokenize(source);
    return parse(tokens);
}
export function printTatAst(source) {
    const tokens = tokenize(source);
    const ast = parse(tokens);
    return printAST(ast);
}
export function parseTat(source) {
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const printedAst = printAST(ast);
    return {
        source,
        tokens,
        ast,
        printedAst,
    };
}
export function executeTat(source) {
    const session = createTatRuntimeSession(source);
    return inspectTatRuntimeSession(session);
}
export function createTatRuntimeSession(source) {
    const parsed = parseTat(source);
    const validation = validateProgram(parsed.ast);
    const errors = validation.filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
        const message = errors
            .map((issue) => issue.span?.line && issue.span?.column
            ? `${issue.message} at ${issue.span.line}:${issue.span.column}`
            : issue.message)
            .join("\n");
        throw new Error(`Validation failed:\n${message}`);
    }
    const execution = executeProgram(parsed.ast);
    return {
        ...parsed,
        validation,
        state: execution.state,
    };
}
export function inspectTatRuntimeSession(session, options) {
    const projections = reprojectRuntimeState(session.ast, session.state, options);
    const execution = { state: session.state };
    const graphs = {};
    for (const [name, graph] of session.state.graphs.entries()) {
        graphs[name] = graphToDebugObject(graph);
    }
    const projectionDebug = {};
    for (const [name, projection] of projections.entries()) {
        projectionDebug[name] = structuredCloneSafe(projection);
    }
    const graphInteractions = {};
    for (const [name, interaction] of session.state.graphInteractions.entries()) {
        graphInteractions[name] = structuredCloneSafe(interaction);
    }
    const interactionHistory = structuredCloneSafe(session.state.interactionHistory);
    const values = {};
    for (const [name, value] of session.state.bindings.values.entries()) {
        values[name] = structuredCloneSafe(value);
    }
    const nodes = {};
    for (const [name, node] of session.state.bindings.nodes.entries()) {
        nodes[name] = {
            id: node.id,
            semanticId: node.semanticId,
            contract: node.contract
                ? {
                    ...(node.contract.in ? { in: [...node.contract.in] } : {}),
                    ...(node.contract.out ? { out: [...node.contract.out] } : {}),
                }
                : undefined,
            value: structuredCloneSafe(node.value),
            state: structuredCloneSafe(node.state),
            meta: structuredCloneSafe(node.meta),
        };
    }
    return {
        ...session,
        execution,
        debug: {
            graphs,
            projections: projectionDebug,
            graphInteractions,
            interactionHistory,
            systemRelations: session.state.systemRelations,
            queryResults: session.state.queryResults,
            bindings: {
                values,
                nodes,
            },
        },
    };
}
export function compareTatRelationship(session, request) {
    const graph = session.state.graphs.get(request.graphBinding);
    if (!graph) {
        throw new Error(`Graph "${request.graphBinding}" is not available in runtime session`);
    }
    return compareGenealogyRelationship(graph, request);
}
export function queryTatCommonAncestors(session, request) {
    const graph = session.state.graphs.get(request.graphBinding);
    if (!graph) {
        throw new Error(`Graph "${request.graphBinding}" is not available in runtime session`);
    }
    return queryGenealogyCommonAncestors(graph, request);
}
export function applyTatAction(session, request, options) {
    return {
        ...session,
        state: applyRuntimeAction(session.ast, session.state, request, options),
    };
}
export function setTatFocus(session, request) {
    return {
        ...session,
        state: setRuntimeFocus(session.ast, session.state, request),
    };
}
export function addTatNode(session, request, options) {
    return {
        ...session,
        state: addRuntimeNode(session.ast, session.state, request, options),
    };
}
export function addTatEdge(session, request, options) {
    return {
        ...session,
        state: addRuntimeEdge(session.ast, session.state, request, options),
    };
}
export function updateTatNodeValue(session, request, options) {
    return {
        ...session,
        state: updateRuntimeNodeValue(session.ast, session.state, request, options),
    };
}
export function deleteTatNode(session, request, options) {
    return {
        ...session,
        state: deleteRuntimeNode(session.ast, session.state, request, options),
    };
}
export function applyTatMutationTransaction(session, request, options) {
    const preparedRequest = prepareTatMutationTransaction(session, request);
    return {
        ...session,
        state: applyRuntimeMutationTransactionState(session.ast, session.state, preparedRequest, options),
    };
}
export function executeTatModule(entryPath) {
    return executeTatModuleInternal(entryPath);
}
function structuredCloneSafe(value) {
    if (typeof globalThis.structuredClone === "function") {
        return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}
function addRuntimeNode(program, state, request, options) {
    return applyRuntimeMutationTransactionState(program, state, {
        label: options?.history?.label ?? "Add Node",
        actions: [{ type: "addNode", payload: request }],
    }, options);
}
function addRuntimeEdge(program, state, request, options) {
    return applyRuntimeMutationTransactionState(program, state, {
        label: options?.history?.label ?? "Add Edge",
        actions: [{ type: "addEdge", payload: request }],
    }, options);
}
function updateRuntimeNodeValue(program, state, request, options) {
    return applyRuntimeMutationTransactionState(program, state, {
        label: options?.history?.label ?? "Update Node Value",
        actions: [{ type: "updateNodeValue", payload: request }],
    }, options);
}
function deleteRuntimeNode(program, state, request, options) {
    return applyRuntimeMutationTransactionState(program, state, {
        label: options?.history?.label ?? "Delete Node",
        actions: [{ type: "deleteNode", payload: request }],
    }, options);
}
function applyRuntimeMutationTransactionState(program, state, request, options) {
    request = prepareRuntimeMutationTransactionState(state, request);
    if (request.actions.length === 0) {
        return state;
    }
    const graphBinding = request.actions[0]?.payload.graphBinding;
    if (!graphBinding) {
        throw new Error("Runtime transaction is missing a graph binding");
    }
    if (request.actions.some((action) => action.payload.graphBinding !== graphBinding)) {
        throw new Error("Runtime transaction actions must target the same graph");
    }
    const originalGraph = state.graphs.get(graphBinding);
    if (!originalGraph) {
        throw new Error(`Graph "${graphBinding}" is not available in runtime state`);
    }
    const graph = cloneGraph(originalGraph);
    const transactionEntry = addHistoryEntry(graph, {
        op: "@runtime.transaction",
        payload: {
            label: request.label,
            graphBinding,
            actionCount: request.actions.length,
        },
    });
    for (const action of request.actions) {
        applyRuntimeMutationAction(graph, state, action, transactionEntry.id);
    }
    const graphs = new Map(state.graphs);
    graphs.set(graphBinding, graph);
    const graphFocus = getUpdatedGraphFocus(state.graphFocus, graphBinding, graph);
    const nextState = {
        ...state,
        graphs,
        graphFocus,
    };
    return {
        ...nextState,
        projections: reprojectRuntimeState(program, nextState, options),
    };
}
function prepareRuntimeMutationTransactionState(state, request) {
    const graphBinding = request.actions[0]?.payload.graphBinding;
    if (!graphBinding) {
        return request;
    }
    const graph = state.graphs.get(graphBinding);
    if (!graph) {
        return request;
    }
    return {
        ...request,
        actions: request.actions.map((action) => {
            if (action.type !== "action" || action.payload.target) {
                return action;
            }
            const actionName = action.payload.action ?? action.payload.hook;
            if (!actionName) {
                return action;
            }
            const runtimeAction = state.actions.get(actionName);
            if (!runtimeAction) {
                return action;
            }
            const generatedPrefix = findGeneratedNodeIdPrefix(runtimeAction.pipeline);
            if (!generatedPrefix) {
                return action;
            }
            return {
                ...action,
                payload: {
                    ...action.payload,
                    target: generateRuntimeNodeId(graph, generatedPrefix),
                },
            };
        }),
    };
}
function findGeneratedNodeIdPrefix(steps) {
    for (const step of steps) {
        if (step.type === "RuntimeAddNodeExpr" && step.node.type === "RuntimeGenerateNodeIdExpr") {
            return step.node.prefix?.value ?? "node";
        }
        if (step.type === "IfExpr") {
            const thenPrefix = findGeneratedNodeIdPrefix(step.then ?? []);
            if (thenPrefix)
                return thenPrefix;
            const elsePrefix = findGeneratedNodeIdPrefix(step.else ?? []);
            if (elsePrefix)
                return elsePrefix;
        }
        if (step.type === "LoopExpr") {
            const loopPrefix = findGeneratedNodeIdPrefix(step.pipeline ?? []);
            if (loopPrefix)
                return loopPrefix;
        }
    }
    return null;
}
function generateRuntimeNodeId(graph, prefix) {
    const normalizedPrefix = prefix.trim() || "node";
    const counter = graph.history.length + 1;
    return `${normalizedPrefix}Node_${counter}`;
}
function applyRuntimeMutationAction(graph, state, action, causedBy) {
    switch (action.type) {
        case "addNode": {
            const request = action.payload;
            const extractedValue = extractRuntimeNodeValue(request.value);
            addNode(graph, {
                id: request.nodeId,
                semanticId: extractedValue.semanticId,
                contract: cloneNodeContract(extractedValue.contract),
                value: extractedValue.value,
                state: request.state ?? {},
                meta: request.meta ?? {},
            });
            addHistoryEntry(graph, {
                op: "@runtime.addNode",
                payload: {
                    nodeId: request.nodeId,
                    semanticId: extractedValue.semanticId ?? null,
                    contract: extractedValue.contract
                        ? contractToGraphValue(extractedValue.contract)
                        : null,
                    value: cloneGraphValue(extractedValue.value),
                    state: cloneGraphValue(request.state ?? {}),
                    meta: cloneGraphValue(request.meta ?? {}),
                },
            }, { causedBy });
            return;
        }
        case "addEdge": {
            const request = action.payload;
            const historyOptions = {
                causedBy,
                historyOp: "@runtime.addEdge",
            };
            if (request.kind === "progress") {
                addProgress(graph, request.subject, request.relation, request.object, historyOptions);
            }
            else {
                addBranch(graph, request.subject, request.relation, request.object, {
                    ...historyOptions,
                    metadata: request.meta,
                });
            }
            return;
        }
        case "updateNodeValue": {
            const request = action.payload;
            const node = graph.nodes.get(request.nodeId);
            if (!node) {
                throw new Error(`Graph node "${request.nodeId}" does not exist in graph "${request.graphBinding}"`);
            }
            if (!isGraphRecord(node.value)) {
                throw new Error(`Graph node "${request.nodeId}" does not have an object value to update`);
            }
            const beforeValue = cloneGraphValue(node.value);
            node.value = {
                ...node.value,
                ...request.patch,
            };
            addHistoryEntry(graph, {
                op: "@runtime.updateNodeValue",
                payload: {
                    nodeId: request.nodeId,
                    patch: cloneGraphValue(request.patch),
                    beforeValue,
                    afterValue: cloneGraphValue(node.value),
                },
            }, { causedBy });
            return;
        }
        case "deleteNode": {
            const request = action.payload;
            const node = graph.nodes.get(request.nodeId);
            if (!node) {
                return;
            }
            const removedEdges = graph.edges
                .filter((edge) => edge.subject === request.nodeId || edge.object === request.nodeId)
                .map((edge) => ({
                subject: edge.subject,
                relation: edge.relation,
                object: edge.object,
                kind: edge.kind,
                meta: cloneGraphValue(edge.meta),
            }));
            addHistoryEntry(graph, {
                op: "@runtime.deleteNode",
                payload: {
                    nodeId: request.nodeId,
                    value: cloneGraphValue(node.value),
                    state: cloneGraphValue(node.state),
                    meta: cloneGraphValue(node.meta),
                    removedEdges: cloneGraphValue(removedEdges),
                },
            }, { causedBy });
            removeNode(graph, request.nodeId);
            return;
        }
        case "action": {
            const request = action.payload;
            applyRuntimeActionToGraph(graph, state, request, { causedBy });
            return;
        }
        default: {
            const _exhaustive = action;
            throw new Error(`Unsupported runtime mutation action: ${JSON.stringify(_exhaustive)}`);
        }
    }
}
function getUpdatedGraphFocus(currentFocus, graphBinding, graph) {
    const graphFocus = new Map(currentFocus);
    const focusedNodeId = graphFocus.get(graphBinding);
    if (focusedNodeId && graph.nodes.has(focusedNodeId)) {
        return graphFocus;
    }
    const fallbackFocus = graph.root ?? graph.nodes.keys().next().value ?? null;
    if (fallbackFocus) {
        graphFocus.set(graphBinding, fallbackFocus);
    }
    else {
        graphFocus.delete(graphBinding);
    }
    return graphFocus;
}
function isGraphRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function extractRuntimeNodeValue(value) {
    if (!isGraphRecord(value)) {
        return { value };
    }
    const nextValue = cloneGraphValue(value);
    const semanticIdValue = nextValue.semanticId;
    const contractValue = nextValue.contract;
    if (semanticIdValue !== undefined && typeof semanticIdValue !== "string") {
        throw new Error("semanticId must be a string when present on a runtime node value");
    }
    if (contractValue !== undefined && !isNodeContractValue(contractValue)) {
        throw new Error("contract must be an object with optional string-array in/out fields");
    }
    delete nextValue.semanticId;
    delete nextValue.contract;
    return {
        ...(typeof semanticIdValue === "string" ? { semanticId: semanticIdValue } : {}),
        ...(contractValue ? { contract: normalizeNodeContract(contractValue) } : {}),
        value: nextValue,
    };
}
function isNodeContractValue(value) {
    if (!isGraphRecord(value)) {
        return false;
    }
    if (value.in !== undefined &&
        (!Array.isArray(value.in) || value.in.some((item) => typeof item !== "string"))) {
        return false;
    }
    if (value.out !== undefined &&
        (!Array.isArray(value.out) || value.out.some((item) => typeof item !== "string"))) {
        return false;
    }
    return true;
}
function normalizeNodeContract(value) {
    return {
        ...(Array.isArray(value.in) ? { in: [...value.in] } : {}),
        ...(Array.isArray(value.out) ? { out: [...value.out] } : {}),
    };
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
function contractToGraphValue(contract) {
    return {
        ...(contract.in ? { in: [...contract.in] } : {}),
        ...(contract.out ? { out: [...contract.out] } : {}),
    };
}
export { ParseError, tokenize, parse, printAST, executeProgram, executeGraphInteraction, graphInteractionFromAst, hasDirectedContractEligibility, hasHandshakeContractEligibility, };
