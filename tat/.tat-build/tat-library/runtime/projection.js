import { evaluateValueExpr } from "./evaluateNodeCapture.js";
import { cloneGraphValue, getNode, getIncomingEdges, getOutgoingEdges, } from "./graph.js";
import { evaluateActionGuard } from "./executeAction.js";
import { getAction } from "./actionRegistry.js";
import { evaluateDeriveExpr, evaluateGraphControlExpr, } from "./evaluateGraphControl.js";
function isBirthParentEdge(edge) {
    return (edge.relation === "birthParent" ||
        (edge.relation === "parentOf" &&
            (edge.meta.kind === "birth" || edge.meta.kind === undefined)));
}
function isStepParentEdge(edge) {
    return (edge.relation === "stepParent" ||
        (edge.relation === "parentOf" && edge.meta.kind === "step"));
}
function isSpouseEdge(edge) {
    return (edge.relation === "spouse" ||
        (edge.relation === "spouseOf" &&
            (edge.meta.active === true || edge.meta.active === undefined)));
}
export const PROJECT_FORMATS = [
    "graph",
    "detail",
    "assignment_status",
    "menu",
    "list",
    "tree",
    "generations",
    "timeline",
    "trace",
    "summary",
    "relationships",
    "siblings",
    "ancestors",
    "descendants",
];
export const PROJECT_INCLUDE_KEYS = [
    "id",
    "step",
    "from",
    "to",
    "raw",
    "label",
    "type",
    "value",
    "state",
    "meta",
    "relationships",
    "children",
    "events",
    "actions",
    "action",
    "target",
    "event",
    "status",
    "counts",
];
export const PROJECT_FORMAT_RULES = {
    graph: {
        core: ["id", "type", "value", "state", "meta", "relationships"],
        allowed: ["label", "status"],
        contractKey: "nodes",
    },
    detail: {
        core: ["id", "label", "type", "state", "meta"],
        allowed: ["value", "relationships", "actions", "status", "events"],
        contractKey: "node",
    },
    assignment_status: {
        core: [],
        allowed: [],
        contractKey: "data",
    },
    menu: {
        core: ["label", "action", "target"],
        allowed: ["id", "status", "meta"],
        contractKey: "items",
    },
    list: {
        core: ["id", "label"],
        allowed: [
            "type",
            "status",
            "value",
            "state",
            "meta",
            "action",
            "target",
            "event",
        ],
        contractKey: "items",
    },
    tree: {
        core: ["label", "children"],
        allowed: ["id", "type", "value", "state", "status", "meta"],
        contractKey: "tree",
    },
    generations: {
        core: ["id", "label", "value", "state", "meta"],
        allowed: ["type", "status"],
        contractKey: "data",
    },
    timeline: {
        core: ["events"],
        allowed: [
            "id",
            "step",
            "from",
            "event",
            "action",
            "target",
            "label",
            "status",
            "state",
            "meta",
            "raw",
        ],
        contractKey: "events",
    },
    trace: {
        core: ["events"],
        allowed: [
            "id",
            "step",
            "from",
            "to",
            "event",
            "action",
            "target",
            "status",
            "state",
            "meta",
            "label",
            "raw",
        ],
        contractKey: "events",
    },
    summary: {
        core: ["label", "status"],
        allowed: ["id", "value", "state", "meta", "actions", "counts"],
        contractKey: "data",
    },
    relationships: {
        core: ["id", "label", "value", "state", "meta"],
        allowed: ["type", "status"],
        contractKey: "data",
    },
    siblings: {
        core: ["id", "label", "value", "state", "meta"],
        allowed: ["type", "status"],
        contractKey: "data",
    },
    ancestors: {
        core: ["id", "label", "value", "state", "meta"],
        allowed: ["type", "status"],
        contractKey: "data",
    },
    descendants: {
        core: ["id", "label", "value", "state", "meta"],
        allowed: ["type", "status"],
        contractKey: "data",
    },
};
export function projectGraphResult(graph, projection, state) {
    if (projection?.projectionName) {
        return executeNamedProjection(graph, projection, state);
    }
    const spec = resolveProjectSpec(graph, projection, state);
    const context = {
        graph,
        focus: spec.focus,
        bindings: state.bindings,
        actions: state.actions,
    };
    switch (spec.format) {
        case "graph":
            return projectGraphFormat(context, spec);
        case "detail":
            return projectDetailFormat(context, spec);
        case "assignment_status":
            return projectAssignmentStatusFormat(context, spec);
        case "menu":
            return {
                format: "menu",
                focus: projectNodeReference(getNode(graph, spec.focus)),
                items: buildMenuPairs(context).map((pair, index) => selectMenuFields(pair, spec.include, context, index)),
            };
        case "list":
            return projectListFormat(context, spec);
        case "tree":
            return {
                format: "tree",
                focus: projectNodeReference(getNode(graph, spec.focus)),
                tree: buildTreeNode(spec.focus, spec.include, context, new Set()),
            };
        case "generations":
            return projectGenerationsFormat(context, spec);
        case "timeline":
            return {
                format: "timeline",
                focus: projectNodeReference(getNode(graph, spec.focus)),
                events: buildTimelineEvents(context).map((event) => selectEventFields(event, spec.include)),
            };
        case "trace":
            return {
                format: "trace",
                focus: projectNodeReference(getNode(graph, spec.focus)),
                steps: buildTraceEvents(context).map((event) => selectEventFields(event, spec.include)),
            };
        case "summary":
            return projectSummaryFormat(context, spec);
        case "relationships":
            return projectRelationshipsFormat(context, spec);
        case "siblings":
            return projectSiblingsFormat(context, spec);
        case "ancestors":
            return projectAncestorsFormat(context, spec);
        case "descendants":
            return projectDescendantsFormat(context, spec);
    }
}
function executeNamedProjection(graph, invocation, state) {
    const projectionName = invocation.projectionName?.name;
    if (!projectionName) {
        throw new Error("@project named projection is missing a projection name");
    }
    const definition = state.projectionDefinitions.get(projectionName);
    if (!definition) {
        if (isProjectFormat(projectionName)) {
            return projectGraphResult(graph, {
                ...invocation,
                projectionName: null,
                args: [
                    {
                        type: "Argument",
                        key: { type: "Identifier", name: "format" },
                        value: {
                            type: "StringLiteral",
                            value: projectionName,
                            raw: `"${projectionName}"`,
                        },
                    },
                    ...invocation.args,
                ],
            }, state);
        }
        throw new Error(`Unknown projection "${projectionName}"`);
    }
    const focusExpr = getProjectArgument(invocation, "focus")?.value ?? definition.focus;
    if (!focusExpr) {
        throw new Error(`Projection "${projectionName}" requires a focus value`);
    }
    const focusNodeId = resolveProjectionFocusNodeId(graph, focusExpr, state, new Map());
    const scope = new Map();
    scope.set("focus", focusNodeId);
    const context = {
        graph,
        state,
        scope,
    };
    const output = {};
    for (const property of definition.fields.properties) {
        const value = evaluateProjectionValue(property.value, context);
        output[property.key] = value;
        scope.set(property.key, cloneGraphValue(value));
    }
    validateProjectionContract(definition.contract, output, projectionName);
    return output;
}
function validateProjectionContract(contract, output, projectionName) {
    if (!contract) {
        return;
    }
    for (const entry of contract.entries) {
        if (entry.requirement === "required" && !(entry.key in output)) {
            throw new Error(`Projection "${projectionName}" is missing required field "${entry.key}"`);
        }
    }
}
function resolveProjectionFocusNodeId(graph, expr, state, scope) {
    const value = evaluateProjectionValue(expr, {
        graph,
        state,
        scope,
    });
    const nodeId = asNodeReferenceId(value);
    if (!nodeId) {
        throw new Error("Projection focus must resolve to exactly one node");
    }
    if (!graph.nodes.has(nodeId)) {
        throw new Error(`Projection focus "${nodeId}" does not resolve to a node in the graph`);
    }
    return nodeId;
}
function evaluateProjectionValue(expr, context) {
    switch (expr.type) {
        case "Identifier":
            return resolveProjectionIdentifier(expr.name, context);
        case "PropertyAccess":
            return resolveProjectionPropertyAccess(expr.object.name, expr.chain.map((part) => part.name), context);
        case "StringLiteral":
            return expr.value;
        case "NumberLiteral":
            return expr.value;
        case "BooleanLiteral":
            return expr.value;
        case "ObjectLiteral": {
            const out = {};
            for (const property of expr.properties) {
                out[property.key] = evaluateProjectionValue(property.value, context);
            }
            return out;
        }
        case "ArrayLiteral":
            return expr.elements.map((element) => evaluateProjectionValue(element, context));
        case "DirectiveCallExpr":
            return evaluateProjectionDirective(expr, context);
        case "IfValueExpr":
            return evaluateProjectionIf(expr, context);
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
            return evaluateDeriveExpr(context.graph, expr, {
                bindings: createProjectionBindings(context),
            });
        case "CurrentValue":
        case "PreviousValue":
            throw new Error(`Unsupported projection expression "${expr.type}"`);
        case "RuntimeGenerateNodeIdExpr":
            return `@runtime.generateNodeId(${expr.prefix?.raw ?? ""})`;
        case "RuntimeGenerateValueIdExpr":
            return `@runtime.generateValueId(${expr.prefix?.raw ?? ""})`;
        case "RuntimeNextOrderExpr":
            return "@runtime.nextOrder()";
        case "NodeCapture":
            return evaluateValueExpr(expr, createProjectionBindings(context), context.state.actions);
        case "WhereExpr":
            throw new Error("@where is not supported inside projection fields");
        default:
            return exhaustiveNever(expr);
    }
}
function evaluateProjectionIf(expr, context) {
    if (!expr.when) {
        throw new Error("@if requires a when clause");
    }
    if (!expr.then) {
        throw new Error("@if requires a then value");
    }
    const result = evaluateGraphControlExpr(context.graph, expr.when, {
        bindings: createProjectionBindings(context),
        actions: context.state.actions,
    });
    if (result) {
        return evaluateProjectionValue(expr.then, context);
    }
    if (!expr.else) {
        return null;
    }
    return evaluateProjectionValue(expr.else, context);
}
function evaluateProjectionDirective(expr, context) {
    switch (expr.name) {
        case "@select.node": {
            assertDirectiveArgCount(expr, 1);
            const nodeId = requireNodeReference(evaluateProjectionValue(expr.args[0].value, context), expr.name);
            return nodeId;
        }
        case "@select.targets": {
            assertDirectiveArgCount(expr, 2);
            const nodeId = requireNodeReference(evaluateProjectionValue(expr.args[0].value, context), expr.name);
            const relation = requireStringValue(evaluateProjectionValue(expr.args[1].value, context), `${expr.name} relation`);
            return getOutgoingEdges(context.graph, nodeId)
                .filter((edge) => edge.relation === relation)
                .map((edge) => edge.object);
        }
        case "@select.sources": {
            assertDirectiveArgCount(expr, 2);
            const nodeId = requireNodeReference(evaluateProjectionValue(expr.args[0].value, context), expr.name);
            const relation = requireStringValue(evaluateProjectionValue(expr.args[1].value, context), `${expr.name} relation`);
            return getIncomingEdges(context.graph, nodeId)
                .filter((edge) => edge.relation === relation)
                .map((edge) => edge.subject);
        }
        case "@select.first": {
            assertDirectiveArgCount(expr, 1);
            const value = evaluateProjectionValue(expr.args[0].value, context);
            if (!Array.isArray(value)) {
                throw new Error(`${expr.name} requires an array argument`);
            }
            return value.length > 0 ? cloneGraphValue(value[0]) : null;
        }
        case "@select.one": {
            assertDirectiveArgCount(expr, 1);
            const value = evaluateProjectionValue(expr.args[0].value, context);
            if (!Array.isArray(value)) {
                throw new Error(`${expr.name} requires an array argument`);
            }
            if (value.length !== 1) {
                throw new Error(`${expr.name} requires exactly one item but received ${value.length}`);
            }
            return cloneGraphValue(value[0]);
        }
        default:
            throw new Error(`Unknown directive "${expr.name}"`);
    }
}
function resolveProjectionIdentifier(name, context) {
    if (context.scope.has(name)) {
        return cloneGraphValue(context.scope.get(name));
    }
    if (context.state.bindings.nodes.has(name)) {
        return projectNodeReference(context.state.bindings.nodes.get(name));
    }
    if (context.state.bindings.values.has(name)) {
        return cloneGraphValue(context.state.bindings.values.get(name));
    }
    throw new Error(`Undefined projection binding "${name}"`);
}
function resolveProjectionPropertyAccess(objectName, chain, context) {
    const base = resolveProjectionIdentifier(objectName, context);
    if (!isRecord(base)) {
        return null;
    }
    return digProjectionValue(base, chain);
}
function createProjectionBindings(context) {
    const bindings = {
        values: new Map(context.state.bindings.values),
        nodes: new Map(context.state.bindings.nodes),
    };
    for (const [key, value] of context.scope.entries()) {
        bindings.values.set(key, cloneGraphValue(value));
    }
    return bindings;
}
function asNodeReferenceId(value) {
    if (typeof value === "string") {
        return value;
    }
    if (isRecord(value) && typeof value.id === "string") {
        return value.id;
    }
    return null;
}
function requireNodeReference(value, opName) {
    const nodeId = asNodeReferenceId(value);
    if (!nodeId) {
        throw new Error(`${opName} requires a node reference`);
    }
    return nodeId;
}
function requireStringValue(value, label) {
    if (typeof value !== "string") {
        throw new Error(`${label} must resolve to a string`);
    }
    return value;
}
function assertDirectiveArgCount(expr, expected) {
    if (expr.args.length !== expected) {
        throw new Error(`${expr.name} expects ${expected} argument${expected === 1 ? "" : "s"}`);
    }
}
function digProjectionValue(value, path) {
    let current = value;
    for (const part of path) {
        if (!isRecord(current) || !(part in current)) {
            return null;
        }
        current = current[part];
    }
    return cloneGraphValue(current);
}
export function resolveProjectSpec(graph, projection, state) {
    if (!projection) {
        if (!graph.root) {
            throw new Error(`@project could not determine a focus node because the graph has no root`);
        }
        return {
            format: "graph",
            focus: graph.root,
            include: fullIncludeSet("graph"),
            depth: null,
        };
    }
    const formatArg = getProjectArgument(projection, "format");
    if (!formatArg) {
        throw new Error(`@project requires a format field`);
    }
    const formatValue = evaluateValueExpr(formatArg.value, state.bindings, state.actions);
    if (typeof formatValue !== "string") {
        throw new Error(`@project format must resolve to a string`);
    }
    if (!isProjectFormat(formatValue)) {
        throw new Error(`Invalid @project format "${formatValue}"`);
    }
    const focusArg = getProjectArgument(projection, "focus");
    const includeArg = getProjectArgument(projection, "include");
    if (projection.syntax === "block") {
        if (!focusArg) {
            throw new Error(`@project requires a focus field`);
        }
        if (!includeArg) {
            throw new Error(`@project requires an include field`);
        }
    }
    const focus = focusArg
        ? resolveFocusNodeId(focusArg.value, graph, state.bindings, state.actions)
        : graph.root;
    if (!focus) {
        throw new Error(`@project could not determine a focus node`);
    }
    if (!graph.nodes.has(focus)) {
        throw new Error(`@project focus "${focus}" does not resolve to a node in the graph`);
    }
    const include = includeArg
        ? resolveProjectInclude(includeArg.value, formatValue, state.bindings, state.actions)
        : fullIncludeSet(formatValue);
    const depthArg = getProjectArgument(projection, "depth");
    const depthValue = depthArg
        ? evaluateValueExpr(depthArg.value, state.bindings, state.actions)
        : null;
    if (depthValue !== null &&
        (typeof depthValue !== "number" ||
            !Number.isInteger(depthValue) ||
            depthValue < 1)) {
        throw new Error(`@project depth must resolve to an integer >= 1`);
    }
    return {
        format: formatValue,
        focus,
        include,
        depth: depthValue,
    };
}
export function getProjectArgument(projection, key) {
    return projection.args.find((arg) => arg.key && arg.key.name === key) ?? null;
}
export function isProjectFormat(value) {
    return PROJECT_FORMATS.includes(value);
}
export function isProjectIncludeKey(value) {
    return PROJECT_INCLUDE_KEYS.includes(value);
}
export function fullIncludeSet(format) {
    const rule = PROJECT_FORMAT_RULES[format];
    return [...rule.core, ...rule.allowed];
}
function resolveProjectInclude(expr, format, bindings, actions) {
    const value = evaluateValueExpr(expr, bindings, actions);
    if (!Array.isArray(value)) {
        throw new Error(`@project include must resolve to an array`);
    }
    const include = [];
    const seen = new Set();
    const rule = PROJECT_FORMAT_RULES[format];
    const allowed = new Set([...rule.core, ...rule.allowed]);
    for (const entry of value) {
        if (typeof entry !== "string") {
            throw new Error(`@project include entries must resolve to strings`);
        }
        if (!isProjectIncludeKey(entry)) {
            throw new Error(`Invalid @project include key "${entry}"`);
        }
        if (!allowed.has(entry)) {
            throw new Error(`@project format "${format}" does not allow include key "${entry}"`);
        }
        if (!seen.has(entry)) {
            include.push(entry);
            seen.add(entry);
        }
    }
    for (const required of rule.core) {
        if (!seen.has(required)) {
            throw new Error(`@project format "${format}" requires include key "${required}"`);
        }
    }
    return include;
}
function resolveFocusNodeId(expr, graph, bindings, actions) {
    if (expr.type === "Identifier" && bindings.nodes.has(expr.name)) {
        return bindings.nodes.get(expr.name).id;
    }
    const value = evaluateValueExpr(expr, bindings, actions);
    if (typeof value !== "string") {
        throw new Error(`@project focus must resolve to a node reference`);
    }
    if (bindings.nodes.has(value)) {
        return bindings.nodes.get(value).id;
    }
    if (!graph.nodes.has(value)) {
        throw new Error(`@project focus "${value}" does not resolve to a node in the graph`);
    }
    return value;
}
function projectGraphFormat(context, spec) {
    const focusNode = getNode(context.graph, spec.focus);
    const reachableEdges = getOutgoingEdges(context.graph, spec.focus);
    const reachableIds = new Set([
        spec.focus,
        ...reachableEdges.map((edge) => edge.object),
    ]);
    return {
        format: "graph",
        focus: spec.focus,
        nodes: Array.from(reachableIds).map((nodeId) => selectNodeFields(getNode(context.graph, nodeId), spec.include, context)),
        edges: reachableEdges.map((edge) => ({
            id: edge.id,
            relation: edge.relation,
            source: edge.subject,
            target: edge.object,
            kind: edge.kind,
            meta: cloneGraphValue(edge.meta),
            context: edge.context === null ? null : cloneGraphValue(edge.context),
            focus: focusNode.id,
        })),
    };
}
function projectDetailFormat(context, spec) {
    const focusNode = resolveFocusNode(context.graph, spec.focus);
    return {
        format: "detail",
        focus: projectNodeReference(focusNode),
        node: selectNodeFields(focusNode, spec.include, context),
    };
}
function projectAssignmentStatusFormat(context, spec) {
    const focusNode = resolveFocusNode(context.graph, spec.focus);
    const viewerRole = typeof focusNode.state.viewerRole === "string"
        ? focusNode.state.viewerRole
        : "TEACHER";
    const viewerId = typeof focusNode.state.viewerId === "string"
        ? focusNode.state.viewerId
        : "";
    const assignmentSubmissionNodes = getAssignmentSubmissionNodes(context.graph, focusNode.id);
    const relevantSubmissionNodes = viewerRole === "STUDENT"
        ? getStudentAssignmentSubmissionNodes(context.graph, assignmentSubmissionNodes, viewerId)
        : assignmentSubmissionNodes;
    const submissionCount = relevantSubmissionNodes.length;
    const gradedCount = relevantSubmissionNodes.filter((node) => node.state.gradingState === "graded").length;
    const ungradedCount = relevantSubmissionNodes.filter((node) => node.state.gradingState === "ungraded").length;
    const hasSubmission = submissionCount > 0;
    const hasGrade = gradedCount > 0;
    const gradingState = viewerRole === "STUDENT"
        ? deriveStudentAssignmentGradingState(relevantSubmissionNodes)
        : undefined;
    const statusPayload = deriveAssignmentStatusProjection(viewerRole, submissionCount, ungradedCount, hasSubmission, hasGrade, gradingState);
    return {
        format: "assignment_status",
        node: {
            id: focusNode.id,
            label: computeNodeLabel(focusNode),
            type: "assignment",
        },
        viewer: {
            role: viewerRole,
            viewerId,
        },
        status: {
            code: statusPayload.status.code,
            label: statusPayload.status.label,
            tone: statusPayload.status.tone,
        },
        nextAction: {
            code: statusPayload.nextAction.code,
            label: statusPayload.nextAction.label,
        },
        meta: {
            ...(submissionCount !== undefined ? { submissionCount } : {}),
            ...(gradedCount !== undefined ? { gradedCount } : {}),
            ...(ungradedCount !== undefined ? { ungradedCount } : {}),
            ...(hasSubmission !== undefined ? { hasSubmission } : {}),
            ...(hasGrade !== undefined ? { hasGrade } : {}),
        },
    };
}
function getAssignmentSubmissionNodes(graph, assignmentNodeId) {
    return getIncomingEdges(graph, assignmentNodeId)
        .filter((edge) => edge.relation === "forAssignment")
        .map((edge) => getNode(graph, edge.subject))
        .filter((node) => node.meta.type === "submission");
}
function getStudentAssignmentSubmissionNodes(graph, assignmentSubmissionNodes, viewerId) {
    const viewerSemanticId = `student:${viewerId}`;
    return assignmentSubmissionNodes.filter((submissionNode) => getIncomingEdges(graph, submissionNode.id).some((edge) => {
        if (edge.relation !== "submitted")
            return false;
        const studentNode = getNode(graph, edge.subject);
        return studentNode.semanticId === viewerSemanticId;
    }));
}
function deriveStudentAssignmentGradingState(submissionNodes) {
    if (submissionNodes.some((node) => node.state.gradingState === "ungraded")) {
        return "ungraded";
    }
    if (submissionNodes.some((node) => node.state.gradingState === "graded")) {
        return "graded";
    }
    return undefined;
}
function deriveAssignmentStatusProjection(viewerRole, submissionCount, ungradedCount, hasSubmission, hasGrade, gradingState) {
    if (viewerRole === "STUDENT") {
        if (hasSubmission === false) {
            return {
                status: {
                    code: "awaiting_submission",
                    label: "Not Submitted",
                    tone: "danger",
                },
                nextAction: { code: "submit_work", label: "Submit Assignment" },
            };
        }
        if (hasSubmission === true && gradingState === "ungraded") {
            return {
                status: { code: "submitted", label: "Submitted", tone: "info" },
                nextAction: { code: "wait_for_grade", label: "Wait for Grade" },
            };
        }
        if (hasSubmission === true && gradingState === "graded") {
            return {
                status: { code: "graded", label: "Graded", tone: "success" },
                nextAction: { code: "review_feedback", label: "Review Feedback" },
            };
        }
    }
    if (viewerRole === "TEACHER" || viewerRole === "ADMIN") {
        if (submissionCount === 0) {
            return {
                status: {
                    code: "no_submissions",
                    label: "No Submissions",
                    tone: "neutral",
                },
                nextAction: { code: "none", label: "No Action Needed" },
            };
        }
        if ((submissionCount ?? 0) > 0 && (ungradedCount ?? 0) > 0) {
            return {
                status: {
                    code: "needs_grading",
                    label: "Needs Grading",
                    tone: "warning",
                },
                nextAction: { code: "grade_submissions", label: "Grade Submissions" },
            };
        }
        if ((submissionCount ?? 0) > 0 && (ungradedCount ?? 0) === 0) {
            return {
                status: { code: "graded", label: "Graded", tone: "success" },
                nextAction: { code: "view_submissions", label: "View Submissions" },
            };
        }
    }
    if (hasSubmission === true && hasGrade === true) {
        return {
            status: { code: "graded", label: "Graded", tone: "success" },
            nextAction: { code: "review_feedback", label: "Review Feedback" },
        };
    }
    return {
        status: { code: "unknown", label: "Unknown", tone: "neutral" },
        nextAction: { code: "none", label: "No Action Available" },
    };
}
function projectListFormat(context, spec) {
    return {
        format: "list",
        focus: projectNodeReference(resolveFocusNode(context.graph, spec.focus)),
        items: getPreferredListEdges(context.graph, spec.focus).map((edge, index) => selectListFields(getNode(context.graph, edge.object), spec.include, context, index)),
    };
}
function projectSummaryFormat(context, spec) {
    const focusNode = resolveFocusNode(context.graph, spec.focus);
    return {
        format: "summary",
        focus: projectNodeReference(focusNode),
        data: selectSummaryFields(focusNode, spec.include, context),
    };
}
function projectRelationshipsFormat(context, spec) {
    const focusNode = resolveFocusNode(context.graph, spec.focus);
    const birthParents = projectRelationshipNodes(getIncomingEdges(context.graph, spec.focus, "branch").filter((edge) => isBirthParentEdge(edge)), "subject", spec.include, context);
    const stepParents = projectRelationshipNodes(getIncomingEdges(context.graph, spec.focus, "branch").filter((edge) => isStepParentEdge(edge)), "subject", spec.include, context);
    const spouses = projectRelationshipNodes([
        ...getOutgoingEdges(context.graph, spec.focus, "branch").filter((edge) => isSpouseEdge(edge)),
        ...getIncomingEdges(context.graph, spec.focus, "branch").filter((edge) => isSpouseEdge(edge)),
    ], "other", spec.include, context, spec.focus);
    const birthChildren = projectRelationshipNodes(getOutgoingEdges(context.graph, spec.focus, "branch").filter((edge) => isBirthParentEdge(edge)), "object", spec.include, context);
    const stepChildren = projectRelationshipNodes(getOutgoingEdges(context.graph, spec.focus, "branch").filter((edge) => isStepParentEdge(edge)), "object", spec.include, context);
    return {
        format: "relationships",
        focus: projectNodeReference(focusNode),
        parents: birthParents,
        birthParents,
        stepParents,
        spouses,
        children: birthChildren,
        birthChildren,
        stepChildren,
    };
}
function projectSiblingsFormat(context, spec) {
    const focusNode = resolveFocusNode(context.graph, spec.focus);
    const parentIds = getIncomingEdges(context.graph, spec.focus, "branch")
        .filter((edge) => isBirthParentEdge(edge))
        .map((edge) => edge.subject);
    const siblingIds = new Set();
    for (const parentId of parentIds) {
        const childEdges = getOutgoingEdges(context.graph, parentId, "branch").filter((edge) => isBirthParentEdge(edge));
        for (const edge of childEdges) {
            if (edge.object !== spec.focus) {
                siblingIds.add(edge.object);
            }
        }
    }
    return {
        format: "siblings",
        focus: projectNodeReference(focusNode),
        siblings: [...siblingIds]
            .map((nodeId) => getNode(context.graph, nodeId))
            .sort(compareProjectionNodes)
            .map((node) => selectNodeFields(node, spec.include, context)),
    };
}
function projectAncestorsFormat(context, spec) {
    const focusNode = resolveFocusNode(context.graph, spec.focus);
    const depth = spec.depth ?? 1;
    const nodeIds = collectProjectedPathNodeIds(context.graph, spec.focus, ["parentOf", "birthParent"], "incoming", depth);
    return {
        format: "ancestors",
        focus: projectNodeReference(focusNode),
        depth,
        ancestors: nodeIds
            .map((nodeId) => getNode(context.graph, nodeId))
            .sort(compareProjectionNodes)
            .map((node) => selectNodeFields(node, spec.include, context)),
    };
}
function projectDescendantsFormat(context, spec) {
    const focusNode = resolveFocusNode(context.graph, spec.focus);
    const depth = spec.depth ?? 1;
    const nodeIds = collectProjectedPathNodeIds(context.graph, spec.focus, ["parentOf", "birthParent"], "outgoing", depth);
    return {
        format: "descendants",
        focus: projectNodeReference(focusNode),
        depth,
        descendants: nodeIds
            .map((nodeId) => getNode(context.graph, nodeId))
            .sort(compareProjectionNodes)
            .map((node) => selectNodeFields(node, spec.include, context)),
    };
}
function projectGenerationsFormat(context, spec) {
    const focusNode = resolveFocusNode(context.graph, spec.focus);
    const spouseIds = collectProjectedPathNeighbors(context.graph, spec.focus, new Set(["spouse", "spouseOf"]), "both");
    const ancestorDepths = collectGenerationDepths(context.graph, spec.focus, "incoming", 3);
    const descendantDepths = collectGenerationDepths(context.graph, spec.focus, "outgoing", 1);
    return {
        format: "generations",
        focus: projectNodeReference(focusNode),
        generations: {
            "3": projectGenerationNodes(ancestorDepths.get(3) ?? [], spec.include, context),
            "2": projectGenerationNodes(ancestorDepths.get(2) ?? [], spec.include, context),
            "1": projectGenerationNodes(ancestorDepths.get(1) ?? [], spec.include, context),
            "0": projectGenerationNodes([spec.focus, ...spouseIds.filter((nodeId) => nodeId !== spec.focus)], spec.include, context),
            "-1": projectGenerationNodes(descendantDepths.get(1) ?? [], spec.include, context),
        },
    };
}
function collectGenerationDepths(graph, startNodeId, direction, maxDepth) {
    const visited = new Set([startNodeId]);
    const depthMap = new Map();
    let frontier = [startNodeId];
    for (let depth = 1; depth <= maxDepth; depth += 1) {
        const nextFrontier = [];
        for (const currentNodeId of frontier) {
            const neighbors = collectProjectedPathNeighbors(graph, currentNodeId, new Set(["birthParent", "parentOf"]), direction);
            for (const nextNodeId of neighbors) {
                if (visited.has(nextNodeId)) {
                    continue;
                }
                visited.add(nextNodeId);
                nextFrontier.push(nextNodeId);
            }
        }
        if (nextFrontier.length === 0) {
            break;
        }
        depthMap.set(depth, nextFrontier);
        frontier = nextFrontier;
    }
    return depthMap;
}
function projectGenerationNodes(nodeIds, include, context) {
    return [...new Set(nodeIds)]
        .map((nodeId) => getNode(context.graph, nodeId))
        .sort(compareProjectionNodes)
        .map((node) => selectNodeFields(node, include, context));
}
function collectProjectedPathNodeIds(graph, startNodeId, relations, direction, maxDepth) {
    const relationSet = new Set(relations);
    const visited = new Set([startNodeId]);
    const results = new Set();
    let frontier = [startNodeId];
    for (let depth = 0; depth < maxDepth; depth += 1) {
        const nextFrontier = [];
        for (const currentNodeId of frontier) {
            for (const nextNodeId of collectProjectedPathNeighbors(graph, currentNodeId, relationSet, direction)) {
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
    return [...results];
}
function collectProjectedPathNeighbors(graph, nodeId, relations, direction) {
    const neighbors = new Set();
    if (direction === "outgoing" || direction === "both") {
        for (const edge of getOutgoingEdges(graph, nodeId, "branch")) {
            if (relations.has(edge.relation)) {
                neighbors.add(edge.object);
            }
        }
    }
    if (direction === "incoming" || direction === "both") {
        for (const edge of getIncomingEdges(graph, nodeId, "branch")) {
            if (relations.has(edge.relation)) {
                neighbors.add(edge.subject);
            }
        }
    }
    return [...neighbors];
}
function resolveFocusNode(graph, focus) {
    return getNode(graph, focus);
}
function projectRelationshipNodes(edges, side, include, context, focusId) {
    const nodeIds = new Set();
    for (const edge of edges) {
        let nodeId;
        if (side === "subject") {
            nodeId = edge.subject;
        }
        else if (side === "object") {
            nodeId = edge.object;
        }
        else {
            nodeId = edge.subject === focusId ? edge.object : edge.subject;
        }
        if (nodeId) {
            nodeIds.add(nodeId);
        }
    }
    return [...nodeIds]
        .map((nodeId) => getNode(context.graph, nodeId))
        .sort(compareProjectionNodes)
        .map((node) => selectNodeFields(node, include, context));
}
function selectNodeFields(node, include, context) {
    const out = {};
    if (typeof node.semanticId === "string") {
        out.semanticId = node.semanticId;
    }
    if (node.contract) {
        out.contract = {
            ...(node.contract.in ? { in: [...node.contract.in] } : {}),
            ...(node.contract.out ? { out: [...node.contract.out] } : {}),
        };
    }
    for (const key of include) {
        switch (key) {
            case "id":
                out.id = node.id;
                break;
            case "label":
                out.label = computeNodeLabel(node);
                break;
            case "type": {
                const type = computeNodeType(node);
                if (type !== null)
                    out.type = type;
                break;
            }
            case "value":
                out.value = cloneGraphValue(node.value);
                break;
            case "state":
                out.state = cloneRecord(node.state);
                break;
            case "meta":
                out.meta = cloneRecord(node.meta);
                break;
            case "relationships":
                out.relationships = getOutgoingEdges(context.graph, node.id)
                    .filter((edge) => edge.kind === "branch")
                    .map((edge) => ({
                    relation: edge.relation,
                    target: edge.object,
                }));
                break;
            case "actions":
                out.actions = buildAvailableActions(node.id, context).map((action) => projectActionReference(action, resolveActionId(action)));
                break;
            case "events":
                out.events = buildTimelineEvents({ ...context, focus: node.id }).map((event) => selectEventFields(event, [
                    "id",
                    "event",
                    "label",
                    "target",
                    "action",
                    "status",
                ]));
                break;
            case "status":
                out.status = deriveProjectionStatus(node);
                break;
            case "action":
            case "target":
            case "event":
            case "children":
            case "counts":
                break;
        }
    }
    return out;
}
function selectMenuFields(pair, include, context, _index) {
    const out = {};
    const actionId = resolveMenuActionId(pair);
    for (const key of include) {
        switch (key) {
            case "id":
                out.id = `${context.focus}.${actionId}.${pair.target.id}`;
                break;
            case "label":
                out.label = `${pair.action.label} ${computeNodeLabel(pair.target)}`;
                break;
            case "action":
                out.action = projectActionReference(pair.action, actionId);
                break;
            case "target":
                out.target = projectNodeReference(pair.target);
                break;
            case "status":
                out.status = "available";
                break;
            case "meta":
                out.meta = cloneRecord(pair.target.meta);
                break;
            default:
                break;
        }
    }
    return out;
}
function resolveMenuActionId(pair) {
    return resolveActionId(pair.action);
}
function selectListFields(node, include, context, index) {
    const out = {};
    for (const key of include) {
        switch (key) {
            case "id":
                out.id = node.id;
                break;
            case "label":
                out.label = computeNodeLabel(node);
                break;
            case "type": {
                const type = computeNodeType(node);
                if (type !== null)
                    out.type = type;
                break;
            }
            case "value":
                out.value = cloneGraphValue(node.value);
                break;
            case "status":
                out.status = deriveProjectionStatus(node);
                break;
            case "state":
                out.state = cloneRecord(node.state);
                break;
            case "meta":
                out.meta = cloneRecord(node.meta);
                break;
            case "action": {
                const action = buildAvailableActions(context.focus, context)[index] ?? null;
                if (action) {
                    out.action = projectActionReference(action, resolveActionId(action));
                }
                break;
            }
            case "target":
                out.target = projectNodeReference(node);
                break;
            case "event": {
                const edge = getPreferredListEdges(context.graph, context.focus)[index] ?? null;
                if (edge) {
                    out.event = edge.relation;
                }
                break;
            }
            default:
                break;
        }
    }
    return out;
}
function getPreferredListEdges(graph, nodeId) {
    const relationPriority = ["targets", "contains", "unlocks", "can"];
    const outgoingEdges = getOutgoingEdges(graph, nodeId).filter((edge) => edge.kind === "branch");
    for (const relation of relationPriority) {
        const matches = outgoingEdges.filter((edge) => edge.relation === relation);
        if (matches.length > 0) {
            return matches;
        }
    }
    return outgoingEdges;
}
function buildTreeNode(nodeId, include, context, visited) {
    const node = getNode(context.graph, nodeId);
    const out = {};
    visited.add(nodeId);
    for (const key of include) {
        switch (key) {
            case "id":
                out.id = node.id;
                break;
            case "label":
                out.label = computeNodeLabel(node);
                break;
            case "type": {
                const type = computeNodeType(node);
                if (type !== null)
                    out.type = type;
                break;
            }
            case "value":
                out.value = cloneGraphValue(node.value);
                break;
            case "state":
                out.state = cloneRecord(node.state);
                break;
            case "status":
                out.status = deriveProjectionStatus(node) ?? computeNodeStatus(node);
                break;
            case "meta":
                out.meta = cloneRecord(node.meta);
                break;
            case "children":
                out.children = getPreferredTreeEdges(context.graph, nodeId)
                    .filter((edge) => !visited.has(edge.object))
                    .map((edge) => buildTreeNode(edge.object, include, context, visited));
                break;
            default:
                break;
        }
    }
    return out;
}
function buildTimelineEvents(context) {
    const applyEvents = getApplyHistoryEntries(context.graph.history, context.focus);
    return applyEvents.map((entry, index) => normalizeApplyTimelineEvent(entry, context, index));
}
function buildTraceEvents(context) {
    const applyEvents = getApplyHistoryEntries(context.graph.history, context.focus);
    return applyEvents.map((entry, index) => normalizeApplyTraceEvent(entry, context, index));
}
function getApplyHistoryEntries(history, focus) {
    return history.filter((entry) => entry.op === "@apply" && historyEntryTouchesFocus(entry, focus));
}
function normalizeApplyTimelineEvent(entry, context, index) {
    const from = readStringField(entry.payload, ["from"]);
    const action = readStringField(entry.payload, ["action"]);
    const to = readStringField(entry.payload, ["to"]);
    const sourceNode = from && context.graph.nodes.has(from) ? getNode(context.graph, from) : null;
    const targetNode = to && context.graph.nodes.has(to) ? getNode(context.graph, to) : null;
    const actionCandidate = resolveActionCandidateFromEvent(context, from, action);
    const actionNode = actionCandidate?.sourceNode ?? null;
    return {
        id: entry.id || `${context.focus}:timeline:${index}`,
        step: index + 1,
        from: from ?? undefined,
        raw: buildApplyRaw(from, action, to),
        label: sourceNode && action && targetNode
            ? `${computeNodeLabel(sourceNode)} targeted ${computeNodeLabel(targetNode)} with ${computeActionLabel(actionNode, action)}`
            : formatTraceLabel(entry, context, targetNode),
        event: action ?? "apply",
        action: actionCandidate ? projectActionReference(actionCandidate) : action,
        target: targetNode ? projectNodeReference(targetNode) : (to ?? undefined),
        status: targetNode ? computeNodeStatus(targetNode) : "resolved",
        state: targetNode && Object.keys(targetNode.state).length > 0
            ? cloneRecord(targetNode.state)
            : undefined,
        meta: targetNode && Object.keys(targetNode.meta).length > 0
            ? cloneRecord(targetNode.meta)
            : undefined,
    };
}
function normalizeApplyTraceEvent(entry, context, index) {
    const from = readStringField(entry.payload, ["from"]);
    const action = readStringField(entry.payload, ["action"]);
    const to = readStringField(entry.payload, ["to"]);
    const sourceNode = from && context.graph.nodes.has(from) ? getNode(context.graph, from) : null;
    const targetNode = to && context.graph.nodes.has(to) ? getNode(context.graph, to) : null;
    const actionCandidate = resolveActionCandidateFromEvent(context, from, action);
    const actionNode = actionCandidate?.sourceNode ?? null;
    return {
        id: entry.id || `${context.focus}:trace:${index}`,
        step: index + 1,
        from: from ?? undefined,
        to: to ?? undefined,
        raw: buildApplyRaw(from, action, to),
        label: sourceNode && action && targetNode
            ? `${computeNodeLabel(sourceNode)} targeted ${computeNodeLabel(targetNode)} with ${computeActionLabel(actionNode, action)}`
            : formatTraceLabel(entry, context, targetNode),
        event: "@apply",
        action: actionCandidate ? projectActionReference(actionCandidate) : action,
        target: targetNode ? projectNodeReference(targetNode) : (to ?? undefined),
        status: targetNode ? computeNodeStatus(targetNode) : "resolved",
        state: targetNode && Object.keys(targetNode.state).length > 0
            ? cloneRecord(targetNode.state)
            : undefined,
        meta: targetNode && Object.keys(targetNode.meta).length > 0
            ? cloneRecord(targetNode.meta)
            : undefined,
    };
}
function selectEventFields(event, include) {
    const out = {};
    for (const key of include) {
        switch (key) {
            case "id":
                out.id = event.id;
                break;
            case "step":
                if (typeof event.step === "number")
                    out.step = event.step;
                break;
            case "from":
                if (event.from)
                    out.from = event.from;
                break;
            case "to":
                if (event.to)
                    out.to = event.to;
                break;
            case "label":
                out.label = event.label;
                break;
            case "raw":
                if (event.raw)
                    out.raw = event.raw;
                break;
            case "event":
                if (event.event)
                    out.event = event.event;
                break;
            case "target":
                if (event.target)
                    out.target = event.target;
                break;
            case "action":
                if (event.action)
                    out.action = event.action;
                break;
            case "status":
                if (event.status)
                    out.status = event.status;
                break;
            case "state":
                if (event.state)
                    out.state = event.state;
                break;
            case "meta":
                if (event.meta)
                    out.meta = event.meta;
                break;
            case "events":
            case "actions":
            case "children":
            case "relationships":
            case "type":
            case "value":
                break;
        }
    }
    return out;
}
function selectSummaryFields(node, include, context) {
    const out = {};
    for (const key of include) {
        switch (key) {
            case "id":
                out.id = node.id;
                break;
            case "label":
                out.label = computeNodeLabel(node);
                break;
            case "status":
                out.status = deriveProjectionStatus(node);
                break;
            case "value":
                out.value = cloneGraphValue(node.value);
                break;
            case "state":
                out.state = cloneRecord(node.state);
                break;
            case "meta":
                out.meta = cloneRecord(node.meta);
                break;
            case "actions":
                out.actions = buildAvailableActions(node.id, context).map((action) => projectActionReference(action, resolveActionId(action)));
                break;
            case "counts":
                out.counts = buildSummaryCounts(context.graph);
                break;
            default:
                break;
        }
    }
    return out;
}
function buildSummaryCounts(graph) {
    const statusCounts = {};
    for (const node of graph.nodes.values()) {
        const status = deriveProjectionStatus(node);
        if (!status)
            continue;
        const current = statusCounts[status];
        statusCounts[status] = typeof current === "number" ? current + 1 : 1;
    }
    return {
        nodes: graph.nodes.size,
        edges: graph.edges.length,
        statuses: statusCounts,
    };
}
function buildAvailableActions(focus, context) {
    const menuPairs = buildMenuPairs({ ...context, focus });
    const seen = new Set();
    const actions = [];
    for (const pair of menuPairs) {
        const actionId = resolveActionId(pair.action);
        if (seen.has(actionId))
            continue;
        seen.add(actionId);
        actions.push(pair.action);
    }
    return actions;
}
function getPreferredTreeEdges(graph, nodeId) {
    const relationPriority = ["unlocks", "contains", "targets", "can"];
    const outgoingEdges = getOutgoingEdges(graph, nodeId).filter((edge) => edge.kind === "branch");
    const genealogyEdges = outgoingEdges.filter((edge) => isBirthParentEdge(edge) || isSpouseEdge(edge));
    if (genealogyEdges.length > 0) {
        const childEdges = genealogyEdges.filter((edge) => isBirthParentEdge(edge));
        const spouseEdges = genealogyEdges.filter((edge) => isSpouseEdge(edge));
        const seenTargets = new Set();
        return [...childEdges, ...spouseEdges]
            .sort(compareProjectionEdges)
            .filter((edge) => {
            if (seenTargets.has(edge.object)) {
                return false;
            }
            seenTargets.add(edge.object);
            return true;
        });
    }
    for (const relation of relationPriority) {
        const matches = outgoingEdges.filter((edge) => edge.relation === relation);
        if (matches.length > 0) {
            return matches;
        }
    }
    return outgoingEdges;
}
function compareProjectionEdges(a, b) {
    const relationWeight = (edge) => {
        if (isBirthParentEdge(edge))
            return 0;
        if (isSpouseEdge(edge))
            return 1;
        return 2;
    };
    const relationDiff = relationWeight(a) - relationWeight(b);
    if (relationDiff !== 0) {
        return relationDiff;
    }
    return a.object.localeCompare(b.object);
}
// Guard-aware menu pair derivation.
// For each can-reachable action × targets-reachable target pair, the action guard
// (if any) is evaluated with from=focus, to=target. Pairs that fail the guard are
// omitted. Actions with no guard are treated as always available.
function buildMenuPairs(context) {
    const actionCandidates = getOutgoingEdges(context.graph, context.focus)
        .filter((edge) => edge.kind === "branch" && edge.relation === "can")
        .map((edge) => resolveActionCandidate(edge.object, context));
    const targetCandidates = getOutgoingEdges(context.graph, context.focus)
        .filter((edge) => edge.kind === "branch" && edge.relation === "targets")
        .map((edge) => getNode(context.graph, edge.object));
    const pairs = [];
    for (const action of actionCandidates) {
        const runtimeAction = getAction(context.actions, action.bindingName);
        const constrainedTargetIds = getActionSpecificTargetIds(action, context);
        const eligibleTargets = constrainedTargetIds.size > 0
            ? targetCandidates.filter((target) => constrainedTargetIds.has(target.id))
            : targetCandidates;
        for (const target of eligibleTargets) {
            if (runtimeAction?.guard) {
                const scope = { from: context.focus, to: target.id };
                const passes = evaluateActionGuard(runtimeAction.guard, context.graph, scope);
                if (!passes)
                    continue;
            }
            pairs.push({ action, target });
        }
    }
    return pairs;
}
function getActionSpecificTargetIds(action, context) {
    if (!action.sourceNode) {
        return new Set();
    }
    return new Set(getOutgoingEdges(context.graph, action.sourceNode.id)
        .filter((edge) => edge.kind === "branch" && edge.relation === "targets")
        .map((edge) => edge.object));
}
// Action nodes should explicitly declare their runtime binding via value.actionKey
// (or meta.actionKey). Legacy fields and naming heuristics are kept temporarily
// so older scenarios still render, but explicit action metadata is now canonical.
function resolveActionCandidate(nodeId, context) {
    const node = context.graph.nodes.get(nodeId);
    if (!node) {
        return {
            id: nodeId,
            label: titleCase(nodeId),
            bindingName: nodeId,
            sourceNode: null,
        };
    }
    const bindingName = resolveExplicitActionBinding(node, context.actions) ??
        resolveLegacyActionBinding(node, context.actions) ??
        node.id;
    return {
        id: node.id,
        label: computeNodeLabel(node),
        bindingName,
        sourceNode: node,
    };
}
function resolveActionId(action) {
    return action.bindingName;
}
function resolveExplicitActionBinding(node, actions) {
    const valueActionKey = isRecord(node.value) && typeof node.value.actionKey === "string"
        ? node.value.actionKey
        : null;
    if (valueActionKey && actions.has(valueActionKey)) {
        return valueActionKey;
    }
    const metaActionKey = typeof node.meta.actionKey === "string" ? node.meta.actionKey : null;
    if (metaActionKey && actions.has(metaActionKey)) {
        return metaActionKey;
    }
    return null;
}
function resolveLegacyActionBinding(node, actions) {
    const directBinding = actions.has(node.id) ? node.id : null;
    const metaBinding = typeof node.meta.actionBinding === "string" &&
        actions.has(node.meta.actionBinding)
        ? node.meta.actionBinding
        : typeof node.meta.action === "string" && actions.has(node.meta.action)
            ? node.meta.action
            : null;
    const valueBinding = isRecord(node.value) &&
        typeof node.value.binding === "string" &&
        actions.has(node.value.binding)
        ? node.value.binding
        : isRecord(node.value) &&
            typeof node.value.action === "string" &&
            actions.has(node.value.action)
            ? node.value.action
            : null;
    const valueIdBinding = isRecord(node.value) &&
        typeof node.value.id === "string" &&
        actions.has(node.value.id)
        ? node.value.id
        : null;
    const strippedNodeId = node.id.endsWith("Node")
        ? node.id.slice(0, -"Node".length)
        : null;
    const strippedBinding = strippedNodeId !== null && actions.has(strippedNodeId)
        ? strippedNodeId
        : null;
    return (directBinding ??
        metaBinding ??
        valueBinding ??
        valueIdBinding ??
        strippedBinding);
}
function resolveActionCandidateFromEvent(context, from, action) {
    if (!from || !action || !context.graph.nodes.has(from)) {
        return null;
    }
    const candidates = buildAvailableActions(from, { ...context, focus: from });
    return (candidates.find((candidate) => resolveActionId(candidate) === action ||
        candidate.bindingName === action ||
        candidate.id === action) ?? null);
}
function projectNodeReference(node) {
    return {
        id: node.id,
        ...(typeof node.semanticId === "string"
            ? { semanticId: node.semanticId }
            : {}),
        ...(node.contract
            ? {
                contract: {
                    ...(node.contract.in ? { in: [...node.contract.in] } : {}),
                    ...(node.contract.out ? { out: [...node.contract.out] } : {}),
                },
            }
            : {}),
        label: computeNodeLabel(node),
        value: cloneGraphValue(node.value),
        state: cloneRecord(node.state),
        meta: cloneRecord(node.meta),
        status: computeNodeStatus(node),
    };
}
function deriveProjectionStatus(node) {
    if (typeof node.meta.status === "string")
        return node.meta.status;
    if (typeof node.meta.result === "string")
        return node.meta.result;
    if (typeof node.state.status === "string")
        return node.state.status;
    if (node.state.defeated === true)
        return "defeated";
    if (node.state.active === true)
        return "active";
    if (node.state.resolved === true)
        return "resolved";
    if (node.state.ready === true)
        return "ready";
    return null;
}
function projectActionReference(action, actionId = resolveActionId(action)) {
    if (!action.sourceNode) {
        return {
            id: actionId,
            label: action.label,
            value: {},
            state: {},
            meta: {},
        };
    }
    return {
        ...projectNodeReference(action.sourceNode),
        id: actionId,
    };
}
function computeActionLabel(actionNode, fallback) {
    if (actionNode) {
        return computeNodeLabel(actionNode);
    }
    return fallback ?? "Apply";
}
function buildApplyRaw(from, action, to) {
    if (!from || !action || !to) {
        return undefined;
    }
    return `@apply(<${from}.${action}.${to}>)`;
}
function computeNodeLabel(node) {
    if (isRecord(node.value) && typeof node.value.fullName === "string") {
        return node.value.fullName;
    }
    if (isRecord(node.value) && typeof node.value.name === "string") {
        return node.value.name;
    }
    if (typeof node.meta.label === "string") {
        return node.meta.label;
    }
    return node.id;
}
function computeNodeType(node) {
    if (isRecord(node.value) && typeof node.value.type === "string") {
        return node.value.type;
    }
    return null;
}
function compareProjectionNodes(a, b) {
    return Number(a.meta.order ?? 999) - Number(b.meta.order ?? 999);
}
function computeNodeStatus(node) {
    if (typeof node.state.status === "string")
        return node.state.status;
    if (typeof node.meta.status === "string")
        return node.meta.status;
    if (node.state.defeated === true)
        return "defeated";
    if (node.state.active === true)
        return "active";
    if (node.state.resolved === true)
        return "resolved";
    if (node.state.ready === true)
        return "ready";
    return "ready";
}
function historyEntryTouchesFocus(entry, focus) {
    return Object.values(entry.payload).some((value) => value === focus);
}
function readStringField(payload, keys) {
    for (const key of keys) {
        if (typeof payload[key] === "string") {
            return payload[key];
        }
    }
    return undefined;
}
function formatTraceLabel(entry, context, targetNode) {
    const subject = readStringField(entry.payload, ["subject", "from", "nodeId"]);
    const relation = readStringField(entry.payload, ["relation"]);
    const object = readStringField(entry.payload, ["object", "to"]);
    if (relation && object && targetNode) {
        const sourceLabel = subject && context.graph.nodes.has(subject)
            ? computeNodeLabel(getNode(context.graph, subject))
            : context.focus;
        return `${sourceLabel} ${relation} ${computeNodeLabel(targetNode)}`;
    }
    return `${entry.op} ${targetNode ? computeNodeLabel(targetNode) : context.focus}`.trim();
}
function cloneRecord(record) {
    const out = {};
    for (const [key, value] of Object.entries(record)) {
        out[key] = cloneGraphValue(value);
    }
    return out;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exhaustiveNever(value) {
    throw new Error(`Unsupported projection expression: ${JSON.stringify(value)}`);
}
function titleCase(value) {
    if (!value)
        return value;
    return value[0].toUpperCase() + value.slice(1);
}
