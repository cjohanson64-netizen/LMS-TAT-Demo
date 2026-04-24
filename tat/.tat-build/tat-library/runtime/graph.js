export function createGraph(root = null, state = {}, meta = {}) {
    return {
        nodes: new Map(),
        edges: [],
        root,
        state: deepCloneRecord(state),
        meta: deepCloneRecord(meta),
        history: [],
    };
}
export function cloneGraph(graph) {
    return {
        nodes: new Map(Array.from(graph.nodes.entries()).map(([id, node]) => [
            id,
            {
                id: node.id,
                semanticId: node.semanticId,
                contract: cloneNodeContract(node.contract),
                value: cloneGraphValue(node.value),
                state: deepCloneRecord(node.state),
                meta: deepCloneRecord(node.meta),
            },
        ])),
        edges: graph.edges.map((edge) => ({
            ...edge,
            meta: deepCloneRecord(edge.meta),
            context: cloneGraphValue(edge.context),
        })),
        root: graph.root,
        state: deepCloneRecord(graph.state),
        meta: deepCloneRecord(graph.meta),
        history: graph.history.map((entry) => ({
            id: entry.id,
            op: entry.op,
            payload: deepCloneRecord(entry.payload),
            causedBy: entry.causedBy,
        })),
    };
}
export function hasNode(graph, id) {
    return graph.nodes.has(id);
}
export function getNode(graph, id) {
    const node = graph.nodes.get(id);
    if (!node) {
        throw new Error(`Graph node "${id}" does not exist`);
    }
    return node;
}
export function addNode(graph, node) {
    if (graph.nodes.has(node.id)) {
        throw new Error(`Graph node "${node.id}" already exists`);
    }
    graph.nodes.set(node.id, {
        id: node.id,
        semanticId: node.semanticId,
        contract: cloneNodeContract(node.contract),
        value: cloneGraphValue(node.value),
        state: deepCloneRecord(node.state),
        meta: deepCloneRecord(node.meta),
    });
    return graph;
}
export function upsertNode(graph, node) {
    graph.nodes.set(node.id, {
        id: node.id,
        semanticId: node.semanticId,
        contract: cloneNodeContract(node.contract),
        value: cloneGraphValue(node.value),
        state: deepCloneRecord(node.state),
        meta: deepCloneRecord(node.meta),
    });
    return graph;
}
export function removeNode(graph, id) {
    if (!graph.nodes.has(id)) {
        return graph;
    }
    graph.nodes.delete(id);
    graph.edges = graph.edges.filter((edge) => edge.subject !== id && edge.object !== id);
    if (graph.root === id) {
        graph.root = null;
    }
    return graph;
}
export function addBranch(graph, subject, relation, object, options) {
    assertNodeExists(graph, subject);
    assertNodeExists(graph, object);
    if (hasEdge(graph, subject, relation, object, "branch", options?.metadata)) {
        return graph;
    }
    graph.edges.push({
        id: makeEdgeId(subject, relation, object, "branch"),
        subject,
        relation,
        object,
        kind: "branch",
        meta: deepCloneRecord(options?.metadata ?? {}),
        context: null,
    });
    pushHistoryEntry(graph, {
        op: options?.historyOp ?? "@graft.branch",
        payload: {
            subject,
            relation,
            object,
            kind: "branch",
            meta: cloneGraphValue(options?.metadata ?? {}),
        },
    }, options);
    return graph;
}
export function removeBranch(graph, subject, relation, object, options) {
    const before = graph.edges.length;
    graph.edges = graph.edges.filter((edge) => !(edge.subject === subject &&
        edge.relation === relation &&
        edge.object === object &&
        edge.kind === "branch" &&
        matchesEdgeMetadata(edge.meta, options?.metadata)));
    if (graph.edges.length !== before) {
        pushHistoryEntry(graph, {
            op: options?.historyOp ?? "@prune.branch",
            payload: {
                subject,
                relation,
                object,
                kind: "branch",
                meta: cloneGraphValue(options?.metadata ?? {}),
            },
        }, options);
    }
    return graph;
}
export function addProgress(graph, subject, relation, object, options) {
    assertNodeExists(graph, subject);
    assertNodeExists(graph, object);
    if (hasEdge(graph, subject, relation, object, "progress")) {
        return graph;
    }
    graph.edges.push({
        id: makeEdgeId(subject, relation, object, "progress"),
        subject,
        relation,
        object,
        kind: "progress",
        meta: {},
        context: null,
    });
    pushHistoryEntry(graph, {
        op: options?.historyOp ?? "@graft.progress",
        payload: {
            subject,
            relation,
            object,
            kind: "progress",
        },
    }, options);
    return graph;
}
export function setNodeState(graph, nodeId, key, value, options) {
    const node = getNode(graph, nodeId);
    node.state[key] = cloneGraphValue(value);
    pushHistoryEntry(graph, {
        op: options?.historyOp ?? "@graft.state",
        payload: {
            nodeId,
            key,
            value: cloneGraphValue(value),
        },
    }, options);
    return graph;
}
export function removeNodeState(graph, nodeId, key, options) {
    const node = getNode(graph, nodeId);
    if (key in node.state) {
        delete node.state[key];
        pushHistoryEntry(graph, {
            op: options?.historyOp ?? "@prune.state",
            payload: {
                nodeId,
                key,
            },
        }, options);
    }
    return graph;
}
export function setNodeMeta(graph, nodeId, key, value, options) {
    const node = getNode(graph, nodeId);
    node.meta[key] = cloneGraphValue(value);
    pushHistoryEntry(graph, {
        op: options?.historyOp ?? "@graft.meta",
        payload: {
            nodeId,
            key,
            value: cloneGraphValue(value),
        },
    }, options);
    return graph;
}
export function removeNodeMeta(graph, nodeId, key, options) {
    const node = getNode(graph, nodeId);
    if (key in node.meta) {
        delete node.meta[key];
        pushHistoryEntry(graph, {
            op: options?.historyOp ?? "@prune.meta",
            payload: {
                nodeId,
                key,
            },
        }, options);
    }
    return graph;
}
export function setEdgeContext(graph, edgeId, context, options) {
    const edge = getEdgeById(graph, edgeId);
    edge.context = cloneGraphValue(context);
    pushHistoryEntry(graph, {
        op: options?.historyOp ?? "@ctx.set",
        payload: {
            edgeId,
            context: cloneGraphValue(context),
        },
    }, options);
    return graph;
}
export function clearEdgeContext(graph, edgeId, options) {
    const edge = getEdgeById(graph, edgeId);
    edge.context = null;
    pushHistoryEntry(graph, {
        op: options?.historyOp ?? "@ctx.clear",
        payload: {
            edgeId,
        },
    }, options);
    return graph;
}
export function getOutgoingEdges(graph, nodeId, kind) {
    return graph.edges.filter((edge) => edge.subject === nodeId && (!kind || edge.kind === kind));
}
export function getIncomingEdges(graph, nodeId, kind) {
    return graph.edges.filter((edge) => edge.object === nodeId && (!kind || edge.kind === kind));
}
export function getEdgesByRelation(graph, relation, kind) {
    return graph.edges.filter((edge) => edge.relation === relation && (!kind || edge.kind === kind));
}
export function hasEdge(graph, subject, relation, object, kind, metadata) {
    return graph.edges.some((edge) => edge.subject === subject &&
        edge.relation === relation &&
        edge.object === object &&
        (!kind || edge.kind === kind) &&
        matchesEdgeMetadata(edge.meta, metadata));
}
export function hasDirectedContractEligibility(fromNode, toNode, hook) {
    return getContractIntersection(fromNode.contract?.out, toNode.contract?.in, hook).length > 0;
}
export function hasHandshakeContractEligibility(leftNode, rightNode, hook) {
    return (hasDirectedContractEligibility(leftNode, rightNode, hook) &&
        hasDirectedContractEligibility(rightNode, leftNode, hook));
}
export function graphToDebugObject(graph) {
    return {
        root: graph.root,
        state: deepCloneRecord(graph.state),
        meta: deepCloneRecord(graph.meta),
        nodes: Array.from(graph.nodes.values()).map((node) => ({
            id: node.id,
            semanticId: node.semanticId,
            contract: cloneNodeContract(node.contract),
            value: cloneGraphValue(node.value),
            state: deepCloneRecord(node.state),
            meta: deepCloneRecord(node.meta),
        })),
        edges: graph.edges.map((edge) => ({
            ...edge,
            meta: deepCloneRecord(edge.meta),
            context: cloneGraphValue(edge.context),
        })),
        history: graph.history.map((entry) => ({
            id: entry.id,
            op: entry.op,
            payload: deepCloneRecord(entry.payload),
            causedBy: entry.causedBy,
        })),
    };
}
/* =========================
   Internal helpers
   ========================= */
function assertNodeExists(graph, id) {
    if (!graph.nodes.has(id)) {
        throw new Error(`Graph node "${id}" does not exist`);
    }
}
function getEdgeById(graph, edgeId) {
    const edge = graph.edges.find((item) => item.id === edgeId);
    if (!edge) {
        throw new Error(`Graph edge "${edgeId}" does not exist`);
    }
    return edge;
}
function matchesEdgeMetadata(edgeMeta, metadata) {
    if (!metadata || Object.keys(metadata).length === 0) {
        return true;
    }
    const actual = edgeMeta ?? {};
    return Object.entries(metadata).every(([key, value]) => JSON.stringify(actual[key] ?? null) === JSON.stringify(value));
}
function getContractIntersection(fromValues, toValues, hook) {
    const fromSet = new Set(fromValues ?? []);
    const toSet = new Set(toValues ?? []);
    const overlap = [...fromSet].filter((value) => toSet.has(value));
    if (!hook) {
        return overlap;
    }
    return overlap.filter((value) => value === hook);
}
function makeEdgeId(subject, relation, object, kind) {
    return `${kind}:${subject}:${relation}:${object}`;
}
function makeHistoryId() {
    return `h_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
function pushHistoryEntry(graph, entry, options) {
    graph.history.push({
        id: makeHistoryId(),
        op: entry.op,
        payload: deepCloneRecord(entry.payload),
        causedBy: options?.causedBy,
    });
}
export function addHistoryEntry(graph, entry, options) {
    const historyEntry = {
        id: makeHistoryId(),
        op: entry.op,
        payload: deepCloneRecord(entry.payload),
        causedBy: options?.causedBy,
    };
    graph.history.push(historyEntry);
    return historyEntry;
}
export function cloneGraphValue(value) {
    if (value === null)
        return value;
    if (Array.isArray(value)) {
        return value.map((item) => cloneGraphValue(item));
    }
    if (typeof value === "object") {
        const out = {};
        for (const [key, v] of Object.entries(value)) {
            out[key] = cloneGraphValue(v);
        }
        return out;
    }
    return value;
}
function deepCloneRecord(record) {
    const out = {};
    for (const [key, value] of Object.entries(record)) {
        out[key] = cloneGraphValue(value);
    }
    return out;
}
