export function executeWhy(graph, query, workspace) {
    const target = query.target;
    switch (target.type) {
        case "EdgeExpr":
            return explainEdgeExpr(graph, target, workspace);
        case "Identifier":
            return explainIdentifier(graph, target.name, workspace);
        case "MatchExpr":
            return {
                kind: "ReasonResultSet",
                target: "@match(...)",
                items: [],
            };
        case "PathExpr":
            return {
                kind: "ReasonResultSet",
                target: "@path(...)",
                items: [],
            };
        default: {
            const _exhaustive = target;
            throw new Error(`Unsupported @why target: ${JSON.stringify(_exhaustive)}`);
        }
    }
}
function explainEdgeExpr(graph, edgeExpr, workspace) {
    const subject = edgeExpr.left.name;
    const relation = edgeExpr.relation.value;
    const object = edgeExpr.right.name;
    const matchedEdges = graph.edges.filter((edge) => edge.subject === subject &&
        edge.relation === relation &&
        edge.object === object);
    const because = graph.history.filter((entry) => historyRelatesToEdge(entry, subject, relation, object));
    const becauseInteractions = collectBecauseInteractions(because, workspace);
    return {
        kind: "ReasonResultSet",
        target: `${subject} : ${JSON.stringify(relation)} : ${object}`,
        items: [
            {
                kind: "ReasonResult",
                claim: {
                    subject,
                    relation,
                    object,
                },
                matchedEdges,
                because,
                becauseInteractions,
            },
        ],
    };
}
function explainIdentifier(graph, targetId, workspace) {
    const matchedEdges = graph.edges.filter((edge) => edge.subject === targetId || edge.object === targetId);
    const because = graph.history.filter((entry) => historyRelatesToNode(entry, targetId));
    const becauseInteractions = collectBecauseInteractions(because, workspace);
    return {
        kind: "ReasonResultSet",
        target: targetId,
        items: [
            {
                kind: "ReasonResult",
                claim: {
                    subject: targetId,
                    relation: "@node",
                    object: targetId,
                },
                matchedEdges,
                because,
                becauseInteractions,
            },
        ],
    };
}
function historyRelatesToEdge(entry, subject, relation, object) {
    const payload = entry.payload;
    const payloadSubject = typeof payload.subject === "string" ? payload.subject : null;
    const payloadRelation = typeof payload.relation === "string" ? payload.relation : null;
    const payloadObject = typeof payload.object === "string" ? payload.object : null;
    return (payloadSubject === subject &&
        payloadRelation === relation &&
        payloadObject === object);
}
function historyRelatesToNode(entry, nodeId) {
    const payload = entry.payload;
    const payloadNodeId = typeof payload.nodeId === "string" ? payload.nodeId : null;
    const payloadSubject = typeof payload.subject === "string" ? payload.subject : null;
    const payloadObject = typeof payload.object === "string" ? payload.object : null;
    return (payloadNodeId === nodeId ||
        payloadSubject === nodeId ||
        payloadObject === nodeId);
}
function collectBecauseInteractions(history, workspace) {
    if (!workspace || workspace.interactionHistory.length === 0) {
        return [];
    }
    const interactionIds = new Set(history
        .map((entry) => entry.causedBy)
        .filter((value) => typeof value === "string"));
    if (interactionIds.size === 0) {
        return [];
    }
    return workspace.interactionHistory.filter((entry) => interactionIds.has(entry.id));
}
