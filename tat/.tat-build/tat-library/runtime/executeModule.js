import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "../parser/parse.js";
import { tokenize } from "../lexer/tokenize.js";
import { executeProgram, } from "./executeProgram.js";
import { createActionRegistry, registerAction, } from "./actionRegistry.js";
import { cloneGraph, } from "./graph.js";
import { createRuntimeBindings, registerNodeBinding, } from "./evaluateNodeCapture.js";
export function executeTatModule(entryPath) {
    const cache = new Map();
    const loading = new Set();
    const normalizedEntry = normalizePath(entryPath);
    return loadModule(normalizedEntry, cache, loading);
}
function loadModule(filePath, cache, loading) {
    const normalizedPath = normalizePath(filePath);
    const cached = cache.get(normalizedPath);
    if (cached) {
        return cached;
    }
    if (loading.has(normalizedPath)) {
        throw new Error(`Circular module import detected: ${normalizedPath}`);
    }
    if (!existsSync(normalizedPath)) {
        throw new Error(`Unresolved import path: ${normalizedPath}`);
    }
    loading.add(normalizedPath);
    try {
        const source = readFileSync(normalizedPath, "utf8");
        const ast = parse(tokenize(source));
        const initialState = createImportedInitialState(ast, normalizedPath, cache, loading);
        const execution = executeProgram(ast, { initialState });
        const exportedNames = collectExportNames(ast);
        const exports = new Map();
        for (const exportName of exportedNames) {
            const asset = resolveExportAsset(exportName, execution.state);
            if (!asset) {
                throw new Error(`Invalid export reference "${exportName}" in module ${normalizedPath}`);
            }
            exports.set(exportName, asset);
        }
        const loaded = {
            path: normalizedPath,
            source,
            ast,
            state: execution.state,
            exports,
        };
        cache.set(normalizedPath, loaded);
        return loaded;
    }
    finally {
        loading.delete(normalizedPath);
    }
}
function createImportedInitialState(ast, containingFile, cache, loading) {
    const bindings = createRuntimeBindings();
    const actions = createActionRegistry();
    const assetKinds = new Map();
    const graphs = new Map();
    const projectionDefinitions = new Map();
    const projections = new Map();
    const graphInteractions = new Map();
    for (const statement of ast.body) {
        if (statement.type !== "ImportDeclaration") {
            continue;
        }
        const modulePath = resolveImportPath(statement.source.value, containingFile);
        const importedModule = loadModule(modulePath, cache, loading);
        for (const specifier of statement.specifiers) {
            const importedName = specifier.imported.name;
            const localName = specifier.local.name;
            const asset = importedModule.exports.get(importedName);
            if (!asset) {
                throw new Error(`Unresolved imported symbol "${importedName}" from ${modulePath}`);
            }
            assetKinds.set(localName, asset.kind);
            switch (asset.kind) {
                case "node":
                    registerNodeBinding(bindings, localName, cloneGraphNode(asset.value));
                    break;
                case "graph":
                case "fragment":
                    graphs.set(localName, cloneGraph(asset.value));
                    break;
                case "projection":
                    if (isProjectionDefinitionAsset(asset.value)) {
                        projectionDefinitions.set(localName, structuredCloneSafe(asset.value));
                    }
                    else {
                        projections.set(localName, structuredCloneSafe(asset.value));
                    }
                    break;
                case "program":
                    registerAction(actions, {
                        ...asset.value,
                        bindingName: localName,
                    });
                    break;
                case "interaction":
                    graphInteractions.set(localName, structuredCloneSafe(asset.value));
                    break;
                default: {
                    const _exhaustive = asset.kind;
                    throw new Error(`Unsupported imported asset kind: ${_exhaustive}`);
                }
            }
        }
    }
    return {
        bindings,
        actions,
        assetKinds,
        graphs,
        projectionDefinitions,
        projections,
        graphInteractions,
        interactionHistory: [],
    };
}
function collectExportNames(ast) {
    const names = [];
    for (const statement of ast.body) {
        if (statement.type !== "ExportDeclaration") {
            continue;
        }
        for (const specifier of statement.specifiers) {
            names.push(specifier.local.name);
        }
    }
    return names;
}
function resolveExportAsset(name, state) {
    const kind = state.assetKinds.get(name);
    if (!kind) {
        return null;
    }
    switch (kind) {
        case "node": {
            const node = state.bindings.nodes.get(name);
            if (!node)
                return null;
            return { kind, value: cloneGraphNode(node) };
        }
        case "graph":
        case "fragment": {
            const graph = state.graphs.get(name);
            if (!graph)
                return null;
            return { kind, value: cloneGraph(graph) };
        }
        case "projection": {
            const projectionDefinition = state.projectionDefinitions.get(name);
            if (projectionDefinition) {
                return { kind, value: structuredCloneSafe(projectionDefinition) };
            }
            const projection = state.projections.get(name);
            if (projection === undefined)
                return null;
            return { kind, value: structuredCloneSafe(projection) };
        }
        case "program": {
            const action = state.actions.get(name);
            if (!action)
                return null;
            return { kind, value: structuredCloneSafe(action) };
        }
        case "interaction": {
            const interaction = state.graphInteractions.get(name);
            if (!interaction)
                return null;
            return { kind, value: structuredCloneSafe(interaction) };
        }
        default: {
            const _exhaustive = kind;
            throw new Error(`Unsupported export kind: ${_exhaustive}`);
        }
    }
}
function resolveImportPath(specifier, containingFile) {
    const fromDir = path.dirname(containingFile);
    const rawPath = path.resolve(fromDir, specifier);
    if (existsSync(rawPath)) {
        return normalizePath(rawPath);
    }
    const withTat = `${rawPath}.tat`;
    if (existsSync(withTat)) {
        return normalizePath(withTat);
    }
    throw new Error(`Unresolved import path: ${specifier}`);
}
function normalizePath(value) {
    return path.resolve(value);
}
function cloneGraphNode(node) {
    return {
        id: node.id,
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
function structuredCloneSafe(value) {
    if (typeof globalThis.structuredClone === "function") {
        return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}
function isProjectionDefinitionAsset(value) {
    return !!value && typeof value === "object" && value.type === "ProjectionDef";
}
