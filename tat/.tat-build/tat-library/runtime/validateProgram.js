import { PROJECT_FORMAT_RULES, isProjectFormat, isProjectIncludeKey, } from "./projection.js";
export function validateProgram(program) {
    const state = {
        valueBindings: new Set(),
        nodeBindings: new Set(),
        operatorBindings: new Set(),
        actionBindings: new Set(),
        graphBindings: new Set(),
        hasSeed: false,
        terminalProjectReached: false,
        issues: [],
    };
    for (const statement of program.body) {
        validateStatement(statement, state);
    }
    return state.issues;
}
function validateStatement(statement, state) {
    switch (statement.type) {
        case "ImportDeclaration":
        case "ExportDeclaration":
            return;
        case "BindStatement":
            validateStatementAfterTerminalProject(statement.type, state);
            return;
        case "ValueBinding":
            validateValueBinding(statement, state);
            return;
        case "OperatorBinding":
            validateOperatorBinding(statement, state);
            return;
        case "ProjectionDef":
            validateProjectionDefinition(statement, state);
            return;
        case "SeedBlock":
            validateSeedBlock(statement, state);
            return;
        case "GraphPipeline":
            validateGraphPipeline(statement, state);
            return;
        case "GraphProjection":
            validateGraphProjection(statement, state);
            return;
        case "WhenExpr":
            validateWhenExpr(statement, state);
            return;
        case "GraphInteractionDefinition":
            validateGraphInteractionDefinition(statement, state);
            return;
        case "QueryStatement":
            validateQueryStatement(statement, state);
            return;
        default:
            return;
    }
}
function validateValueBinding(statement, state) {
    const name = statement.name.name;
    if (isTopLevelNameTaken(name, state)) {
        pushIssue(state, "error", statement.name.span, `Duplicate binding "${name}"`);
        return;
    }
    state.valueBindings.add(name);
    if (statement.value.type === "NodeCapture") {
        state.nodeBindings.add(name);
        validateNodeCapture(statement, state);
    }
}
function validateOperatorBinding(statement, state) {
    const name = statement.name.name;
    if (isTopLevelNameTaken(name, state)) {
        pushIssue(state, "error", statement.name.span, `Duplicate binding "${name}"`);
        return;
    }
    state.operatorBindings.add(name);
    if (statement.value.type === "ActionExpr") {
        state.actionBindings.add(name);
        validateAction(statement.value, state);
        return;
    }
    if (statement.value.type === "ProjectExpr") {
        validateProjectExpr(statement.value, state);
        return;
    }
    if (statement.value.type === "ReduceExpr") {
        validateReduceExpr(statement.value, state);
    }
}
function validateProjectionDefinition(statement, state) {
    const name = statement.name.name;
    if (isTopLevelNameTaken(name, state)) {
        pushIssue(state, "error", statement.name.span, `Duplicate binding "${name}"`);
        return;
    }
    state.valueBindings.add(name);
    if (statement.focus) {
        validateProjectionExpression(statement.focus, state);
    }
    for (const property of statement.fields.properties) {
        validateProjectionExpression(property.value, state);
    }
}
function validateSeedBlock(statement, state) {
    if (state.hasSeed) {
        pushIssue(state, "error", statement.span, "Multiple @seed blocks are not allowed");
    }
    state.hasSeed = true;
}
function validateGraphPipeline(statement, state) {
    const name = statement.name.name;
    if (isTopLevelNameTaken(name, state)) {
        pushIssue(state, "error", statement.name.span, `Duplicate graph name "${name}"`);
        return;
    }
    state.graphBindings.add(name);
    if (statement.projection) {
        validateTerminalGraphExpr(statement.projection, state);
        state.terminalProjectReached = true;
    }
    for (const step of statement.mutations) {
        validateGraphPipelineStep(step, state);
    }
}
function validateGraphProjection(statement, state) {
    const name = statement.name.name;
    if (isTopLevelNameTaken(name, state)) {
        pushIssue(state, "error", statement.name.span, `Duplicate binding "${name}"`);
        return;
    }
    state.valueBindings.add(name);
    if (statement.projection.type === "ProjectExpr" &&
        !state.graphBindings.has(statement.source.name)) {
        pushIssue(state, "error", statement.source.span, `@project source "${statement.source.name}" is not a known graph binding`);
    }
    validateTerminalGraphExpr(statement.projection, state);
}
function validateTerminalGraphExpr(projection, state) {
    if (!projection) {
        return;
    }
    if (projection.type === "ProjectExpr") {
        validateProjectExpr(projection, state);
        return;
    }
    validateReduceExpr(projection, state);
}
function validateProjectExpr(projection, state) {
    if (projection.projectionName) {
        for (const arg of projection.args) {
            if (arg.key?.name === "focus") {
                validateProjectionExpression(arg.value, state);
            }
            else {
                validateProjectionExpression(arg.value, state);
            }
        }
        return;
    }
    const formatArg = projection.args.find((arg) => arg.key && arg.key.name === "format");
    const focusArg = projection.args.find((arg) => arg.key && arg.key.name === "focus");
    const includeArg = projection.args.find((arg) => arg.key && arg.key.name === "include");
    if (!formatArg) {
        pushIssue(state, "error", projection.span, "@project requires a format field");
        return;
    }
    if (formatArg.value.type !== "StringLiteral") {
        pushIssue(state, "error", formatArg.value.span, "@project format must be a string literal");
        return;
    }
    const formatValue = formatArg.value.value;
    if (!isProjectFormat(formatValue)) {
        pushIssue(state, "error", formatArg.value.span, `Invalid @project format "${formatValue}"`);
        return;
    }
    if (projection.syntax === "block" && !focusArg) {
        pushIssue(state, "error", projection.span, "@project requires a focus field");
    }
    if (projection.syntax === "block" && !includeArg) {
        pushIssue(state, "error", projection.span, "@project requires an include field");
    }
    if (focusArg) {
        validateProjectFocus(focusArg.value, state);
    }
    if (includeArg) {
        validateProjectInclude(formatValue, includeArg.value, state);
    }
}
function validateReduceExpr(projection, state) {
    const outputArg = projection.args.find((arg) => arg.key && arg.key.name === "output");
    if (outputArg && outputArg.value.type !== "StringLiteral") {
        pushIssue(state, "error", outputArg.value.span, "@reduce output must be a string literal when provided");
    }
}
function validateProjectFocus(value, state) {
    validateProjectionExpression(value, state);
}
function validateProjectInclude(format, value, state) {
    if (value.type !== "ArrayLiteral") {
        pushIssue(state, "error", value.span, "@project include must be an array literal");
        return;
    }
    const rule = PROJECT_FORMAT_RULES[format];
    const allowed = new Set([...rule.core, ...rule.allowed]);
    const seen = new Set();
    for (const element of value.elements) {
        if (element.type !== "Identifier" && element.type !== "StringLiteral") {
            pushIssue(state, "error", element.span, "@project include entries must be identifiers or string literals");
            continue;
        }
        const includeKey = element.type === "Identifier" ? element.name : element.value;
        if (!isProjectIncludeKey(includeKey)) {
            pushIssue(state, "error", element.span, `Invalid @project include key "${includeKey}"`);
            continue;
        }
        if (!allowed.has(includeKey)) {
            pushIssue(state, "error", element.span, `@project format "${format}" does not allow include key "${includeKey}"`);
            continue;
        }
        seen.add(includeKey);
    }
    for (const required of rule.core) {
        if (!seen.has(required)) {
            pushIssue(state, "error", value.span, `@project format "${format}" requires include key "${required}"`);
        }
    }
}
function validateGraphInteractionDefinition(statement, state) {
    if (statement.name) {
        const name = statement.name.name;
        if (isTopLevelNameTaken(name, state)) {
            pushIssue(state, "error", statement.name.span, `Duplicate binding "${name}"`);
            return;
        }
        state.operatorBindings.add(name);
    }
    for (const op of statement.effect.ops) {
        if (op.type === "EffectDeriveStateOp" || op.type === "EffectDeriveMetaOp") {
            validateDeriveExpr(op.expression, state);
        }
    }
}
function validateQueryStatement(statement, state) {
    if (statement.expr.type === "GraphQueryExpr") {
        validateGraphQueryExpr(statement.expr, state);
    }
}
function validateWhenExpr(statement, state) {
    if (!statement.query) {
        pushIssue(state, "error", statement.span, "@when requires a query");
    }
    else {
        validateGraphControlExpr(statement.query, state, "@when query");
    }
    if (!statement.pipeline.length) {
        pushIssue(state, "error", statement.span, "@when requires a pipeline");
    }
    for (const step of statement.pipeline) {
        validateGraphPipelineStep(step, state);
    }
}
function validateAction(action, state) {
    if (!action.pipeline || action.pipeline.length === 0) {
        pushIssue(state, "error", action.span, "@action must define at least one pipeline step");
    }
    if (action.guard) {
        validateActionGuard(action.guard, state);
    }
    if (action.project) {
        validateActionExpression(action.project, state);
    }
    for (const step of action.pipeline) {
        validateActionPipelineStep(step, state);
    }
}
function validateActionGuard(expr, state) {
    if (expr.type === "GraphQueryExpr") {
        validateGraphQueryExpr(expr, state);
        return;
    }
    validateActionExpression(expr, state);
}
function validateNodeCapture(statement, state) {
    const value = statement.value;
    if (value.type !== "NodeCapture")
        return;
    const shape = value.shape;
    if (shape.type === "ObjectLiteral") {
        validateNodeCaptureObjectLiteral(shape, state);
    }
    if (shape.type !== "TraversalExpr")
        return;
    for (const segment of shape.segments) {
        const operator = segment.type === "ActionSegment"
            ? segment.operator
            : segment.segment.operator;
        ensureKnownAction(state, operator.name, operator.span);
    }
}
function validateNodeCaptureObjectLiteral(node, state) {
    const semanticIdProperty = node.properties.find((property) => property.key === "semanticId");
    if (semanticIdProperty && semanticIdProperty.value.type !== "StringLiteral") {
        pushIssue(state, "error", semanticIdProperty.value.span, "Node capture semanticId must be a string literal");
    }
    const contractProperty = node.properties.find((property) => property.key === "contract");
    if (!contractProperty) {
        return;
    }
    if (contractProperty.value.type !== "ObjectLiteral") {
        pushIssue(state, "error", contractProperty.value.span, "Node capture contract must be an object literal");
        return;
    }
    for (const property of contractProperty.value.properties) {
        if (property.key !== "in" && property.key !== "out") {
            pushIssue(state, "error", property.value.span, `Node capture contract only supports "in" and "out"`);
            continue;
        }
        if (property.value.type !== "ArrayLiteral") {
            pushIssue(state, "error", property.value.span, `Node capture contract.${property.key} must be an array of strings`);
            continue;
        }
        for (const element of property.value.elements) {
            if (element.type !== "StringLiteral") {
                pushIssue(state, "error", element.span, `Node capture contract.${property.key} entries must be string literals`);
            }
        }
    }
}
function validateMutation(mutation, state) {
    switch (mutation.type) {
        case "RuntimeAddNodeExpr":
            validateIdentifier(mutation.node.name, mutation.node.span, state);
            validateActionExpression(mutation.value, state);
            validateActionExpression(mutation.state, state);
            validateActionExpression(mutation.meta, state);
            return;
        case "RuntimeUpdateNodeValueExpr":
            validateIdentifier(mutation.node.name, mutation.node.span, state);
            validateActionExpression(mutation.patch, state);
            return;
        case "RuntimeDeleteNodeExpr":
            validateIdentifier(mutation.node.name, mutation.node.span, state);
            return;
        case "GraftBranchExpr":
        case "PruneBranchExpr":
            validateIdentifier(mutation.subject.name, mutation.subject.span, state);
            validateIdentifier(mutation.object.name, mutation.object.span, state);
            return;
        case "GraftProgressExpr":
            validateIdentifier(mutation.from.name, mutation.from.span, state);
            validateIdentifier(mutation.to.name, mutation.to.span, state);
            return;
        case "GraftStateExpr":
        case "GraftMetaExpr":
        case "PruneStateExpr":
        case "PruneMetaExpr":
            validateIdentifier(mutation.node.name, mutation.node.span, state);
            return;
        case "PruneNodesExpr":
        case "PruneEdgesExpr":
            return;
        default:
            return;
    }
}
function validateGraphPipelineStep(step, state) {
    if (step.type === "IfExpr") {
        validateIfExpr(step, state);
        return;
    }
    if (step.type === "WhenExpr") {
        validateWhenExpr(step, state);
        return;
    }
    validateMutation(step, state);
}
function validateActionPipelineStep(step, state) {
    if (step.type === "LoopExpr") {
        validateLoopExpr(step, state);
        return;
    }
    if (step.type === "WhenExpr") {
        pushIssue(state, "error", step.span, "@when is not supported inside @action pipelines");
        return;
    }
    validateGraphPipelineStep(step, state);
}
function validateIfExpr(expr, state) {
    if (!expr.when) {
        pushIssue(state, "error", expr.span, "@if requires a when clause");
    }
    else {
        validateGraphControlExpr(expr.when, state, "@if when");
    }
    if (!expr.then.length) {
        pushIssue(state, "error", expr.span, "@if requires a then pipeline");
    }
    for (const step of expr.then) {
        validateGraphPipelineStep(step, state);
    }
    for (const step of expr.else ?? []) {
        validateGraphPipelineStep(step, state);
    }
}
function validateLoopExpr(loop, state) {
    if (!loop.pipeline.length) {
        pushIssue(state, "error", loop.span, "@loop requires a pipeline section");
    }
    if (!loop.until && !loop.count) {
        pushIssue(state, "error", loop.span, "@loop requires at least one of count or until");
    }
    if (loop.until) {
        validateGraphQueryExpr(loop.until, state);
    }
    if (loop.count) {
        validateLoopCountExpr(loop.count, state);
    }
    for (const step of loop.pipeline) {
        validateActionPipelineStep(step, state);
    }
}
function validateLoopCountExpr(expr, state) {
    if (expr.type === "NumberLiteral") {
        if (!Number.isInteger(expr.value)) {
            pushIssue(state, "error", expr.span, "@loop count must be an integer");
        }
        if (expr.value < 0) {
            pushIssue(state, "error", expr.span, "@loop count cannot be negative");
        }
        return;
    }
    if (expr.type === "DeriveStateExpr") {
        validateDeriveStateExpr(expr, state);
        return;
    }
    if (expr.type === "DeriveMetaExpr") {
        validateDeriveMetaExpr(expr, state);
        return;
    }
    if (expr.type === "DeriveEdgeCountExpr") {
        validateDeriveEdgeCountExpr(expr, state);
        return;
    }
    validateDeriveExpr(expr, state);
}
function validateGraphControlExpr(expr, state, _label) {
    if (expr.type === "GraphQueryExpr") {
        validateGraphQueryExpr(expr, state);
        return;
    }
    validateActionExpression(expr, state);
}
function validateGraphQueryExpr(expr, state) {
    const usesEdgeMode = expr.subject !== null || expr.relation !== null || expr.object !== null;
    const usesStateMode = expr.state !== null;
    const usesMetaMode = expr.meta !== null;
    const modeCount = Number(usesEdgeMode) + Number(usesStateMode) + Number(usesMetaMode);
    if (modeCount !== 1) {
        pushIssue(state, "error", expr.span, "@query must use exactly one mode: edge existence, state query, or meta query");
    }
    if (usesEdgeMode) {
        if (!expr.subject || !expr.relation || !expr.object) {
            pushIssue(state, "error", expr.span, "@query edge existence requires subject, relation, and object");
        }
        if (expr.equals) {
            pushIssue(state, "error", expr.equals.span, '@query edge existence does not support an "equals" field');
        }
        if (expr.subject)
            validateIdentifier(expr.subject.name, expr.subject.span, state);
        if (expr.object)
            validateIdentifier(expr.object.name, expr.object.span, state);
    }
    if (usesStateMode || usesMetaMode) {
        if (!expr.node) {
            pushIssue(state, "error", expr.span, '@query state/meta mode requires a "node" field');
        }
        else {
            validateIdentifier(expr.node.name, expr.node.span, state);
        }
    }
    if (usesStateMode) {
        if (!expr.state) {
            pushIssue(state, "error", expr.span, '@query state mode requires a "state" field');
        }
        if (expr.meta) {
            pushIssue(state, "error", expr.span, '@query cannot combine "state" and "meta" fields');
        }
    }
    if (usesMetaMode && !expr.meta) {
        pushIssue(state, "error", expr.span, '@query meta mode requires a "meta" field');
    }
    if (expr.equals) {
        validateActionExpression(expr.equals, state);
    }
}
function validateDeriveStateExpr(expr, state) {
    if (!expr.node) {
        pushIssue(state, "error", expr.span, "@derive.state requires a node field");
    }
    else {
        validateIdentifier(expr.node.name, expr.node.span, state);
    }
    if (!expr.key) {
        pushIssue(state, "error", expr.span, "@derive.state requires a key field");
    }
}
function validateDeriveMetaExpr(expr, state) {
    if (!expr.node) {
        pushIssue(state, "error", expr.span, "@derive.meta requires a node field");
    }
    else {
        validateIdentifier(expr.node.name, expr.node.span, state);
    }
    if (!expr.key) {
        pushIssue(state, "error", expr.span, "@derive.meta requires a key field");
    }
}
function validateDeriveCountExpr(expr, state) {
    if (expr.from) {
        validateDeriveAggregateSourceExpr(expr.from, state);
        return;
    }
    if (!expr.nodes) {
        pushIssue(state, "error", expr.span, "@derive.count requires a nodes field or from field");
        return;
    }
    validateDerivePathExpr(expr.nodes, state);
}
function validateDeriveEdgeCountExpr(expr, state) {
    if (!expr.node) {
        pushIssue(state, "error", expr.span, "@derive.edgeCount requires a node field");
    }
    else {
        validateIdentifier(expr.node.name, expr.node.span, state);
    }
    if (!expr.relation) {
        pushIssue(state, "error", expr.span, "@derive.edgeCount requires a relation field");
    }
    if (!expr.direction) {
        pushIssue(state, "error", expr.span, "@derive.edgeCount requires a direction field");
    }
    else if (expr.direction.value !== "incoming" && expr.direction.value !== "outgoing") {
        pushIssue(state, "error", expr.direction.span, '@derive.edgeCount direction must be "incoming" or "outgoing"');
    }
    if (expr.where) {
        validateGraphControlExpr(expr.where, state, "@derive.edgeCount where");
    }
}
function validateDerivePathExpr(expr, state) {
    if (!expr.node) {
        pushIssue(state, "error", expr.span, "@derive.path requires a node field");
    }
    else {
        validateIdentifier(expr.node.name, expr.node.span, state);
    }
    if (!expr.relation) {
        pushIssue(state, "error", expr.span, "@derive.path requires a relation field");
    }
    else if (expr.relation.type === "ArrayLiteral") {
        validateDerivePathRelationArray(expr.relation, state);
    }
    if (!expr.direction) {
        pushIssue(state, "error", expr.span, "@derive.path requires a direction field");
    }
    else if (expr.direction.value !== "incoming" &&
        expr.direction.value !== "outgoing" &&
        expr.direction.value !== "both") {
        pushIssue(state, "error", expr.direction.span, '@derive.path direction must be "incoming", "outgoing", or "both"');
    }
    if (!expr.depth) {
        pushIssue(state, "error", expr.span, "@derive.path requires a depth field");
    }
    else if (!Number.isInteger(expr.depth.value) || expr.depth.value < 1) {
        pushIssue(state, "error", expr.depth.span, "@derive.path depth must be an integer >= 1");
    }
    if (expr.where) {
        validateGraphControlExpr(expr.where, state, "@derive.path where");
    }
}
function validateDeriveExistsExpr(expr, state) {
    if (!expr.path) {
        pushIssue(state, "error", expr.span, "@derive.exists requires a path field");
        return;
    }
    if (expr.path.type === "Identifier") {
        validateIdentifier(expr.path.name, expr.path.span, state);
        return;
    }
    validateDerivePathExpr(expr.path, state);
}
function validateDeriveCollectExpr(expr, state) {
    if (!expr.path) {
        pushIssue(state, "error", expr.span, "@derive.collect requires a path field");
    }
    else {
        validateDerivePathExpr(expr.path, state);
    }
    if (!expr.layer) {
        pushIssue(state, "error", expr.span, "@derive.collect requires a layer field");
    }
    else if (expr.layer.value !== "value" &&
        expr.layer.value !== "state" &&
        expr.layer.value !== "meta") {
        pushIssue(state, "error", expr.layer.span, '@derive.collect layer must be "value", "state", or "meta"');
    }
    if (!expr.key) {
        pushIssue(state, "error", expr.span, "@derive.collect requires a key field");
    }
}
function validateDeriveSumExpr(expr, state) {
    if (expr.from || expr.field) {
        if (!expr.from) {
            pushIssue(state, "error", expr.span, "@derive.sum requires a from field");
        }
        else {
            validateDeriveAggregateSourceExpr(expr.from, state);
        }
        if (!expr.field) {
            pushIssue(state, "error", expr.span, "@derive.sum requires a field field");
        }
        return;
    }
    if (!expr.collect) {
        pushIssue(state, "error", expr.span, "@derive.sum requires a collect field or from/field");
        return;
    }
    validateDeriveCollectExpr(expr.collect, state);
}
function validateDeriveMinExpr(expr, state) {
    validateFieldAggregateExpr(expr.name, expr.from, expr.field, expr.span, state);
}
function validateDeriveMaxExpr(expr, state) {
    validateFieldAggregateExpr(expr.name, expr.from, expr.field, expr.span, state);
}
function validateDeriveAvgExpr(expr, state) {
    validateFieldAggregateExpr(expr.name, expr.from, expr.field, expr.span, state);
}
function validateDeriveAbsExpr(expr, state) {
    if (!expr.value) {
        pushIssue(state, "error", expr.span, "@derive.abs requires a value expression");
        return;
    }
    validateDeriveExpr(expr.value, state);
}
function validateFieldAggregateExpr(name, from, field, span, state) {
    if (!from) {
        pushIssue(state, "error", span, `${name} requires a from field`);
    }
    else {
        validateDeriveAggregateSourceExpr(from, state);
    }
    if (!field) {
        pushIssue(state, "error", span, `${name} requires a field field`);
    }
}
function validateDeriveAggregateSourceExpr(expr, state) {
    if (expr.type === "DerivePathExpr") {
        validateDerivePathExpr(expr, state);
        return;
    }
    if (expr.type === "Identifier") {
        validateIdentifier(expr.name, expr.span, state);
        return;
    }
    validateAggregateQueryExpr(expr, state);
}
function validateAggregateQueryExpr(expr, state) {
    if (!expr.typeName) {
        pushIssue(state, "error", expr.span, '@query(...) aggregate source requires a type field');
    }
}
function validateDerivePathRelationArray(relation, state) {
    for (const element of relation.elements) {
        if (element.type !== "StringLiteral") {
            pushIssue(state, "error", element.span, "@derive.path relation arrays must contain only string literals");
        }
    }
}
function validateDeriveExpr(expr, state) {
    switch (expr.type) {
        case "DeriveStateExpr":
            validateDeriveStateExpr(expr, state);
            return;
        case "DeriveMetaExpr":
            validateDeriveMetaExpr(expr, state);
            return;
        case "DeriveCountExpr":
            validateDeriveCountExpr(expr, state);
            return;
        case "DeriveEdgeCountExpr":
            validateDeriveEdgeCountExpr(expr, state);
            return;
        case "DeriveExistsExpr":
            validateDeriveExistsExpr(expr, state);
            return;
        case "DerivePathExpr":
            validateDerivePathExpr(expr, state);
            return;
        case "DeriveCollectExpr":
            validateDeriveCollectExpr(expr, state);
            return;
        case "DeriveSumExpr":
            validateDeriveSumExpr(expr, state);
            return;
        case "DeriveMinExpr":
            validateDeriveMinExpr(expr, state);
            return;
        case "DeriveMaxExpr":
            validateDeriveMaxExpr(expr, state);
            return;
        case "DeriveAvgExpr":
            validateDeriveAvgExpr(expr, state);
            return;
        case "DeriveAbsExpr":
            validateDeriveAbsExpr(expr, state);
            return;
        case "DeriveBinaryExpr":
            validateDeriveExpr(expr.left, state);
            validateDeriveExpr(expr.right, state);
            return;
        default:
            return;
    }
}
function validateActionExpression(expr, state) {
    if (!expr || typeof expr !== "object")
        return;
    switch (expr.type) {
        case "Identifier":
            validateIdentifier(expr.name, expr.span, state);
            return;
        case "PropertyAccess":
            validateIdentifier(expr.object.name, expr.object.span, state);
            return;
        case "BinaryBooleanExpr":
            validateActionExpression(expr.left, state);
            validateActionExpression(expr.right, state);
            return;
        case "UnaryBooleanExpr":
            validateActionExpression(expr.argument, state);
            return;
        case "ComparisonExpr":
            validateActionExpression(expr.left, state);
            validateActionExpression(expr.right, state);
            return;
        case "DeriveStateExpr":
            validateDeriveStateExpr(expr, state);
            return;
        case "DeriveMetaExpr":
            validateDeriveMetaExpr(expr, state);
            return;
        case "DeriveCountExpr":
            validateDeriveCountExpr(expr, state);
            return;
        case "DeriveEdgeCountExpr":
            validateDeriveEdgeCountExpr(expr, state);
            return;
        case "DeriveExistsExpr":
            validateDeriveExistsExpr(expr, state);
            return;
        case "DerivePathExpr":
            validateDerivePathExpr(expr, state);
            return;
        case "DeriveCollectExpr":
            validateDeriveCollectExpr(expr, state);
            return;
        case "DeriveSumExpr":
            validateDeriveSumExpr(expr, state);
            return;
        case "DeriveMinExpr":
            validateDeriveMinExpr(expr, state);
            return;
        case "DeriveMaxExpr":
            validateDeriveMaxExpr(expr, state);
            return;
        case "DeriveAvgExpr":
            validateDeriveAvgExpr(expr, state);
            return;
        case "DeriveAbsExpr":
            validateDeriveAbsExpr(expr, state);
            return;
        case "DeriveBinaryExpr":
            validateDeriveExpr(expr, state);
            return;
        case "ObjectLiteral":
            for (const prop of expr.properties) {
                validateActionExpression(prop.value, state);
            }
            return;
        case "ArrayLiteral":
            for (const el of expr.elements) {
                validateActionExpression(el, state);
            }
            return;
        default:
            return;
    }
}
function validateProjectionExpression(expr, state) {
    if (!expr || typeof expr !== "object")
        return;
    switch (expr.type) {
        case "Identifier":
            validateIdentifier(expr.name, expr.span, state);
            return;
        case "PropertyAccess":
            validateIdentifier(expr.object.name, expr.object.span, state);
            return;
        case "IfValueExpr":
            if (expr.when) {
                validateGraphControlExpr(expr.when, state, "@if when");
            }
            if (expr.then) {
                validateProjectionExpression(expr.then, state);
            }
            if (expr.else) {
                validateProjectionExpression(expr.else, state);
            }
            return;
        case "DirectiveCallExpr":
            for (const arg of expr.args) {
                validateProjectionExpression(arg.value, state);
            }
            return;
        case "ObjectLiteral":
            for (const prop of expr.properties) {
                validateProjectionExpression(prop.value, state);
            }
            return;
        case "ArrayLiteral":
            for (const element of expr.elements) {
                validateProjectionExpression(element, state);
            }
            return;
        case "StringLiteral":
        case "NumberLiteral":
        case "BooleanLiteral":
        case "RuntimeGenerateNodeIdExpr":
        case "RuntimeGenerateValueIdExpr":
        case "RuntimeNextOrderExpr":
        case "NodeCapture":
            return;
        case "WhereExpr":
            validateGraphControlExpr(expr.expression, state, "@where");
            return;
        case "DeriveStateExpr":
            validateDeriveStateExpr(expr, state);
            return;
        case "DeriveMetaExpr":
            validateDeriveMetaExpr(expr, state);
            return;
        case "DeriveCountExpr":
            validateDeriveCountExpr(expr, state);
            return;
        case "DeriveEdgeCountExpr":
            validateDeriveEdgeCountExpr(expr, state);
            return;
        case "DeriveExistsExpr":
            validateDeriveExistsExpr(expr, state);
            return;
        case "DerivePathExpr":
            validateDerivePathExpr(expr, state);
            return;
        case "DeriveCollectExpr":
            validateDeriveCollectExpr(expr, state);
            return;
        case "DeriveSumExpr":
            validateDeriveSumExpr(expr, state);
            return;
        case "DeriveMinExpr":
            validateDeriveMinExpr(expr, state);
            return;
        case "DeriveMaxExpr":
            validateDeriveMaxExpr(expr, state);
            return;
        case "DeriveAvgExpr":
            validateDeriveAvgExpr(expr, state);
            return;
        case "DeriveAbsExpr":
            validateDeriveAbsExpr(expr, state);
            return;
        case "DeriveBinaryExpr":
            validateDeriveExpr(expr, state);
            return;
        default:
            return;
    }
}
function validateIdentifier(name, span, state) {
    if (name === "from" || name === "to" || name === "payload") {
        return;
    }
    if (state.nodeBindings.has(name) ||
        state.valueBindings.has(name) ||
        state.actionBindings.has(name)) {
        return;
    }
    pushIssue(state, "warning", span, `Unknown identifier "${name}" inside @action`);
}
function ensureKnownAction(state, name, span) {
    if (!state.actionBindings.has(name)) {
        pushIssue(state, "error", span, `Traversal operator "${name}" is not a declared action`);
    }
}
function isTopLevelNameTaken(name, state) {
    return (state.valueBindings.has(name) ||
        state.operatorBindings.has(name) ||
        state.graphBindings.has(name));
}
function pushIssue(state, severity, span, message) {
    state.issues.push({
        severity,
        message,
        span,
    });
}
function validateStatementAfterTerminalProject(statementType, state) {
    if (!state.terminalProjectReached) {
        return;
    }
    pushIssue(state, "error", undefined, `${statementType} cannot appear after terminal @project(...)`);
}
