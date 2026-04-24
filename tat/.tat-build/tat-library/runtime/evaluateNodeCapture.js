import { getAction } from "./actionRegistry.js";
export function createRuntimeBindings() {
    return {
        values: new Map(),
        nodes: new Map(),
    };
}
export function registerValueBinding(bindings, name, value) {
    bindings.values.set(name, deepClone(value));
}
export function registerNodeBinding(bindings, name, node) {
    bindings.nodes.set(name, cloneGraphNode(node));
    bindings.values.set(name, deepClone(node.value));
}
export function evaluateNodeCapture(name, capture, bindings, actions) {
    const evaluatedValue = evaluateCapturedShape(capture, bindings, actions);
    const extracted = extractNodeStructure(evaluatedValue);
    const id = name;
    const node = {
        id,
        semanticId: extracted.semanticId,
        contract: cloneNodeContract(extracted.contract),
        value: deepClone(extracted.value),
        state: {},
        meta: {},
    };
    return {
        id,
        semanticId: extracted.semanticId,
        contract: cloneNodeContract(extracted.contract),
        value: extracted.value,
        node,
    };
}
export function evaluateCapturedShape(capture, bindings, actions) {
    const shape = capture.shape;
    switch (shape.type) {
        case "Identifier":
            return evaluateIdentifier(shape, bindings);
        case "StringLiteral":
            return shape.value;
        case "NumberLiteral":
            return shape.value;
        case "BooleanLiteral":
            return shape.value;
        case "ObjectLiteral":
            return evaluateObjectLiteral(shape, bindings, actions);
        case "TraversalExpr":
            return evaluateTraversalExpr(shape, bindings, actions);
        default:
            return exhaustiveNever(shape);
    }
}
export function evaluateValueExpr(expr, bindings, actions) {
    switch (expr.type) {
        case "Identifier":
            return evaluateIdentifier(expr, bindings);
        case "StringLiteral":
            return expr.value;
        case "NumberLiteral":
            return expr.value;
        case "BooleanLiteral":
            return expr.value;
        case "PropertyAccess":
            return `${expr.object.name}.${expr.chain.map((part) => part.name).join(".")}`;
        case "RuntimeGenerateNodeIdExpr":
            return `@runtime.generateNodeId(${expr.prefix?.raw ?? ""})`;
        case "RuntimeGenerateValueIdExpr":
            return `@runtime.generateValueId(${expr.prefix?.raw ?? ""})`;
        case "RuntimeNextOrderExpr":
            return "@runtime.nextOrder()";
        case "NodeCapture":
            return evaluateCapturedShape(expr, bindings, actions);
        case "WhereExpr":
            throw new Error(`@where cannot be evaluated as a plain value expression; use @bind(...) or a query statement`);
        case "IfValueExpr":
            throw new Error(`@if cannot be evaluated as a plain value expression`);
        case "DirectiveCallExpr":
            throw new Error(`${expr.name} cannot be evaluated as a plain value expression`);
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
            throw new Error(`${expr.type} cannot be evaluated as a plain value expression`);
        case "CurrentValue":
        case "PreviousValue":
            throw new Error(`${expr.type} cannot be evaluated as a plain value expression`);
        case "ObjectLiteral":
            return evaluateObjectLiteral(expr, bindings, actions);
        case "ArrayLiteral":
            return expr.elements.map((element) => evaluateValueExpr(element, bindings, actions));
        default:
            return exhaustiveNever(expr);
    }
}
function evaluateIdentifier(node, bindings) {
    if (bindings.values.has(node.name)) {
        return deepClone(bindings.values.get(node.name));
    }
    return node.name;
}
function evaluateObjectLiteral(node, bindings, actions) {
    const out = {};
    for (const prop of node.properties) {
        out[prop.key] = evaluateValueExpr(prop.value, bindings, actions);
    }
    return out;
}
function evaluateTraversalExpr(node, bindings, actions) {
    const steps = [];
    for (const segment of node.segments) {
        if (segment.type === "ActionSegment") {
            const action = getAction(actions, segment.operator.name);
            const fromRef = getValueRef(segment.from, bindings);
            const toRef = getValueRef(segment.to, bindings);
            steps.push({
                kind: "action",
                binding: segment.operator.name,
                callee: action ? action.bindingName : segment.operator.name,
                fromRef,
                toRef,
                from: evaluateValueExpr(segment.from, bindings, actions),
                to: evaluateValueExpr(segment.to, bindings, actions),
                action: action ? runtimeActionToValue(action) : null,
            });
            continue;
        }
        const action = getAction(actions, segment.segment.operator.name);
        const fromRef = getValueRef(segment.segment.from, bindings);
        const toRef = getValueRef(segment.segment.to, bindings);
        steps.push({
            kind: "context",
            context: segment.context.name,
            binding: segment.segment.operator.name,
            callee: action ? action.bindingName : segment.segment.operator.name,
            fromRef,
            toRef,
            from: evaluateValueExpr(segment.segment.from, bindings, actions),
            to: evaluateValueExpr(segment.segment.to, bindings, actions),
            action: action ? runtimeActionToValue(action) : null,
        });
    }
    return {
        kind: "traversal",
        source: printTraversalSource(node),
        steps,
    };
}
function getValueRef(expr, bindings) {
    switch (expr.type) {
        case "Identifier":
            if (bindings.nodes.has(expr.name)) {
                return expr.name;
            }
            return null;
        case "NodeCapture":
            return null;
        case "WhereExpr":
            return null;
        case "StringLiteral":
        case "NumberLiteral":
        case "BooleanLiteral":
        case "ObjectLiteral":
        case "ArrayLiteral":
        case "PropertyAccess":
        case "RuntimeGenerateNodeIdExpr":
        case "RuntimeGenerateValueIdExpr":
        case "RuntimeNextOrderExpr":
        case "IfValueExpr":
        case "DirectiveCallExpr":
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
        case "CurrentValue":
        case "PreviousValue":
            return null;
        default:
            return exhaustiveNever(expr);
    }
}
function runtimeActionToValue(action) {
    return {
        bindingName: action.bindingName,
        guard: action.guard ? astNodeToValue(action.guard) : null,
        pipeline: action.pipeline.map((step) => astNodeToValue(step)),
        project: action.project ? astProjectToValue(action.project) : null,
    };
}
function astProjectToValue(node) {
    return astNodeToValue(node);
}
function astNodeToValue(node) {
    if (node === null)
        return null;
    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
        return node;
    }
    if (Array.isArray(node)) {
        return node.map((item) => astNodeToValue(item));
    }
    if (typeof node !== "object") {
        return null;
    }
    const out = {};
    for (const [key, value] of Object.entries(node)) {
        if (key === "span")
            continue;
        out[key] = astNodeToValue(value);
    }
    return out;
}
function printTraversalSource(node) {
    const parts = [];
    for (const segment of node.segments) {
        if (segment.type === "ActionSegment") {
            parts.push(`${printTraversalValue(segment.from)}.${segment.operator.name}.${printTraversalValue(segment.to)}`);
            continue;
        }
        parts.push(`..${segment.context.name}..${printTraversalValue(segment.segment.from)}.${segment.segment.operator.name}.${printTraversalValue(segment.segment.to)}`);
    }
    return parts.join("");
}
function printTraversalValue(expr) {
    switch (expr.type) {
        case "Identifier":
            return expr.name;
        case "StringLiteral":
            return expr.raw;
        case "NumberLiteral":
            return expr.raw;
        case "BooleanLiteral":
            return expr.raw;
        case "NodeCapture":
            return printNodeCapture(expr);
        case "ObjectLiteral":
            return printObjectLiteral(expr);
        case "ArrayLiteral":
            return printArrayLiteral(expr);
        default:
            return "[value]";
    }
}
function printNodeCapture(node) {
    switch (node.shape.type) {
        case "Identifier":
            return `<${node.shape.name}>`;
        case "StringLiteral":
            return `<${node.shape.raw}>`;
        case "NumberLiteral":
            return `<${node.shape.raw}>`;
        case "BooleanLiteral":
            return `<${node.shape.raw}>`;
        case "ObjectLiteral":
            return `<${printObjectLiteral(node.shape)}>`;
        case "TraversalExpr":
            return `<${printTraversalSource(node.shape)}>`;
        default:
            return "<capture>";
    }
}
function printObjectLiteral(node) {
    return `{${node.properties
        .map((prop) => `${prop.key}: ${printTraversalValue(prop.value)}`)
        .join(", ")}}`;
}
function printArrayLiteral(node) {
    return `[${node.elements.map((el) => printTraversalValue(el)).join(", ")}]`;
}
function cloneGraphNode(node) {
    return {
        id: node.id,
        semanticId: node.semanticId,
        contract: cloneNodeContract(node.contract),
        value: deepClone(node.value),
        state: deepCloneRecord(node.state),
        meta: deepCloneRecord(node.meta),
    };
}
function extractNodeStructure(value) {
    if (!isRecordValue(value)) {
        return { value };
    }
    const semanticIdValue = value.semanticId;
    const contractValue = value.contract;
    if (semanticIdValue !== undefined && typeof semanticIdValue !== "string") {
        throw new Error("semanticId must be a string when present on a node capture");
    }
    if (contractValue !== undefined && !isValidNodeContractValue(contractValue)) {
        throw new Error("contract must be an object with optional string-array in/out fields");
    }
    const nextValue = deepCloneRecord(value);
    delete nextValue.semanticId;
    delete nextValue.contract;
    return {
        ...(typeof semanticIdValue === "string" ? { semanticId: semanticIdValue } : {}),
        ...(contractValue ? { contract: normalizeNodeContractValue(contractValue) } : {}),
        value: nextValue,
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
function isValidNodeContractValue(value) {
    if (!isRecordValue(value)) {
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
function normalizeNodeContractValue(value) {
    const contractValue = value;
    return {
        ...(Array.isArray(contractValue.in)
            ? { in: contractValue.in.map((item) => String(item)) }
            : {}),
        ...(Array.isArray(contractValue.out)
            ? { out: contractValue.out.map((item) => String(item)) }
            : {}),
    };
}
function exhaustiveNever(value) {
    throw new Error(`Unexpected node: ${JSON.stringify(value)}`);
}
