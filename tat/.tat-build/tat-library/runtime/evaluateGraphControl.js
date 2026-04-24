import { cloneGraphValue, getNode, hasEdge } from "./graph.js";
import { evaluateValueExpr } from "./evaluateNodeCapture.js";
export const LOOP_SAFETY_CAP = 1000;
export const REACTIVE_TRIGGER_SAFETY_CAP = 1000;
export function evaluateGraphQuery(graph, query, options) {
    const scope = options?.scope;
    const bindings = options?.bindings;
    const actions = options?.actions;
    const usesEdgeMode = query.subject !== null || query.relation !== null || query.object !== null;
    const usesStateMode = query.state !== null;
    const usesMetaMode = query.meta !== null;
    const modeCount = Number(usesEdgeMode) + Number(usesStateMode) + Number(usesMetaMode);
    if (modeCount !== 1) {
        throw new Error("@query must use exactly one mode: edge existence, state query, or meta query");
    }
    if (usesEdgeMode) {
        if (!query.subject || !query.relation || !query.object) {
            throw new Error("@query edge existence requires subject, relation, and object");
        }
        if (query.equals) {
            throw new Error('@query edge existence does not support an "equals" field');
        }
        const subject = resolveNodeRef(query.subject.name, scope, bindings);
        const object = resolveNodeRef(query.object.name, scope, bindings);
        return hasEdge(graph, subject, query.relation.value, object);
    }
    if (!query.node) {
        throw new Error("@query state/meta mode requires a node field");
    }
    const nodeId = resolveNodeRef(query.node.name, scope, bindings);
    const node = getNode(graph, nodeId);
    if (query.state) {
        if (query.meta) {
            throw new Error('@query cannot combine "state" and "meta" fields');
        }
        const hasKey = Object.prototype.hasOwnProperty.call(node.state, query.state.value);
        if (!hasKey) {
            return false;
        }
        if (!query.equals) {
            return true;
        }
        const expected = evaluateGraphValue(query.equals, bindings, actions);
        return graphValueEquals(node.state[query.state.value], expected);
    }
    if (query.meta) {
        const hasKey = Object.prototype.hasOwnProperty.call(node.meta, query.meta.value);
        if (!hasKey) {
            return false;
        }
        if (!query.equals) {
            return true;
        }
        const expected = evaluateGraphValue(query.equals, bindings, actions);
        return graphValueEquals(node.meta[query.meta.value], expected);
    }
    throw new Error('@query state/meta mode requires either a "state" or "meta" field');
}
export function evaluateGraphControlExpr(graph, expr, options) {
    if (expr.type === "GraphQueryExpr") {
        return evaluateGraphQuery(graph, expr, options);
    }
    switch (expr.type) {
        case "BinaryBooleanExpr":
            return expr.operator === "&&"
                ? evaluateGraphControlExpr(graph, expr.left, options) &&
                    evaluateGraphControlExpr(graph, expr.right, options)
                : evaluateGraphControlExpr(graph, expr.left, options) ||
                    evaluateGraphControlExpr(graph, expr.right, options);
        case "UnaryBooleanExpr":
            return !evaluateGraphControlExpr(graph, expr.argument, options);
        case "GroupedBooleanExpr":
            return evaluateGraphControlExpr(graph, expr.expression, options);
        case "ComparisonExpr": {
            const left = evaluateGraphControlValue(graph, expr.left, options);
            const right = evaluateGraphControlValue(graph, expr.right, options);
            return applyComparisonOperator(expr.operator, left, right);
        }
        case "Identifier":
        case "PropertyAccess":
        case "StringLiteral":
        case "NumberLiteral":
        case "BooleanLiteral":
        case "RegexLiteral":
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
            return truthy(evaluateGraphControlValue(graph, expr, options));
        default:
            return exhaustiveNever(expr);
    }
}
export function evaluateLoopCount(graph, countExpr, options) {
    const value = countExpr.type === "NumberLiteral"
        ? countExpr.value
        : countExpr.type === "DeriveStateExpr"
            ? evaluateDeriveState(graph, countExpr, options)
            : countExpr.type === "DeriveMetaExpr"
                ? evaluateDeriveMeta(graph, countExpr, options)
                : countExpr.type === "DeriveEdgeCountExpr"
                    ? evaluateDeriveEdgeCount(graph, countExpr, options)
                    : countExpr.type === "DeriveSumExpr"
                        ? evaluateDeriveSum(graph, countExpr, options)
                        : countExpr.type === "DeriveMinExpr"
                            ? evaluateDeriveMin(graph, countExpr, options)
                            : countExpr.type === "DeriveMaxExpr"
                                ? evaluateDeriveMax(graph, countExpr, options)
                                : countExpr.type === "DeriveAvgExpr"
                                    ? evaluateDeriveAvg(graph, countExpr, options)
                                    : countExpr.type === "DeriveAbsExpr"
                                        ? evaluateDeriveAbs(graph, countExpr, options)
                                        : evaluateDeriveCount(graph, countExpr, options);
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("@loop count must resolve to a number");
    }
    if (!Number.isInteger(value)) {
        throw new Error("@loop count must resolve to a non-negative integer");
    }
    if (value < 0) {
        throw new Error("@loop count cannot be negative");
    }
    return value;
}
export function evaluateDeriveState(graph, expr, options) {
    if (!expr.node) {
        throw new Error("@derive.state requires a node field");
    }
    if (!expr.key) {
        throw new Error("@derive.state requires a key field");
    }
    const nodeId = resolveNodeRef(expr.node.name, options?.scope, options?.bindings);
    const node = getNode(graph, nodeId);
    if (!Object.prototype.hasOwnProperty.call(node.state, expr.key.value)) {
        throw new Error(`@derive.state could not find state key "${expr.key.value}" on node "${nodeId}"`);
    }
    return node.state[expr.key.value];
}
export function evaluateDeriveMeta(graph, expr, options) {
    if (!expr.node) {
        throw new Error("@derive.meta requires a node field");
    }
    if (!expr.key) {
        throw new Error("@derive.meta requires a key field");
    }
    const nodeId = resolveNodeRef(expr.node.name, options?.scope, options?.bindings);
    const node = getNode(graph, nodeId);
    if (!Object.prototype.hasOwnProperty.call(node.meta, expr.key.value)) {
        throw new Error(`@derive.meta could not find meta key "${expr.key.value}" on node "${nodeId}"`);
    }
    return node.meta[expr.key.value];
}
export function evaluateDeriveCount(graph, expr, options) {
    if (expr.from) {
        return evaluateDeriveAggregateSource(graph, expr.from, options).length;
    }
    if (!expr.nodes) {
        throw new Error("@derive.count requires a nodes field or from field");
    }
    return evaluateDerivePath(graph, expr.nodes, options).length;
}
export function evaluateDeriveEdgeCount(graph, expr, options) {
    if (!expr.node) {
        throw new Error("@derive.edgeCount requires a node field");
    }
    if (!expr.relation) {
        throw new Error("@derive.edgeCount requires a relation field");
    }
    if (!expr.direction) {
        throw new Error("@derive.edgeCount requires a direction field");
    }
    const nodeId = resolveNodeRef(expr.node.name, options?.scope, options?.bindings);
    const relation = expr.relation.value;
    const matchingEdges = graph.edges.filter((edge) => {
        if (edge.relation !== relation) {
            return false;
        }
        if (expr.direction?.value === "incoming" && edge.object !== nodeId) {
            return false;
        }
        if (expr.direction?.value === "outgoing" && edge.subject !== nodeId) {
            return false;
        }
        if (!expr.where) {
            return true;
        }
        return evaluateEdgeWhereExpr(graph, edge, expr.where, options);
    });
    switch (expr.direction.value) {
        case "incoming":
        case "outgoing":
            return matchingEdges.length;
        default:
            throw new Error('@derive.edgeCount direction must be "incoming" or "outgoing"');
    }
}
export function evaluateDeriveExists(graph, expr, options) {
    if (!expr.path) {
        throw new Error("@derive.exists requires a path field");
    }
    if (expr.path.type === "Identifier") {
        return resolveAggregateCollection(expr.path.name, options).length > 0;
    }
    return evaluateDerivePath(graph, expr.path, options).length > 0;
}
export function evaluateDeriveCollect(graph, expr, options) {
    if (!expr.path || !expr.layer || !expr.key) {
        throw new Error("@derive.collect requires path, layer, and key");
    }
    const layer = expr.layer.value;
    if (layer !== "value" && layer !== "state" && layer !== "meta") {
        throw new Error('@derive.collect layer must be "value", "state", or "meta"');
    }
    const nodeIds = evaluateDerivePath(graph, expr.path, options);
    const results = [];
    for (const nodeId of nodeIds) {
        const node = graph.nodes.get(nodeId);
        if (!node) {
            continue;
        }
        const source = layer === "value" ? node.value : layer === "state" ? node.state : node.meta;
        if (!isRecord(source) || !Object.prototype.hasOwnProperty.call(source, expr.key.value)) {
            continue;
        }
        results.push(source[expr.key.value]);
    }
    return results;
}
export function evaluateDeriveSum(graph, expr, options) {
    if (expr.from) {
        const values = collectAggregateFieldValues(graph, expr.from, expr.field, options);
        return values.reduce((total, value) => total + value, 0);
    }
    if (!expr.collect) {
        throw new Error("@derive.sum requires a collect field or from/field");
    }
    const values = evaluateDeriveCollect(graph, expr.collect, options);
    let total = 0;
    for (const value of values) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new Error("@derive.sum requires all collected values to be numeric");
        }
        total += value;
    }
    return total;
}
export function evaluateDeriveMin(graph, expr, options) {
    const values = collectAggregateFieldValues(graph, expr.from, expr.field, options, "@derive.min");
    if (values.length === 0) {
        return null;
    }
    return Math.min(...values);
}
export function evaluateDeriveMax(graph, expr, options) {
    const values = collectAggregateFieldValues(graph, expr.from, expr.field, options, "@derive.max");
    if (values.length === 0) {
        return null;
    }
    return Math.max(...values);
}
export function evaluateDeriveAvg(graph, expr, options) {
    const values = collectAggregateFieldValues(graph, expr.from, expr.field, options, "@derive.avg");
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
}
export function evaluateDeriveAbs(graph, expr, options) {
    if (!expr.value) {
        throw new Error("@derive.abs requires a value expression");
    }
    const value = evaluateDeriveOperand(graph, expr.value, options);
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("@derive.abs requires a numeric value");
    }
    return Math.abs(value);
}
export function evaluateDerivePath(graph, expr, options) {
    if (!expr.node) {
        throw new Error("@derive.path requires a node field");
    }
    if (!expr.relation) {
        throw new Error("@derive.path requires a relation field");
    }
    if (!expr.direction) {
        throw new Error("@derive.path requires a direction field");
    }
    if (!expr.depth) {
        throw new Error("@derive.path requires a depth field");
    }
    const nodeId = resolveNodeRef(expr.node.name, options?.scope, options?.bindings);
    const relations = resolvePathRelations(expr.relation);
    const direction = expr.direction.value;
    const maxDepth = expr.depth.value;
    if (!Number.isInteger(maxDepth) || maxDepth < 1) {
        throw new Error("@derive.path depth must be an integer >= 1");
    }
    if (direction !== "incoming" && direction !== "outgoing" && direction !== "both") {
        throw new Error('@derive.path direction must be "incoming", "outgoing", or "both"');
    }
    const visited = new Set([nodeId]);
    const results = new Set();
    let frontier = [nodeId];
    for (let depth = 0; depth < maxDepth; depth += 1) {
        const nextFrontier = [];
        for (const currentNodeId of frontier) {
            for (const nextNodeId of collectPathNeighbors(graph, currentNodeId, relations, direction)) {
                if (visited.has(nextNodeId)) {
                    continue;
                }
                visited.add(nextNodeId);
                results.add(nextNodeId);
                nextFrontier.push(nextNodeId);
            }
        }
        if (nextFrontier.length === 0) {
            break;
        }
        frontier = nextFrontier;
    }
    const nodeIds = [...results];
    if (!expr.where) {
        return nodeIds;
    }
    return nodeIds.filter((candidateId) => evaluatePathWhereExpr(graph, candidateId, expr.where, options));
}
export function evaluateDeriveExpr(graph, expr, options) {
    switch (expr.type) {
        case "DeriveStateExpr":
            return evaluateDeriveState(graph, expr, options);
        case "DeriveMetaExpr":
            return evaluateDeriveMeta(graph, expr, options);
        case "DeriveCountExpr":
            return evaluateDeriveCount(graph, expr, options);
        case "DeriveEdgeCountExpr":
            return evaluateDeriveEdgeCount(graph, expr, options);
        case "DeriveExistsExpr":
            return evaluateDeriveExists(graph, expr, options);
        case "DerivePathExpr":
            return evaluateDerivePath(graph, expr, options);
        case "DeriveCollectExpr":
            return evaluateDeriveCollect(graph, expr, options);
        case "DeriveSumExpr":
            return evaluateDeriveSum(graph, expr, options);
        case "DeriveMinExpr":
            return evaluateDeriveMin(graph, expr, options);
        case "DeriveMaxExpr":
            return evaluateDeriveMax(graph, expr, options);
        case "DeriveAvgExpr":
            return evaluateDeriveAvg(graph, expr, options);
        case "DeriveAbsExpr":
            return evaluateDeriveAbs(graph, expr, options);
        case "DeriveBinaryExpr": {
            const left = evaluateDeriveOperand(graph, expr.left, options);
            const right = evaluateDeriveOperand(graph, expr.right, options);
            if (expr.operator === "+") {
                if (typeof left === "number" && typeof right === "number") {
                    return left + right;
                }
                if (typeof left === "string" || typeof right === "string") {
                    return `${stringifyGraphValue(left)}${stringifyGraphValue(right)}`;
                }
                throw new Error(`Cannot apply "+" to non-string/non-number derive values`);
            }
            return evaluateNumericBinary(expr.operator, left, right);
        }
        default:
            return exhaustiveNever(expr);
    }
}
function evaluateGraphControlValue(graph, value, options) {
    switch (value.type) {
        case "Identifier":
            return resolveGraphControlIdentifier(value.name, graph, options);
        case "PropertyAccess":
            return resolveGraphControlPropertyAccess(value, graph, options);
        case "StringLiteral":
            return value.value;
        case "NumberLiteral":
            return value.value;
        case "BooleanLiteral":
            return value.value;
        case "RegexLiteral":
            return value.raw;
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
            return evaluateDeriveExpr(graph, value, options);
        default:
            return exhaustiveNever(value);
    }
}
function evaluateDeriveOperand(graph, expr, options) {
    switch (expr.type) {
        case "CurrentValue":
            throw new Error('"current" is only available inside effect derive expressions');
        case "PreviousValue":
            throw new Error('"previous" is only available inside effect derive expressions');
        case "StringLiteral":
            return expr.value;
        case "NumberLiteral":
            return expr.value;
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
            return evaluateDeriveExpr(graph, expr, options);
        default:
            throw new Error(`Unsupported derive operand "${expr.type}"`);
    }
}
function evaluateNumericBinary(operator, left, right) {
    if (typeof left !== "number" || typeof right !== "number") {
        throw new Error(`Numeric derive expressions require number operands`);
    }
    switch (operator) {
        case "-":
            return left - right;
        case "*":
            return left * right;
        case "/":
            return left / right;
        case "%":
            return left % right;
        default:
            throw new Error(`Unsupported numeric derive operator "${operator}"`);
    }
}
function evaluateDeriveAggregateSource(graph, source, options) {
    if (source.type === "DerivePathExpr") {
        return evaluateDerivePath(graph, source, options);
    }
    if (source.type === "Identifier") {
        return resolveAggregateCollection(source.name, options);
    }
    return evaluateAggregateQuery(graph, source);
}
function resolveAggregateCollection(name, options) {
    const bindingValue = options?.bindings?.values.get(name);
    if (!Array.isArray(bindingValue)) {
        throw new Error(`Aggregate source "${name}" must resolve to an array`);
    }
    return bindingValue.flatMap((entry) => {
        if (typeof entry === "string") {
            return [entry];
        }
        if (isRecord(entry) && typeof entry.id === "string") {
            return [entry.id];
        }
        return [];
    });
}
function evaluateAggregateQuery(graph, query) {
    if (!query.typeName) {
        throw new Error('@query(...) aggregate source requires a "type" field');
    }
    const ids = [];
    for (const node of graph.nodes.values()) {
        if (isRecord(node.value) && node.value.type === query.typeName.value) {
            ids.push(node.id);
        }
    }
    return ids;
}
function collectAggregateFieldValues(graph, source, field, options, opName = "@derive.sum") {
    if (!source) {
        throw new Error(`${opName} requires a from field`);
    }
    if (!field) {
        throw new Error(`${opName} requires a field field`);
    }
    const ids = evaluateDeriveAggregateSource(graph, source, options);
    const values = [];
    for (const nodeId of ids) {
        const node = graph.nodes.get(nodeId);
        if (!node) {
            continue;
        }
        const raw = resolveAggregateFieldValue(node, field.value);
        if (typeof raw === "number" && Number.isFinite(raw)) {
            values.push(raw);
        }
    }
    return values;
}
function resolveAggregateFieldValue(node, field) {
    if (Object.prototype.hasOwnProperty.call(node.state, field)) {
        return node.state[field];
    }
    if (Object.prototype.hasOwnProperty.call(node.meta, field)) {
        return node.meta[field];
    }
    if (isRecord(node.value) && Object.prototype.hasOwnProperty.call(node.value, field)) {
        return node.value[field];
    }
    return null;
}
function resolvePathRelations(relation) {
    if (relation.type === "StringLiteral") {
        return [relation.value];
    }
    return relation.elements.map((element) => {
        if (element.type !== "StringLiteral") {
            throw new Error("@derive.path relation arrays must contain only string literals");
        }
        return element.value;
    });
}
function collectPathNeighbors(graph, nodeId, relations, direction) {
    const relationSet = new Set(relations);
    const neighbors = new Set();
    if (direction === "outgoing" || direction === "both") {
        for (const edge of graph.edges) {
            if (edge.subject === nodeId && relationSet.has(edge.relation)) {
                neighbors.add(edge.object);
            }
        }
    }
    if (direction === "incoming" || direction === "both") {
        for (const edge of graph.edges) {
            if (edge.object === nodeId && relationSet.has(edge.relation)) {
                neighbors.add(edge.subject);
            }
        }
    }
    return [...neighbors];
}
function evaluatePathWhereExpr(graph, nodeId, where, options) {
    const node = graph.nodes.get(nodeId);
    if (!node) {
        return false;
    }
    const bindings = {
        values: new Map(options?.bindings?.values ?? []),
        nodes: new Map(options?.bindings?.nodes ?? []),
    };
    bindings.nodes.set("node", node);
    bindings.values.set("node", {
        id: node.id,
        value: node.value,
        state: node.state,
        meta: node.meta,
    });
    switch (where.type) {
        case "BinaryBooleanExpr":
        case "UnaryBooleanExpr":
        case "GroupedBooleanExpr":
        case "ComparisonExpr":
            return evaluateGraphControlExpr(graph, where, {
                scope: options?.scope,
                bindings,
                actions: options?.actions,
            });
        default: {
            const result = evaluateGraphControlValue(graph, where, {
                scope: options?.scope,
                bindings,
                actions: options?.actions,
            });
            if (result === null) {
                return false;
            }
            if (typeof result !== "boolean") {
                throw new Error("@derive.path where must evaluate to a boolean");
            }
            return result;
        }
    }
}
function evaluateEdgeWhereExpr(graph, edge, where, options) {
    const bindings = {
        values: new Map(options?.bindings?.values ?? []),
        nodes: new Map(options?.bindings?.nodes ?? []),
    };
    bindings.values.set("edge", {
        id: edge.id,
        from: edge.subject,
        to: edge.object,
        relation: edge.relation,
        kind: edge.kind,
        meta: cloneGraphValue(edge.meta),
        context: edge.context === null ? null : cloneGraphValue(edge.context),
    });
    const result = evaluateGraphControlExpr(graph, where, {
        scope: options?.scope,
        bindings,
        actions: options?.actions,
    });
    if (typeof result !== "boolean") {
        throw new Error("@derive.edgeCount where must evaluate to a boolean");
    }
    return result;
}
function applyComparisonOperator(operator, left, right) {
    switch (operator) {
        case "==":
            return compareCaseInsensitive(left, right);
        case "===":
            return compareStrict(left, right);
        case "!=":
            return !compareCaseInsensitive(left, right);
        case "!==":
            return !compareStrict(left, right);
        case "<":
        case "<=":
        case ">":
        case ">=":
            return compareNumeric(operator, left, right);
        default:
            return exhaustiveNever(operator);
    }
}
function compareNumeric(operator, left, right) {
    if (typeof left !== "number" || typeof right !== "number") {
        throw new Error(`Numeric comparison "${operator}" requires number operands`);
    }
    switch (operator) {
        case "<":
            return left < right;
        case "<=":
            return left <= right;
        case ">":
            return left > right;
        case ">=":
            return left >= right;
    }
}
function compareStrict(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}
function compareCaseInsensitive(a, b) {
    return JSON.stringify(normalizeCaseInsensitive(a)) === JSON.stringify(normalizeCaseInsensitive(b));
}
function normalizeCaseInsensitive(value) {
    if (typeof value === "string")
        return value.toLowerCase();
    if (Array.isArray(value))
        return value.map((item) => normalizeCaseInsensitive(item));
    if (isRecord(value)) {
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            out[key] = normalizeCaseInsensitive(entry);
        }
        return out;
    }
    return value;
}
function truthy(value) {
    if (value === null)
        return false;
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number")
        return value !== 0;
    if (typeof value === "string")
        return value.length > 0;
    if (Array.isArray(value))
        return value.length > 0;
    if (isRecord(value))
        return Object.keys(value).length > 0;
    return false;
}
function resolveGraphControlIdentifier(name, graph, options) {
    if (name === "from" && options?.scope?.from)
        return options.scope.from;
    if (name === "to" && options?.scope?.to)
        return options.scope.to;
    if (name === "payload")
        return null;
    if (options?.bindings?.nodes.has(name))
        return options.bindings.nodes.get(name).id;
    if (options?.bindings?.values.has(name))
        return options.bindings.values.get(name);
    if (graph.nodes.has(name))
        return name;
    return name;
}
function resolveGraphControlPropertyAccess(access, graph, options) {
    const base = resolveGraphControlIdentifier(access.object.name, graph, options);
    if (isRecord(base)) {
        return dig(base, access.chain.map((part) => part.name));
    }
    if (typeof base === "string" && graph.nodes.has(base)) {
        const node = graph.nodes.get(base);
        const chain = access.chain.map((part) => part.name);
        const first = chain[0];
        if (!first)
            return null;
        if (first === "state")
            return dig(node.state, chain.slice(1));
        if (first === "meta")
            return dig(node.meta, chain.slice(1));
        if (first === "value")
            return dig(node.value, chain.slice(1));
        if (first in node.state)
            return dig(node.state, chain);
        if (first in node.meta)
            return dig(node.meta, chain);
        if (isRecord(node.value) && first in node.value)
            return dig(node.value, chain);
    }
    return null;
}
function dig(value, path) {
    let current = value;
    for (const key of path) {
        if (!isRecord(current))
            return null;
        if (!(key in current))
            return null;
        current = current[key];
    }
    return current;
}
function stringifyGraphValue(value) {
    if (value === null)
        return "";
    if (typeof value === "string")
        return value;
    return JSON.stringify(value);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exhaustiveNever(value) {
    throw new Error(`Unsupported graph control node: ${JSON.stringify(value)}`);
}
function resolveNodeRef(name, scope, bindings) {
    if (name === "from" && scope?.from)
        return scope.from;
    if (name === "to" && scope?.to)
        return scope.to;
    if (bindings?.nodes.has(name))
        return bindings.nodes.get(name).id;
    const boundValue = bindings?.values.get(name);
    if (typeof boundValue === "string") {
        return boundValue;
    }
    return name;
}
function evaluateGraphValue(value, bindings, actions) {
    if (!bindings || !actions) {
        if (value.type === "Identifier") {
            return value.name;
        }
    }
    return evaluateValueExpr(value, bindings ?? { values: new Map(), nodes: new Map() }, actions ?? new Map());
}
function graphValueEquals(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
