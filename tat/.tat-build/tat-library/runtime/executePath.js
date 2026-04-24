export function executePath(graph, query) {
    const from = resolvePathEndpoint(query.from);
    const to = resolvePathEndpoint(query.to);
    if (typeof from !== "string" || typeof to !== "string") {
        return {
            kind: "PathResultSet",
            from,
            to,
            items: [],
        };
    }
    const items = findAllPaths(graph, from, to).map((steps) => ({
        kind: "PathResult",
        steps,
        length: steps.length,
    }));
    return {
        kind: "PathResultSet",
        from,
        to,
        items,
    };
}
function resolvePathEndpoint(value) {
    switch (value.type) {
        case "Identifier":
            return value.name;
        case "StringLiteral":
            return value.value;
        case "NumberLiteral":
            return value.value;
        case "BooleanLiteral":
            return value.value;
        case "PropertyAccess":
            return `${value.object.name}.${value.chain.map((part) => part.name).join(".")}`;
        case "RuntimeGenerateNodeIdExpr":
            return "@runtime.generateNodeId(...)";
        case "RuntimeGenerateValueIdExpr":
            return "@runtime.generateValueId(...)";
        case "RuntimeNextOrderExpr":
            return "@runtime.nextOrder()";
        case "NodeCapture":
            return "<capture>";
        case "WhereExpr":
            return "@where(...)";
        case "ObjectLiteral":
            return "{object}";
        case "ArrayLiteral":
            return "[array]";
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
            return `[${value.type}]`;
        default: {
            const _exhaustive = value;
            throw new Error(`Unsupported path endpoint: ${JSON.stringify(_exhaustive)}`);
        }
    }
}
function findAllPaths(graph, from, to) {
    const results = [];
    const visited = new Set([from]);
    dfs(graph, from, to, visited, [], results);
    return dedupePaths(results);
}
function dfs(graph, current, target, visited, path, results) {
    if (current === target) {
        results.push([...path]);
        return;
    }
    const outgoing = graph.edges.filter((edge) => edge.subject === current);
    for (const edge of outgoing) {
        if (visited.has(edge.object)) {
            continue;
        }
        visited.add(edge.object);
        path.push(edge);
        dfs(graph, edge.object, target, visited, path, results);
        path.pop();
        visited.delete(edge.object);
    }
}
function dedupePaths(paths) {
    const seen = new Set();
    const out = [];
    for (const path of paths) {
        const key = path.map((edge) => edge.id).join("->");
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(path);
    }
    return out;
}
