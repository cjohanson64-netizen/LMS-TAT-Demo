import { cloneGraph, cloneGraphValue, removeNodeMeta, removeNodeState, setNodeMeta, setNodeState, } from "./graph.js";
export function graphInteractionFromAst(node, fallbackId = "__interaction__") {
    return {
        id: node.name?.name ?? fallbackId,
        subjectGraphId: node.subject.graphId.name,
        relation: node.relation.value,
        objectGraphId: node.object.graphId.name,
        effect: {
            target: node.effect.target.type === "RootTarget" ? "root" : node.effect.target.name,
            ops: node.effect.ops.map(materializeEffectOp),
        },
    };
}
export function executeGraphInteraction(interaction, workspace) {
    const originalGraph = workspace.graphs.get(interaction.objectGraphId);
    if (!originalGraph) {
        throw new Error(`Missing graph "${interaction.objectGraphId}"`);
    }
    const interactionEventId = makeInteractionEventId();
    const startedAt = Date.now();
    const graph = cloneGraph(originalGraph);
    const targetNodeId = resolveTargetNodeId(interaction, graph);
    const targetNode = graph.nodes.get(targetNodeId);
    if (!targetNode) {
        throw new Error(`Missing target node "${targetNodeId}" in graph "${interaction.objectGraphId}"`);
    }
    const baseline = {
        state: Object.fromEntries(Object.entries(targetNode.state).map(([key, value]) => [key, cloneGraphValue(value)])),
        meta: Object.fromEntries(Object.entries(targetNode.meta).map(([key, value]) => [key, cloneGraphValue(value)])),
    };
    const log = [];
    const effectEntryIds = [];
    for (const op of interaction.effect.ops) {
        const historyStart = graph.history.length;
        switch (op.op) {
            case "@graft.state":
                setNodeState(graph, targetNodeId, op.key, op.value, {
                    causedBy: interactionEventId,
                });
                break;
            case "@graft.meta":
                setNodeMeta(graph, targetNodeId, op.key, op.value, {
                    causedBy: interactionEventId,
                });
                break;
            case "@prune.state":
                removeNodeState(graph, targetNodeId, op.key, {
                    causedBy: interactionEventId,
                });
                break;
            case "@prune.meta":
                removeNodeMeta(graph, targetNodeId, op.key, {
                    causedBy: interactionEventId,
                });
                break;
            case "@derive.state": {
                const value = evaluateDerivedValue(op.expression, "state", op.key, graph, targetNodeId, baseline);
                setNodeState(graph, targetNodeId, op.key, value, {
                    causedBy: interactionEventId,
                    historyOp: "@derive.state",
                });
                break;
            }
            case "@derive.meta": {
                const value = evaluateDerivedValue(op.expression, "meta", op.key, graph, targetNodeId, baseline);
                setNodeMeta(graph, targetNodeId, op.key, value, {
                    causedBy: interactionEventId,
                    historyOp: "@derive.meta",
                });
                break;
            }
        }
        effectEntryIds.push(...graph.history
            .slice(historyStart)
            .map((entry) => entry.id));
        log.push({
            subjectGraphId: interaction.subjectGraphId,
            relation: interaction.relation,
            objectGraphId: interaction.objectGraphId,
            targetNodeId,
            op: op.op,
            payload: effectLogPayload(op),
        });
    }
    const graphs = new Map(workspace.graphs);
    graphs.set(interaction.objectGraphId, graph);
    const interactionEvent = {
        id: interactionEventId,
        op: "@interaction",
        relation: interaction.relation,
        definitionId: interaction.id,
        subjectGraphId: interaction.subjectGraphId,
        objectGraphId: interaction.objectGraphId,
        targetNodeId,
        effectEntryIds,
        summary: buildInteractionSummary(interaction),
        startedAt,
    };
    const interactionHistory = [
        ...workspace.interactionHistory,
        interactionEvent,
    ];
    return {
        workspace: { graphs, interactionHistory },
        changedGraphIds: [interaction.objectGraphId],
        log,
    };
}
function materializeEffectOp(node) {
    switch (node.type) {
        case "EffectGraftStateOp":
            return {
                op: "@graft.state",
                key: node.key.value,
                value: materializeLiteralValue(node.value),
            };
        case "EffectGraftMetaOp":
            return {
                op: "@graft.meta",
                key: node.key.value,
                value: materializeLiteralValue(node.value),
            };
        case "EffectPruneStateOp":
            return {
                op: "@prune.state",
                key: node.key.value,
            };
        case "EffectPruneMetaOp":
            return {
                op: "@prune.meta",
                key: node.key.value,
            };
        case "EffectDeriveStateOp":
            return {
                op: "@derive.state",
                key: node.key.value,
                expression: materializeDeriveExpr(node.expression),
            };
        case "EffectDeriveMetaOp":
            return {
                op: "@derive.meta",
                key: node.key.value,
                expression: materializeDeriveExpr(node.expression),
            };
    }
}
function materializeLiteralValue(node) {
    switch (node.type) {
        case "StringLiteral":
        case "NumberLiteral":
        case "BooleanLiteral":
            return node.value;
        case "ObjectLiteral": {
            const out = {};
            for (const property of node.properties) {
                out[property.key] = materializeLiteralValue(property.value);
            }
            return out;
        }
        case "ArrayLiteral":
            return node.elements.map((element) => materializeLiteralValue(element));
        default:
            throw new Error(`Unsupported value in @effect op: ${node.type}`);
    }
}
function materializeDeriveExpr(node) {
    switch (node.type) {
        case "CurrentValue":
            return { kind: "current" };
        case "PreviousValue":
            return { kind: "previous" };
        case "NumberLiteral":
        case "StringLiteral":
            return { kind: "literal", value: node.value };
        case "DeriveStateExpr":
        case "DeriveMetaExpr":
        case "DeriveCountExpr":
        case "DerivePathExpr":
            throw new Error(`${node.name} is not supported inside @effect derive expressions`);
        case "DeriveBinaryExpr":
            return {
                kind: "binary",
                operator: node.operator,
                left: materializeDeriveExpr(node.left),
                right: materializeDeriveExpr(node.right),
            };
    }
    throw new Error(`Unsupported derive expression "${node.type}"`);
}
function resolveTargetNodeId(interaction, graph) {
    if (interaction.effect.target === "root") {
        if (!graph.root) {
            throw new Error(`Missing target node "root" in graph "${interaction.objectGraphId}"`);
        }
        if (!graph.nodes.has(graph.root)) {
            throw new Error(`Missing target node "${graph.root}" in graph "${interaction.objectGraphId}"`);
        }
        return graph.root;
    }
    if (!graph.nodes.has(interaction.effect.target)) {
        throw new Error(`Missing target node "${interaction.effect.target}" in graph "${interaction.objectGraphId}"`);
    }
    return interaction.effect.target;
}
function evaluateDerivedValue(expression, layer, key, graph, nodeId, baseline) {
    const result = evaluateDeriveExpression(expression, layer, key, graph, nodeId, baseline);
    if (result.value === undefined) {
        throw new Error(`Derived value for ${layer}.${key} resolved to missing`);
    }
    return result.value;
}
function evaluateDeriveExpression(expression, layer, key, graph, nodeId, baseline) {
    switch (expression.kind) {
        case "current":
            return {
                value: readNodeLayerValue(graph, nodeId, layer, key),
                containsCurrent: true,
            };
        case "previous":
            return {
                value: readBaselineValue(baseline, layer, key),
                containsCurrent: false,
            };
        case "literal":
            return {
                value: cloneGraphValue(expression.value),
                containsCurrent: false,
            };
        case "binary": {
            const left = evaluateDeriveExpression(expression.left, layer, key, graph, nodeId, baseline);
            const right = evaluateDeriveExpression(expression.right, layer, key, graph, nodeId, baseline);
            switch (expression.operator) {
                case "+":
                    if (typeof left.value === "number" && typeof right.value === "number") {
                        return {
                            value: left.value + right.value,
                            containsCurrent: left.containsCurrent || right.containsCurrent,
                        };
                    }
                    if ((left.containsCurrent && left.value === undefined && typeof right.value === "number") ||
                        (right.containsCurrent && right.value === undefined && typeof left.value === "number")) {
                        throw new Error(`Missing current for numeric derive on ${layer}.${key}`);
                    }
                    return {
                        value: appendGraphValues(left.value, right.value),
                        containsCurrent: left.containsCurrent || right.containsCurrent,
                    };
                case "-":
                case "*":
                case "/":
                case "%":
                    return {
                        value: evaluateNumericBinary(expression.operator, left, right, layer, key),
                        containsCurrent: left.containsCurrent || right.containsCurrent,
                    };
            }
        }
    }
    return exhaustiveNever(expression);
}
function readNodeLayerValue(graph, nodeId, layer, key) {
    const node = graph.nodes.get(nodeId);
    if (!node) {
        throw new Error(`Missing target node "${nodeId}"`);
    }
    return layer === "state" ? node.state[key] : node.meta[key];
}
function readBaselineValue(baseline, layer, key) {
    const record = layer === "state" ? baseline.state : baseline.meta;
    return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}
function evaluateNumericBinary(operator, left, right, layer, key) {
    if (left.value === undefined || right.value === undefined) {
        if (left.containsCurrent || right.containsCurrent) {
            throw new Error(`Missing current for numeric derive on ${layer}.${key}`);
        }
        throw new Error(`Incompatible numeric derive on ${layer}.${key}`);
    }
    if (typeof left.value !== "number" || typeof right.value !== "number") {
        throw new Error(`Incompatible numeric derive on ${layer}.${key}`);
    }
    switch (operator) {
        case "-":
            return left.value - right.value;
        case "*":
            return left.value * right.value;
        case "/":
            return left.value / right.value;
        case "%":
            return left.value % right.value;
    }
}
function appendGraphValues(left, right) {
    if (right === undefined) {
        throw new Error(`Cannot append missing value in @derive`);
    }
    const rightClone = cloneGraphValue(right);
    if (left === undefined) {
        return [rightClone];
    }
    if (Array.isArray(left)) {
        return [...left.map((item) => cloneGraphValue(item)), rightClone];
    }
    return [cloneGraphValue(left), rightClone];
}
function effectLogPayload(op) {
    switch (op.op) {
        case "@graft.state":
        case "@graft.meta":
            return {
                key: op.key,
                value: cloneGraphValue(op.value),
            };
        case "@prune.state":
        case "@prune.meta":
            return {
                key: op.key,
            };
        case "@derive.state":
        case "@derive.meta":
            return {
                key: op.key,
                expression: serializeDeriveExpression(op.expression),
            };
    }
}
function serializeDeriveExpression(expression) {
    switch (expression.kind) {
        case "current":
        case "previous":
            return expression.kind;
        case "literal":
            return cloneGraphValue(expression.value);
        case "binary":
            return {
                operator: expression.operator,
                left: serializeDeriveExpression(expression.left),
                right: serializeDeriveExpression(expression.right),
            };
    }
}
function buildInteractionSummary(interaction) {
    return {
        effects: interaction.effect.ops.map((op) => ({
            op: op.op,
            key: op.key,
        })),
    };
}
function makeInteractionEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function exhaustiveNever(value) {
    throw new Error(`Unhandled derive expression: ${JSON.stringify(value)}`);
}
