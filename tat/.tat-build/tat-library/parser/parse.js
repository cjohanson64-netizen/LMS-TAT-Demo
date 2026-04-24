export class ParseError extends Error {
    token;
    constructor(message, token) {
        super(`${message} at ${token.line}:${token.column}`);
        this.token = token;
        this.name = "ParseError";
    }
}
export function parse(tokens) {
    const parser = new Parser(tokens);
    return parser.parseProgram();
}
class Parser {
    tokens;
    current = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    parseProgram() {
        const body = [];
        const start = this.peek();
        this.skipNewlines();
        while (!this.isAtEnd()) {
            body.push(this.parseStatement());
            this.skipNewlines();
        }
        return this.node("Program", {
            body,
        }, start);
    }
    parseStatement() {
        this.skipNewlines();
        if (this.checkTypeIdentifierValue("import")) {
            return this.parseImportDeclaration();
        }
        if (this.checkTypeIdentifierValue("export")) {
            return this.parseExportDeclaration();
        }
        if (this.check("KEYWORD", "@seed")) {
            return this.parseSeedBlock();
        }
        if (this.check("KEYWORD", "@projection")) {
            return this.parseProjectionDefinition();
        }
        if (this.check("KEYWORD", "@graph")) {
            return this.parseGraphInteractionDefinition(null);
        }
        if (this.check("KEYWORD", "@when")) {
            return this.parseWhenExpr();
        }
        if (this.isGraphPipelineStart()) {
            return this.parseGraphPipeline();
        }
        if (this.isSystemRelationStart()) {
            return this.parseSystemRelation();
        }
        if (this.check("KEYWORD", "@query") ||
            this.check("KEYWORD", "@match") ||
            this.check("KEYWORD", "@path") ||
            this.check("KEYWORD", "@why") ||
            this.check("KEYWORD", "@how") ||
            this.check("KEYWORD", "@where")) {
            const expr = this.parseQueryExpr();
            return this.node("QueryStatement", { expr }, this.previousOrPeek());
        }
        if (this.isBindStatementStart()) {
            return this.parseBindStatement();
        }
        if (this.checkType("IDENT")) {
            return this.parseBindingLikeStatement();
        }
        throw this.error(this.peek(), `Unexpected token "${this.peek().value}"`);
    }
    parseImportDeclaration() {
        const start = this.expectIdentifierValue("import");
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        const specifiers = [];
        while (!this.checkType("RBRACE")) {
            const imported = this.parseIdentifier();
            let local = imported;
            if (this.checkTypeIdentifierValue("as")) {
                this.expectIdentifierValue("as");
                local = this.parseIdentifier();
            }
            specifiers.push(this.node("ImportSpecifier", { imported, local }, identToToken(imported)));
            this.skipNewlines();
            if (this.match("COMMA")) {
                this.skipNewlines();
                continue;
            }
            break;
        }
        this.skipNewlines();
        this.expect("RBRACE");
        this.skipNewlines();
        this.expectIdentifierValue("from");
        this.skipNewlines();
        const source = this.parseStringLiteral();
        return this.node("ImportDeclaration", {
            specifiers,
            source,
        }, start);
    }
    parseExportDeclaration() {
        const start = this.expectIdentifierValue("export");
        this.skipNewlines();
        const specifiers = [];
        if (this.match("LBRACE")) {
            this.skipNewlines();
            while (!this.checkType("RBRACE")) {
                const local = this.parseIdentifier();
                specifiers.push(this.node("ExportSpecifier", { local }, identToToken(local)));
                this.skipNewlines();
                if (this.match("COMMA")) {
                    this.skipNewlines();
                    continue;
                }
                break;
            }
            this.skipNewlines();
            this.expect("RBRACE");
        }
        else {
            const local = this.parseIdentifier();
            specifiers.push(this.node("ExportSpecifier", { local }, identToToken(local)));
        }
        return this.node("ExportDeclaration", { specifiers }, start);
    }
    parseProjectionDefinition() {
        const start = this.expect("KEYWORD", "@projection");
        this.skipNewlines();
        const name = this.parseIdentifier();
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        let focus = null;
        let contract = null;
        let fields = null;
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @projection section name");
            }
            const sectionToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (sectionToken.value) {
                case "focus":
                    if (focus !== null) {
                        throw this.error(sectionToken, 'Duplicate @projection section "focus"');
                    }
                    focus = this.parseValueExpr();
                    break;
                case "contract":
                    if (contract !== null) {
                        throw this.error(sectionToken, 'Duplicate @projection section "contract"');
                    }
                    contract = this.parseProjectionContract();
                    break;
                case "fields":
                    if (fields !== null) {
                        throw this.error(sectionToken, 'Duplicate @projection section "fields"');
                    }
                    fields = this.parseObjectLiteral();
                    break;
                default:
                    throw this.error(sectionToken, `Unknown @projection section "${sectionToken.value}"`);
            }
            this.skipNewlines();
            if (this.match("COMMA")) {
                this.skipNewlines();
            }
        }
        this.expect("RBRACE");
        if (fields === null) {
            throw this.error(start, "@projection requires a fields section");
        }
        return this.node("ProjectionDef", {
            name,
            focus,
            contract,
            fields,
        }, start);
    }
    parseProjectionContract() {
        const start = this.expect("LBRACE");
        const entries = [];
        this.skipNewlines();
        while (!this.checkType("RBRACE")) {
            const keyToken = this.peek();
            let key;
            if (this.checkType("IDENT")) {
                key = this.advance().value;
            }
            else if (this.checkType("STRING")) {
                key = stripQuotes(this.advance().value);
            }
            else {
                throw this.error(this.peek(), "Expected contract field name");
            }
            this.expect("COLON");
            this.skipNewlines();
            let requirement;
            if (this.checkType("IDENT")) {
                const value = this.advance().value;
                if (value !== "required" && value !== "optional") {
                    throw this.error(this.previous(), 'Projection contract values must be "required" or "optional"');
                }
                requirement = value;
            }
            else if (this.checkType("STRING")) {
                const value = stripQuotes(this.advance().value);
                if (value !== "required" && value !== "optional") {
                    throw this.error(this.previous(), 'Projection contract values must be "required" or "optional"');
                }
                requirement = value;
            }
            else {
                throw this.error(this.peek(), "Expected projection contract value");
            }
            entries.push(this.node("ProjectionContractField", { key, requirement }, keyToken));
            this.skipNewlines();
            if (!this.match("COMMA")) {
                break;
            }
            this.skipNewlines();
        }
        this.skipNewlines();
        this.expect("RBRACE");
        return this.node("ProjectionContract", { entries }, start);
    }
    parseBindingLikeStatement() {
        const ident = this.parseIdentifier();
        if (this.match("COLON_EQUALS")) {
            if (this.check("KEYWORD", "@graph")) {
                return this.parseGraphInteractionDefinition(ident);
            }
            if (this.check("KEYWORD", "@seed")) {
                return this.parseGraphPipelineAfterName(ident);
            }
            const value = this.parseOperatorExpr();
            return this.node("OperatorBinding", {
                name: ident,
                value,
            }, identToToken(ident));
        }
        if (this.match("EQUALS")) {
            // Detect: name = graphId <> @project(...)
            if (this.isGraphProjectionExprStart()) {
                const source = this.parseIdentifier();
                this.skipNewlines();
                this.expect("PROJECT");
                const projection = this.parseTerminalGraphExpr();
                return this.node("GraphProjection", { name: ident, source, projection }, identToToken(ident));
            }
            const value = this.parseValueExpr();
            return this.node("ValueBinding", {
                name: ident,
                value,
            }, identToToken(ident));
        }
        throw this.error(this.peek(), `Expected "=" or ":=" after identifier "${ident.name}"`);
    }
    isBindStatementStart() {
        if (!this.checkType("KEYWORD")) {
            return false;
        }
        return this.peek().value === "@bind" || this.peek().value.startsWith("@bind.");
    }
    parseBindStatement() {
        const keyword = this.expectType("KEYWORD");
        const { layer, entity } = this.parseBindSelector(keyword);
        this.expect("LPAREN");
        const name = this.parseIdentifier();
        this.expect("COLON_EQUALS");
        const expression = this.parseValueExpr();
        this.expect("RPAREN");
        return this.node("BindStatement", {
            layer,
            entity,
            name,
            expression,
        }, keyword);
    }
    parseBindSelector(keyword) {
        const parts = keyword.value.split(".");
        if (parts[0] !== "@bind") {
            throw this.error(keyword, `Expected @bind statement, got "${keyword.value}"`);
        }
        if (parts.length === 1) {
            return { layer: null, entity: null };
        }
        if (parts.length === 2) {
            return {
                layer: parts[1],
                entity: null,
            };
        }
        if (parts.length === 3) {
            return {
                layer: parts[1],
                entity: parts[2],
            };
        }
        throw this.error(keyword, `Unsupported @bind form "${keyword.value}"`);
    }
    parseSeedBlock() {
        const start = this.expect("KEYWORD", "@seed");
        this.expect("COLON");
        this.skipNewlines();
        let nodes = [];
        let edges = [];
        let state = null;
        let meta = null;
        let root = null;
        while (!this.isAtEnd()) {
            this.skipNewlines();
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                break;
            }
            const field = this.parseIdentifier().name;
            this.expect("COLON");
            switch (field) {
                case "nodes":
                    nodes = this.parseSeedNodes();
                    break;
                case "edges":
                    edges = this.parseSeedEdges();
                    break;
                case "state":
                    state = this.parseObjectLiteral();
                    break;
                case "meta":
                    meta = this.parseObjectLiteral();
                    break;
                case "root":
                    root = this.parseIdentifier();
                    break;
                default:
                    throw this.error(this.peek(), `Unknown @seed field "${field}"`);
            }
            this.skipNewlines();
        }
        if (!state) {
            state = this.node("ObjectLiteral", { properties: [] }, start);
        }
        if (!meta) {
            meta = this.node("ObjectLiteral", { properties: [] }, start);
        }
        if (!root) {
            throw this.error(start, `@seed requires a root field`);
        }
        return this.node("SeedBlock", {
            nodes,
            edges,
            state,
            meta,
            root,
        }, start);
    }
    parseSeedNodes() {
        this.expect("LBRACKET");
        const nodes = [];
        this.skipNewlines();
        while (!this.checkType("RBRACKET")) {
            this.skipNewlines();
            const ref = this.parseIdentifier();
            nodes.push(this.node("SeedNodeRef", { ref }, identToToken(ref)));
            this.skipNewlines();
            if (this.match("COMMA")) {
                this.skipNewlines();
                continue;
            }
            break;
        }
        this.skipNewlines();
        this.expect("RBRACKET");
        return nodes;
    }
    parseSeedEdges() {
        this.expect("LBRACKET");
        const edges = [];
        this.skipNewlines();
        while (!this.checkType("RBRACKET")) {
            this.skipNewlines();
            edges.push(this.parseSeedEdgeEntry());
            this.skipNewlines();
            if (this.match("COMMA")) {
                this.skipNewlines();
                continue;
            }
            break;
        }
        this.skipNewlines();
        this.expect("RBRACKET");
        return edges;
    }
    parseSeedEdgeEntry() {
        if (this.checkType("IDENT") &&
            this.peekNext().type === "COLON_EQUALS" &&
            this.peekN(2).type === "LBRACKET") {
            const name = this.parseIdentifier();
            this.expect("COLON_EQUALS");
            this.expect("LBRACKET");
            this.skipNewlines();
            const edge = this.parseEdgeExpr();
            this.skipNewlines();
            this.expect("RBRACKET");
            return this.node("SeedEdgeBinding", {
                name,
                edge,
            }, identToToken(name));
        }
        this.expect("LBRACKET");
        this.skipNewlines();
        const edge = this.parseEdgeExpr();
        this.skipNewlines();
        this.expect("RBRACKET");
        return edge;
    }
    parseEdgeExpr() {
        const left = this.parseIdentifier();
        this.expect("COLON");
        const relation = this.parseStringLiteral();
        this.expect("COLON");
        const right = this.parseIdentifier();
        return this.node("EdgeExpr", {
            left,
            relation,
            right,
        }, identToToken(left));
    }
    parseGraphInteractionDefinition(name) {
        const start = name ? identToToken(name) : this.peek();
        const subject = this.parseGraphRef();
        this.expect("COLON");
        const relation = this.parseStringLiteral();
        this.expect("COLON");
        const object = this.parseGraphRef();
        this.skipNewlines();
        this.expect("ARROW");
        const effect = this.parseEffectBlock();
        return this.node("GraphInteractionDefinition", {
            name,
            subject,
            relation,
            object,
            effect,
        }, start);
    }
    parseGraphRef() {
        const start = this.expect("KEYWORD", "@graph");
        this.expect("LPAREN");
        const graphId = this.parseIdentifier();
        this.expect("RPAREN");
        return this.node("GraphRef", {
            name: "@graph",
            graphId,
        }, start);
    }
    parseEffectBlock() {
        const start = this.expect("KEYWORD", "@effect");
        this.expect("LPAREN");
        this.skipNewlines();
        let target = null;
        let ops = null;
        while (!this.checkType("RPAREN")) {
            const fieldToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (fieldToken.value) {
                case "target":
                    if (target !== null) {
                        throw this.error(fieldToken, `Duplicate @effect field "target"`);
                    }
                    target = this.parseEffectTarget();
                    break;
                case "ops":
                    if (ops !== null) {
                        throw this.error(fieldToken, `Duplicate @effect field "ops"`);
                    }
                    ops = this.parseEffectOps();
                    break;
                default:
                    throw this.error(fieldToken, `Unknown @effect field "${fieldToken.value}"`);
            }
            this.skipNewlines();
            if (!this.match("COMMA")) {
                break;
            }
            this.skipNewlines();
        }
        this.expect("RPAREN");
        if (target === null) {
            throw this.error(start, `@effect requires a target field`);
        }
        if (ops === null) {
            throw this.error(start, `@effect requires an ops field`);
        }
        return this.node("EffectBlock", {
            name: "@effect",
            target,
            ops,
        }, start);
    }
    parseEffectTarget() {
        if (this.checkType("IDENT") && this.peek().value === "root") {
            const token = this.expectType("IDENT");
            return this.node("RootTarget", {
                name: "root",
            }, token);
        }
        return this.parseIdentifier();
    }
    parseEffectOps() {
        this.expect("LBRACKET");
        this.skipNewlines();
        const ops = [];
        while (!this.checkType("RBRACKET")) {
            ops.push(this.parseEffectOp());
            this.skipNewlines();
            if (!this.match("COMMA")) {
                break;
            }
            this.skipNewlines();
        }
        this.expect("RBRACKET");
        return ops;
    }
    parseEffectOp() {
        const keyword = this.expectType("KEYWORD");
        switch (keyword.value) {
            case "@graft.state": {
                this.expect("LPAREN");
                const key = this.parseStringLiteral();
                this.expect("COMMA");
                const value = this.parseValueExpr();
                this.expect("RPAREN");
                return this.node("EffectGraftStateOp", {
                    name: "@graft.state",
                    key,
                    value,
                }, keyword);
            }
            case "@graft.meta": {
                this.expect("LPAREN");
                const key = this.parseStringLiteral();
                this.expect("COMMA");
                const value = this.parseValueExpr();
                this.expect("RPAREN");
                return this.node("EffectGraftMetaOp", {
                    name: "@graft.meta",
                    key,
                    value,
                }, keyword);
            }
            case "@prune.state": {
                this.expect("LPAREN");
                const key = this.parseStringLiteral();
                this.expect("RPAREN");
                return this.node("EffectPruneStateOp", {
                    name: "@prune.state",
                    key,
                }, keyword);
            }
            case "@prune.meta": {
                this.expect("LPAREN");
                const key = this.parseStringLiteral();
                this.expect("RPAREN");
                return this.node("EffectPruneMetaOp", {
                    name: "@prune.meta",
                    key,
                }, keyword);
            }
            case "@derive.state": {
                this.expect("LPAREN");
                const key = this.parseStringLiteral();
                this.expect("COMMA");
                const expression = this.parseDeriveExpr();
                this.expect("RPAREN");
                return this.node("EffectDeriveStateOp", {
                    name: "@derive.state",
                    key,
                    expression,
                }, keyword);
            }
            case "@derive.meta": {
                this.expect("LPAREN");
                const key = this.parseStringLiteral();
                this.expect("COMMA");
                const expression = this.parseDeriveExpr();
                this.expect("RPAREN");
                return this.node("EffectDeriveMetaOp", {
                    name: "@derive.meta",
                    key,
                    expression,
                }, keyword);
            }
            default:
                throw this.error(keyword, `Unsupported @effect op "${keyword.value}"`);
        }
    }
    parseGraphPipeline() {
        const name = this.parseIdentifier();
        this.expect("COLON_EQUALS");
        return this.parseGraphPipelineAfterName(name);
    }
    parseGraphPipelineAfterName(name) {
        const start = identToToken(name);
        const source = this.parseGraphSource();
        const mutations = [];
        let projection = null;
        this.skipNewlines();
        while (this.match("ARROW")) {
            const mutation = this.parseGraphPipelineStep();
            mutations.push(mutation);
            this.skipNewlines();
        }
        if (this.match("PROJECT")) {
            projection = this.parseTerminalGraphExpr();
        }
        return this.node("GraphPipeline", {
            name,
            source,
            mutations,
            projection,
        }, start);
    }
    parseGraphPipelineStep() {
        if (this.check("KEYWORD", "@if")) {
            return this.parseIfExpr();
        }
        if (this.check("KEYWORD", "@when")) {
            return this.parseWhenExpr();
        }
        return this.parseMutationExpr();
    }
    parseMutationExpr() {
        const keyword = this.expectType("KEYWORD");
        switch (keyword.value) {
            case "@runtime.addNode": {
                this.expect("LPAREN");
                const node = this.check("KEYWORD", "@runtime.generateNodeId")
                    ? this.parseRuntimeGenerateNodeIdExpr()
                    : this.parseIdentifier();
                this.expect("COMMA");
                const value = this.parseValueExpr();
                this.expect("COMMA");
                const state = this.parseValueExpr();
                this.expect("COMMA");
                const meta = this.parseValueExpr();
                this.expect("RPAREN");
                return this.node("RuntimeAddNodeExpr", {
                    name: "@runtime.addNode",
                    node,
                    value,
                    state,
                    meta,
                }, keyword);
            }
            case "@runtime.updateNodeValue": {
                this.expect("LPAREN");
                const node = this.parseIdentifier();
                this.expect("COMMA");
                const patch = this.parseValueExpr();
                this.expect("RPAREN");
                return this.node("RuntimeUpdateNodeValueExpr", {
                    name: "@runtime.updateNodeValue",
                    node,
                    patch,
                }, keyword);
            }
            case "@runtime.deleteNode": {
                this.expect("LPAREN");
                const node = this.parseIdentifier();
                this.expect("RPAREN");
                return this.node("RuntimeDeleteNodeExpr", {
                    name: "@runtime.deleteNode",
                    node,
                }, keyword);
            }
            case "@graft.branch": {
                this.expect("LPAREN");
                const subject = this.parseIdentifier();
                this.expect("COMMA");
                const relation = this.parseStringLiteral();
                this.expect("COMMA");
                const object = this.parseIdentifier();
                let metadata = null;
                if (this.match("COMMA")) {
                    metadata = this.parseValueExpr();
                }
                this.expect("RPAREN");
                return this.node("GraftBranchExpr", {
                    name: "@graft.branch",
                    subject,
                    relation,
                    object,
                    metadata,
                }, keyword);
            }
            case "@graft.state": {
                this.expect("LPAREN");
                const node = this.parseIdentifier();
                this.expect("COMMA");
                const key = this.parseStringLiteral();
                this.expect("COMMA");
                const value = this.parseValueExpr();
                this.expect("RPAREN");
                return this.node("GraftStateExpr", {
                    name: "@graft.state",
                    node,
                    key,
                    value,
                }, keyword);
            }
            case "@graft.meta": {
                this.expect("LPAREN");
                const node = this.parseIdentifier();
                this.expect("COMMA");
                const key = this.parseStringLiteral();
                this.expect("COMMA");
                const value = this.parseValueExpr();
                this.expect("RPAREN");
                return this.node("GraftMetaExpr", {
                    name: "@graft.meta",
                    node,
                    key,
                    value,
                }, keyword);
            }
            case "@graft.progress": {
                this.expect("LPAREN");
                const from = this.parseIdentifier();
                this.expect("COMMA");
                const relation = this.parseStringLiteral();
                this.expect("COMMA");
                const to = this.parseIdentifier();
                this.expect("RPAREN");
                return this.node("GraftProgressExpr", {
                    name: "@graft.progress",
                    from,
                    relation,
                    to,
                }, keyword);
            }
            case "@prune.branch": {
                this.expect("LPAREN");
                const subject = this.parseIdentifier();
                this.expect("COMMA");
                const relation = this.parseStringLiteral();
                this.expect("COMMA");
                const object = this.parseIdentifier();
                let metadata = null;
                if (this.match("COMMA")) {
                    metadata = this.parseValueExpr();
                }
                this.expect("RPAREN");
                return this.node("PruneBranchExpr", {
                    name: "@prune.branch",
                    subject,
                    relation,
                    object,
                    metadata,
                }, keyword);
            }
            case "@prune.state": {
                this.expect("LPAREN");
                const node = this.parseIdentifier();
                this.expect("COMMA");
                const key = this.parseStringLiteral();
                this.expect("RPAREN");
                return this.node("PruneStateExpr", {
                    name: "@prune.state",
                    node,
                    key,
                }, keyword);
            }
            case "@prune.meta": {
                this.expect("LPAREN");
                const node = this.parseIdentifier();
                this.expect("COMMA");
                const key = this.parseStringLiteral();
                this.expect("RPAREN");
                return this.node("PruneMetaExpr", {
                    name: "@prune.meta",
                    node,
                    key,
                }, keyword);
            }
            case "@prune.nodes": {
                this.expect("LPAREN");
                const where = this.parseWherePredicate();
                this.expect("RPAREN");
                return this.node("PruneNodesExpr", {
                    name: "@prune.nodes",
                    where,
                }, keyword);
            }
            case "@prune.edges": {
                this.expect("LPAREN");
                const where = this.parseWherePredicate();
                this.expect("RPAREN");
                return this.node("PruneEdgesExpr", {
                    name: "@prune.edges",
                    where,
                }, keyword);
            }
            case "@ctx.set":
                return this.parseCtxSetExpr(keyword);
            case "@ctx.clear":
                return this.parseCtxClearExpr(keyword);
            case "@apply":
                return this.parseApplyExpr(keyword);
            default:
                throw this.error(keyword, `Unsupported mutation operator "${keyword.value}"`);
        }
    }
    parseApplyExpr(startToken) {
        this.expect("LPAREN");
        let target;
        if (this.checkType("IDENT")) {
            target = this.parseIdentifier();
        }
        else if (this.checkType("LANGLE")) {
            target = this.parseNodeCapture();
        }
        else {
            throw this.error(this.peek(), "Expected identifier or node capture inside @apply(...)");
        }
        this.expect("RPAREN");
        return this.node("ApplyExpr", {
            name: "@apply",
            target,
        }, startToken);
    }
    parseCtxSetExpr(startToken) {
        this.expect("LPAREN");
        const edge = this.parseIdentifier();
        this.expect("COMMA");
        const context = this.parseValueExpr();
        this.expect("RPAREN");
        return this.node("CtxSetExpr", {
            name: "@ctx.set",
            edge,
            context,
        }, startToken);
    }
    parseCtxClearExpr(startToken) {
        this.expect("LPAREN");
        const edge = this.parseIdentifier();
        this.expect("RPAREN");
        return this.node("CtxClearExpr", {
            name: "@ctx.clear",
            edge,
        }, startToken);
    }
    parseSystemRelation() {
        const left = this.parseIdentifier();
        let relation = null;
        if (this.match("COLON")) {
            relation = this.parseStringLiteral();
            this.expect("TCOLON");
        }
        else {
            this.expect("TCOLON");
        }
        const right = this.parseIdentifier();
        return this.node("SystemRelation", {
            left,
            relation,
            right,
        }, identToToken(left));
    }
    parseQueryExpr() {
        if (this.check("KEYWORD", "@query"))
            return this.parseGraphQueryExpr();
        if (this.check("KEYWORD", "@match"))
            return this.parseMatchExpr();
        if (this.check("KEYWORD", "@path"))
            return this.parsePathExpr();
        if (this.check("KEYWORD", "@why"))
            return this.parseWhyExpr();
        if (this.check("KEYWORD", "@how"))
            return this.parseHowExpr();
        if (this.check("KEYWORD", "@where"))
            return this.parseWhereExpr();
        throw this.error(this.peek(), "Expected query expression");
    }
    parseMatchExpr() {
        const start = this.expect("KEYWORD", "@match");
        this.expect("LPAREN");
        this.skipNewlines();
        const patterns = [];
        while (!this.checkType("RPAREN")) {
            patterns.push(this.parseRelationPattern());
            this.skipNewlines();
        }
        this.expect("RPAREN");
        let where = null;
        this.skipNewlines();
        if (this.check("KEYWORD", "@where")) {
            where = this.parseWhereClause();
        }
        return this.node("MatchExpr", {
            patterns,
            where,
        }, start);
    }
    parsePathExpr() {
        const start = this.expect("KEYWORD", "@path");
        this.expect("LPAREN");
        const from = this.parseValueExpr();
        this.expect("COMMA");
        const to = this.parseValueExpr();
        this.expect("RPAREN");
        let where = null;
        this.skipNewlines();
        if (this.check("KEYWORD", "@where")) {
            where = this.parseWhereClause();
        }
        return this.node("PathExpr", {
            from,
            to,
            where,
        }, start);
    }
    parseWhyExpr() {
        const start = this.expect("KEYWORD", "@why");
        this.expect("LPAREN");
        let target;
        if (this.check("KEYWORD", "@match")) {
            target = this.parseMatchExpr();
        }
        else if (this.check("KEYWORD", "@path")) {
            target = this.parsePathExpr();
        }
        else if (this.looksLikeEdgeExpr()) {
            target = this.parseEdgeExpr();
        }
        else {
            target = this.parseIdentifier();
        }
        this.expect("RPAREN");
        return this.node("WhyExpr", {
            target,
        }, start);
    }
    parseHowExpr() {
        const start = this.expect("KEYWORD", "@how");
        this.expect("LPAREN");
        let target;
        if (this.checkType("IDENT")) {
            target = this.parseIdentifier();
        }
        else if (this.checkType("LANGLE")) {
            target = this.parseNodeCapture();
        }
        else {
            throw this.error(this.peek(), "Expected identifier or node capture inside @how(...)");
        }
        this.expect("RPAREN");
        return this.node("HowExpr", {
            target,
        }, start);
    }
    parseWhereClause() {
        this.expect("KEYWORD", "@where");
        this.expect("LPAREN");
        const expr = this.parseBooleanExpr();
        this.expect("RPAREN");
        return expr;
    }
    parseWhereExpr() {
        const start = this.expect("KEYWORD", "@where");
        this.expect("LPAREN");
        const expression = this.parseBooleanExpr();
        this.expect("RPAREN");
        return this.node("WhereExpr", { expression }, start);
    }
    parseWherePredicate() {
        const start = this.expect("KEYWORD", "@where");
        this.expect("LPAREN");
        const expression = this.parseBooleanExpr();
        this.expect("RPAREN");
        return this.node("WherePredicate", { expression }, start);
    }
    parseGraphQueryExpr() {
        const start = this.expect("KEYWORD", "@query");
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        let subject = null;
        let relation = null;
        let object = null;
        let node = null;
        let state = null;
        let meta = null;
        let equals = null;
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @query field name");
            }
            const fieldToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (fieldToken.value) {
                case "subject":
                    if (subject !== null) {
                        throw this.error(fieldToken, 'Duplicate @query field "subject"');
                    }
                    subject = this.parseIdentifier();
                    break;
                case "relation":
                    if (relation !== null) {
                        throw this.error(fieldToken, 'Duplicate @query field "relation"');
                    }
                    relation = this.parseStringLiteral();
                    break;
                case "object":
                    if (object !== null) {
                        throw this.error(fieldToken, 'Duplicate @query field "object"');
                    }
                    object = this.parseIdentifier();
                    break;
                case "node":
                    if (node !== null) {
                        throw this.error(fieldToken, 'Duplicate @query field "node"');
                    }
                    node = this.parseIdentifier();
                    break;
                case "state":
                    if (state !== null) {
                        throw this.error(fieldToken, 'Duplicate @query field "state"');
                    }
                    state = this.parseStringLiteral();
                    break;
                case "meta":
                    if (meta !== null) {
                        throw this.error(fieldToken, 'Duplicate @query field "meta"');
                    }
                    meta = this.parseStringLiteral();
                    break;
                case "equals":
                    if (equals !== null) {
                        throw this.error(fieldToken, 'Duplicate @query field "equals"');
                    }
                    equals = this.parseValueExpr();
                    break;
                default:
                    throw this.error(fieldToken, `Unknown @query field "${fieldToken.value}"`);
            }
            this.skipNewlines();
        }
        this.expect("RBRACE");
        return this.node("GraphQueryExpr", {
            name: "@query",
            subject,
            relation,
            object,
            node,
            state,
            meta,
            equals,
        }, start);
    }
    parseLoopExpr() {
        const start = this.expect("KEYWORD", "@loop");
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        let until = null;
        let count = null;
        let pipeline = null;
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @loop section name");
            }
            const sectionToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (sectionToken.value) {
                case "until":
                    if (until !== null) {
                        throw this.error(sectionToken, 'Duplicate @loop section "until"');
                    }
                    until = this.parseGraphQueryExpr();
                    break;
                case "count":
                    if (count !== null) {
                        throw this.error(sectionToken, 'Duplicate @loop section "count"');
                    }
                    count = this.parseLoopCountExpr();
                    break;
                case "pipeline":
                    if (pipeline !== null) {
                        throw this.error(sectionToken, 'Duplicate @loop section "pipeline"');
                    }
                    pipeline = this.parseActionPipelineSection();
                    break;
                default:
                    throw this.error(sectionToken, `Unknown @loop section "${sectionToken.value}"`);
            }
            this.skipNewlines();
        }
        this.expect("RBRACE");
        return this.node("LoopExpr", {
            name: "@loop",
            until,
            count,
            pipeline: pipeline ?? [],
        }, start);
    }
    parseIfExpr() {
        const start = this.expect("KEYWORD", "@if");
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        let when = null;
        let thenPipeline = null;
        let elsePipeline = null;
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @if section name");
            }
            const sectionToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (sectionToken.value) {
                case "when":
                    if (when !== null) {
                        throw this.error(sectionToken, 'Duplicate @if section "when"');
                    }
                    when = this.parseGraphControlExpr();
                    break;
                case "condition":
                    // Deprecated: use `when:` instead
                    if (when !== null) {
                        throw this.error(sectionToken, 'Duplicate @if section "condition" (use "when:")');
                    }
                    this.warn(sectionToken, '@if "condition:" is deprecated — use "when:" instead');
                    when = this.parseGraphControlExpr();
                    break;
                case "then":
                    if (thenPipeline !== null) {
                        throw this.error(sectionToken, 'Duplicate @if section "then"');
                    }
                    thenPipeline = this.parseGraphPipelineSection();
                    break;
                case "else":
                    if (elsePipeline !== null) {
                        throw this.error(sectionToken, 'Duplicate @if section "else"');
                    }
                    elsePipeline = this.parseGraphPipelineSection();
                    break;
                default:
                    throw this.error(sectionToken, `Unknown @if section "${sectionToken.value}"`);
            }
            this.skipNewlines();
        }
        this.expect("RBRACE");
        return this.node("IfExpr", {
            name: "@if",
            when,
            then: thenPipeline ?? [],
            else: elsePipeline,
        }, start);
    }
    parseWhenExpr() {
        const start = this.expect("KEYWORD", "@when");
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        let query = null;
        let pipeline = null;
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @when section name");
            }
            const sectionToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (sectionToken.value) {
                case "query":
                    if (query !== null) {
                        throw this.error(sectionToken, 'Duplicate @when section "query"');
                    }
                    query = this.parseGraphControlExpr();
                    break;
                case "event":
                    // Deprecated: use `query:` instead
                    if (query !== null) {
                        throw this.error(sectionToken, 'Duplicate @when section "event" (use "query:")');
                    }
                    this.warn(sectionToken, '@when "event:" is deprecated — use "query:" instead');
                    query = this.parseGraphControlExpr();
                    break;
                case "pipeline":
                    if (pipeline !== null) {
                        throw this.error(sectionToken, 'Duplicate @when section "pipeline"');
                    }
                    pipeline = this.parseGraphPipelineSection();
                    break;
                default:
                    throw this.error(sectionToken, `Unknown @when section "${sectionToken.value}"`);
            }
            this.skipNewlines();
        }
        this.expect("RBRACE");
        return this.node("WhenExpr", {
            name: "@when",
            query,
            pipeline: pipeline ?? [],
        }, start);
    }
    parseGraphControlExpr() {
        if (this.check("KEYWORD", "@query")) {
            return this.parseGraphQueryExpr();
        }
        return this.parseBooleanExpr();
    }
    parseLoopCountExpr() {
        if (this.checkType("NUMBER")) {
            return this.parseNumberLiteral();
        }
        if (this.check("KEYWORD", "@derive.state")) {
            return this.parseDeriveStateExpr();
        }
        if (this.check("KEYWORD", "@derive.meta")) {
            return this.parseDeriveMetaExpr();
        }
        if (this.check("KEYWORD", "@derive.count")) {
            return this.parseDeriveCountExpr();
        }
        if (this.check("KEYWORD", "@derive.sum")) {
            return this.parseDeriveSumExpr();
        }
        if (this.check("KEYWORD", "@derive.min")) {
            return this.parseDeriveMinExpr();
        }
        if (this.check("KEYWORD", "@derive.max")) {
            return this.parseDeriveMaxExpr();
        }
        if (this.check("KEYWORD", "@derive.avg")) {
            return this.parseDeriveAvgExpr();
        }
        if (this.check("KEYWORD", "@derive.abs")) {
            return this.parseDeriveAbsExpr();
        }
        if (this.check("KEYWORD", "@derive.edgeCount")) {
            return this.parseDeriveEdgeCountExpr();
        }
        throw this.error(this.peek(), "Expected number literal or @derive.* expression for @loop count");
    }
    parseDeriveStateExpr() {
        const start = this.expect("KEYWORD", "@derive.state");
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        let node = null;
        let key = null;
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @derive.state field name");
            }
            const fieldToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (fieldToken.value) {
                case "node":
                    if (node !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.state field "node"');
                    }
                    node = this.parseIdentifier();
                    break;
                case "key":
                    if (key !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.state field "key"');
                    }
                    key = this.parseStringLiteral();
                    break;
                default:
                    throw this.error(fieldToken, `Unknown @derive.state field "${fieldToken.value}"`);
            }
            this.skipNewlines();
        }
        this.expect("RBRACE");
        return this.node("DeriveStateExpr", {
            name: "@derive.state",
            node,
            key,
        }, start);
    }
    parseDeriveMetaExpr() {
        const start = this.expect("KEYWORD", "@derive.meta");
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        let node = null;
        let key = null;
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @derive.meta field name");
            }
            const fieldToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (fieldToken.value) {
                case "node":
                    if (node !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.meta field "node"');
                    }
                    node = this.parseIdentifier();
                    break;
                case "key":
                    if (key !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.meta field "key"');
                    }
                    key = this.parseStringLiteral();
                    break;
                default:
                    throw this.error(fieldToken, `Unknown @derive.meta field "${fieldToken.value}"`);
            }
            this.skipNewlines();
        }
        this.expect("RBRACE");
        return this.node("DeriveMetaExpr", {
            name: "@derive.meta",
            node,
            key,
        }, start);
    }
    parseDeriveCountExpr() {
        const start = this.expect("KEYWORD", "@derive.count");
        let nodes = null;
        let from = null;
        if (this.match("LPAREN")) {
            this.skipNewlines();
            if (!this.checkType("RPAREN") && !(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                from = this.parseDeriveAggregateSourceValue(this.parseValueExpr());
            }
            else {
                const fields = this.parseNamedArguments("@derive.count");
                this.expect("RPAREN");
                for (const field of fields) {
                    switch (field.key.name) {
                        case "from":
                            if (from !== null) {
                                throw this.error(identToToken(field.key), 'Duplicate @derive.count field "from"');
                            }
                            from = this.parseDeriveAggregateSourceValue(field.value);
                            break;
                        default:
                            throw this.error(identToToken(field.key), `Unknown @derive.count field "${field.key.name}"`);
                    }
                }
                return this.node("DeriveCountExpr", {
                    name: "@derive.count",
                    nodes,
                    from,
                }, start);
            }
            this.skipNewlines();
            this.expect("RPAREN");
        }
        else {
            this.skipNewlines();
            this.expect("LBRACE");
            this.skipNewlines();
            while (!this.checkType("RBRACE")) {
                if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                    throw this.error(this.peek(), "Expected @derive.count field name");
                }
                const fieldToken = this.expectType("IDENT");
                this.expect("COLON");
                this.skipNewlines();
                switch (fieldToken.value) {
                    case "nodes":
                    case "path":
                        if (nodes !== null) {
                            throw this.error(fieldToken, `Duplicate @derive.count field "${fieldToken.value}"`);
                        }
                        nodes = this.parseDerivePathExpr();
                        break;
                    case "from":
                        if (from !== null) {
                            throw this.error(fieldToken, 'Duplicate @derive.count field "from"');
                        }
                        from = this.parseDeriveAggregateSource();
                        break;
                    default:
                        throw this.error(fieldToken, `Unknown @derive.count field "${fieldToken.value}"`);
                }
                this.skipNewlines();
            }
            this.expect("RBRACE");
        }
        return this.node("DeriveCountExpr", {
            name: "@derive.count",
            nodes,
            from,
        }, start);
    }
    parseDeriveEdgeCountExpr() {
        const start = this.expect("KEYWORD", "@derive.edgeCount");
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        let node = null;
        let relation = null;
        let direction = null;
        let where = null;
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @derive.edgeCount field name");
            }
            const fieldToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (fieldToken.value) {
                case "node":
                    if (node !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.edgeCount field "node"');
                    }
                    node = this.parseIdentifier();
                    break;
                case "relation":
                    if (relation !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.edgeCount field "relation"');
                    }
                    relation = this.parseStringLiteral();
                    break;
                case "direction":
                    if (direction !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.edgeCount field "direction"');
                    }
                    direction = this.parseStringLiteral();
                    break;
                case "where":
                    if (where !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.edgeCount field "where"');
                    }
                    where = this.parseBooleanExpr();
                    break;
                default:
                    throw this.error(fieldToken, `Unknown @derive.edgeCount field "${fieldToken.value}"`);
            }
            this.skipNewlines();
        }
        this.expect("RBRACE");
        return this.node("DeriveEdgeCountExpr", {
            name: "@derive.edgeCount",
            node,
            relation,
            direction,
            where,
        }, start);
    }
    parseDeriveExistsExpr() {
        const start = this.expect("KEYWORD", "@derive.exists");
        let path = null;
        if (this.match("LPAREN")) {
            this.skipNewlines();
            if (!this.checkType("RPAREN") && !(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                path = this.parseDeriveExistsValue(this.parseValueExpr());
            }
            else {
                const fields = this.parseNamedArguments("@derive.exists");
                this.expect("RPAREN");
                for (const field of fields) {
                    switch (field.key.name) {
                        case "path":
                            if (path !== null) {
                                throw this.error(identToToken(field.key), 'Duplicate @derive.exists field "path"');
                            }
                            path = this.parseDeriveExistsValue(field.value);
                            break;
                        default:
                            throw this.error(identToToken(field.key), `Unknown @derive.exists field "${field.key.name}"`);
                    }
                }
                return this.node("DeriveExistsExpr", {
                    name: "@derive.exists",
                    path,
                }, start);
            }
            this.skipNewlines();
            this.expect("RPAREN");
        }
        else {
            this.skipNewlines();
            this.expect("LBRACE");
            this.skipNewlines();
            while (!this.checkType("RBRACE")) {
                if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                    throw this.error(this.peek(), "Expected @derive.exists field name");
                }
                const fieldToken = this.expectType("IDENT");
                this.expect("COLON");
                this.skipNewlines();
                switch (fieldToken.value) {
                    case "path":
                        if (path !== null) {
                            throw this.error(fieldToken, 'Duplicate @derive.exists field "path"');
                        }
                        path = this.parseDeriveExistsValue(this.parseValueExpr());
                        break;
                    default:
                        throw this.error(fieldToken, `Unknown @derive.exists field "${fieldToken.value}"`);
                }
                this.skipNewlines();
            }
            this.expect("RBRACE");
        }
        return this.node("DeriveExistsExpr", {
            name: "@derive.exists",
            path,
        }, start);
    }
    parseDerivePathExpr() {
        const start = this.expect("KEYWORD", "@derive.path");
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        let node = null;
        let relation = null;
        let direction = null;
        let depth = null;
        let where = null;
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @derive.path field name");
            }
            const fieldToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (fieldToken.value) {
                case "node":
                    if (node !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.path field "node"');
                    }
                    node = this.parseIdentifier();
                    break;
                case "relation":
                    if (relation !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.path field "relation"');
                    }
                    if (this.checkType("STRING")) {
                        relation = this.parseStringLiteral();
                    }
                    else if (this.checkType("LBRACKET")) {
                        relation = this.parseArrayLiteral();
                    }
                    else {
                        throw this.error(this.peek(), 'Expected string or string array for @derive.path field "relation"');
                    }
                    break;
                case "direction":
                    if (direction !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.path field "direction"');
                    }
                    direction = this.parseStringLiteral();
                    break;
                case "depth":
                    if (depth !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.path field "depth"');
                    }
                    depth = this.parseNumberLiteral();
                    break;
                case "where":
                    if (where !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.path field "where"');
                    }
                    where = this.parseBooleanExpr();
                    break;
                default:
                    throw this.error(fieldToken, `Unknown @derive.path field "${fieldToken.value}"`);
            }
            this.skipNewlines();
        }
        this.expect("RBRACE");
        return this.node("DerivePathExpr", {
            name: "@derive.path",
            node,
            relation,
            direction,
            depth,
            where,
        }, start);
    }
    parseDeriveCollectExpr() {
        const start = this.expect("KEYWORD", "@derive.collect");
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        let path = null;
        let layer = null;
        let key = null;
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @derive.collect field name");
            }
            const fieldToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (fieldToken.value) {
                case "path":
                    if (path !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.collect field "path"');
                    }
                    path = this.parseDerivePathExpr();
                    break;
                case "layer":
                    if (layer !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.collect field "layer"');
                    }
                    layer = this.parseStringLiteral();
                    break;
                case "key":
                    if (key !== null) {
                        throw this.error(fieldToken, 'Duplicate @derive.collect field "key"');
                    }
                    key = this.parseStringLiteral();
                    break;
                default:
                    throw this.error(fieldToken, `Unknown @derive.collect field "${fieldToken.value}"`);
            }
            this.skipNewlines();
        }
        this.expect("RBRACE");
        return this.node("DeriveCollectExpr", { name: "@derive.collect", path, layer, key }, start);
    }
    parseDeriveSumExpr() {
        const start = this.expect("KEYWORD", "@derive.sum");
        let collect = null;
        let from = null;
        let field = null;
        if (this.match("LPAREN")) {
            const fields = this.parseNamedArguments("@derive.sum");
            this.expect("RPAREN");
            for (const entry of fields) {
                switch (entry.key.name) {
                    case "collect":
                        if (collect !== null) {
                            throw this.error(identToToken(entry.key), 'Duplicate @derive.sum field "collect"');
                        }
                        collect = this.parseDeriveCollectValue(entry.value);
                        break;
                    case "from":
                        if (from !== null) {
                            throw this.error(identToToken(entry.key), 'Duplicate @derive.sum field "from"');
                        }
                        from = this.parseDeriveAggregateSourceValue(entry.value);
                        break;
                    case "field":
                        if (field !== null) {
                            throw this.error(identToToken(entry.key), 'Duplicate @derive.sum field "field"');
                        }
                        field = this.parseStringLiteralValue(entry.value, "@derive.sum", "field");
                        break;
                    default:
                        throw this.error(identToToken(entry.key), `Unknown @derive.sum field "${entry.key.name}"`);
                }
            }
        }
        else {
            this.skipNewlines();
            this.expect("LBRACE");
            this.skipNewlines();
            while (!this.checkType("RBRACE")) {
                if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                    throw this.error(this.peek(), "Expected @derive.sum field name");
                }
                const fieldToken = this.expectType("IDENT");
                this.expect("COLON");
                this.skipNewlines();
                switch (fieldToken.value) {
                    case "collect":
                        if (collect !== null) {
                            throw this.error(fieldToken, 'Duplicate @derive.sum field "collect"');
                        }
                        collect = this.parseDeriveCollectExpr();
                        break;
                    case "from":
                        if (from !== null) {
                            throw this.error(fieldToken, 'Duplicate @derive.sum field "from"');
                        }
                        from = this.parseDeriveAggregateSource();
                        break;
                    case "field":
                        if (field !== null) {
                            throw this.error(fieldToken, 'Duplicate @derive.sum field "field"');
                        }
                        field = this.parseStringLiteral();
                        break;
                    default:
                        throw this.error(fieldToken, `Unknown @derive.sum field "${fieldToken.value}"`);
                }
                this.skipNewlines();
            }
            this.expect("RBRACE");
        }
        return this.node("DeriveSumExpr", { name: "@derive.sum", collect, from, field }, start);
    }
    parseDeriveMinExpr() {
        const start = this.expect("KEYWORD", "@derive.min");
        const { from, field } = this.parseFieldAggregate("@derive.min");
        return this.node("DeriveMinExpr", { name: "@derive.min", from, field }, start);
    }
    parseDeriveMaxExpr() {
        const start = this.expect("KEYWORD", "@derive.max");
        const { from, field } = this.parseFieldAggregate("@derive.max");
        return this.node("DeriveMaxExpr", { name: "@derive.max", from, field }, start);
    }
    parseDeriveAvgExpr() {
        const start = this.expect("KEYWORD", "@derive.avg");
        const { from, field } = this.parseFieldAggregate("@derive.avg");
        return this.node("DeriveAvgExpr", { name: "@derive.avg", from, field }, start);
    }
    parseDeriveAbsExpr() {
        const start = this.expect("KEYWORD", "@derive.abs");
        this.skipNewlines();
        this.expect("LPAREN");
        this.skipNewlines();
        const value = this.parseDeriveExpr();
        this.skipNewlines();
        this.expect("RPAREN");
        return this.node("DeriveAbsExpr", { name: "@derive.abs", value }, start);
    }
    parseFieldAggregate(name) {
        let from = null;
        let field = null;
        if (this.match("LPAREN")) {
            const fields = this.parseNamedArguments(name);
            this.expect("RPAREN");
            for (const entry of fields) {
                switch (entry.key.name) {
                    case "from":
                        if (from !== null) {
                            throw this.error(identToToken(entry.key), `Duplicate ${name} field "from"`);
                        }
                        from = this.parseDeriveAggregateSourceValue(entry.value);
                        break;
                    case "field":
                        if (field !== null) {
                            throw this.error(identToToken(entry.key), `Duplicate ${name} field "field"`);
                        }
                        field = this.parseStringLiteralValue(entry.value, name, "field");
                        break;
                    default:
                        throw this.error(identToToken(entry.key), `Unknown ${name} field "${entry.key.name}"`);
                }
            }
            return { from, field };
        }
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), `Expected ${name} field name`);
            }
            const fieldToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (fieldToken.value) {
                case "from":
                    if (from !== null) {
                        throw this.error(fieldToken, `Duplicate ${name} field "from"`);
                    }
                    from = this.parseDeriveAggregateSource();
                    break;
                case "field":
                    if (field !== null) {
                        throw this.error(fieldToken, `Duplicate ${name} field "field"`);
                    }
                    field = this.parseStringLiteral();
                    break;
                default:
                    throw this.error(fieldToken, `Unknown ${name} field "${fieldToken.value}"`);
            }
            this.skipNewlines();
        }
        this.expect("RBRACE");
        return { from, field };
    }
    parseNamedArguments(name) {
        const fields = [];
        this.skipNewlines();
        while (!this.checkType("RPAREN")) {
            this.skipNewlines();
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), `Expected ${name} field name`);
            }
            const key = this.parseIdentifier();
            this.expect("COLON");
            this.skipNewlines();
            const value = this.parseExtendedNamedArgumentValue();
            fields.push({ key, value });
            this.skipNewlines();
            if (!this.match("COMMA")) {
                break;
            }
            this.skipNewlines();
        }
        this.skipNewlines();
        return fields;
    }
    parseExtendedNamedArgumentValue() {
        if (this.check("KEYWORD", "@query") && this.peekNext().type === "LPAREN") {
            return this.parseAggregateQueryExpr();
        }
        if (this.check("KEYWORD", "@derive.state") ||
            this.check("KEYWORD", "@derive.meta") ||
            this.check("KEYWORD", "@derive.count") ||
            this.check("KEYWORD", "@derive.edgeCount") ||
            this.check("KEYWORD", "@derive.exists") ||
            this.check("KEYWORD", "@derive.path") ||
            this.check("KEYWORD", "@derive.collect") ||
            this.check("KEYWORD", "@derive.sum") ||
            this.check("KEYWORD", "@derive.min") ||
            this.check("KEYWORD", "@derive.max") ||
            this.check("KEYWORD", "@derive.avg") ||
            this.check("KEYWORD", "@derive.abs")) {
            return this.parseDeriveExpr();
        }
        return this.parseValueExpr();
    }
    parseDeriveAggregateSource() {
        if (this.check("KEYWORD", "@derive.path")) {
            return this.parseDerivePathExpr();
        }
        if (this.check("KEYWORD", "@query")) {
            return this.parseAggregateQueryExpr();
        }
        throw this.error(this.peek(), "Expected @derive.path or @query aggregate source");
    }
    parseDeriveAggregateSourceValue(value) {
        if (value.type === "DerivePathExpr" ||
            value.type === "AggregateQueryExpr" ||
            value.type === "Identifier") {
            return value;
        }
        throw this.error(value.span ? {
            type: "IDENT",
            value: "",
            line: value.span.line,
            column: value.span.column,
            index: value.span.start,
        } : this.peek(), "Expected @derive.path or @query aggregate source");
    }
    parseDeriveExistsValue(value) {
        if (value.type === "DerivePathExpr" || value.type === "Identifier") {
            return value;
        }
        throw this.error(value.span ? {
            type: "IDENT",
            value: "",
            line: value.span.line,
            column: value.span.column,
            index: value.span.start,
        } : this.peek(), "Expected @derive.path or identifier source");
    }
    parseStringLiteralValue(value, opName, fieldName) {
        if (value.type === "StringLiteral") {
            return value;
        }
        throw this.error(value.span ? {
            type: "IDENT",
            value: "",
            line: value.span.line,
            column: value.span.column,
            index: value.span.start,
        } : this.peek(), `${opName} ${fieldName} must be a string literal`);
    }
    parseDeriveCollectValue(value) {
        if (value.type === "DeriveCollectExpr") {
            return value;
        }
        throw this.error(value.span ? {
            type: "IDENT",
            value: "",
            line: value.span.line,
            column: value.span.column,
            index: value.span.start,
        } : this.peek(), "Expected @derive.collect value");
    }
    parseAggregateQueryExpr() {
        const start = this.expect("KEYWORD", "@query");
        this.skipNewlines();
        this.expect("LPAREN");
        this.skipNewlines();
        let typeName = null;
        while (!this.checkType("RPAREN")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @query field name");
            }
            const fieldToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (fieldToken.value) {
                case "type":
                    if (typeName !== null) {
                        throw this.error(fieldToken, 'Duplicate @query field "type"');
                    }
                    typeName = this.parseStringLiteral();
                    break;
                default:
                    throw this.error(fieldToken, `Unknown @query field "${fieldToken.value}"`);
            }
            this.skipNewlines();
            if (!this.match("COMMA")) {
                break;
            }
            this.skipNewlines();
        }
        this.expect("RPAREN");
        return this.node("AggregateQueryExpr", {
            name: "@query",
            typeName,
        }, start);
    }
    parseRelationPattern() {
        const left = this.parsePatternAtom();
        this.expect("COLON");
        const relation = this.parsePatternAtom();
        this.expect("COLON");
        const right = this.parsePatternAtom();
        return this.node("RelationPattern", {
            left,
            relation,
            right,
        }, atomToToken(left));
    }
    parsePatternAtom() {
        if (this.checkType("WILDCARD"))
            return this.parseWildcard();
        if (this.checkType("REGEX"))
            return this.parseRegexLiteral();
        if (this.checkType("STRING"))
            return this.parseStringLiteral();
        if (this.checkType("NUMBER"))
            return this.parseNumberLiteral();
        if (this.checkType("BOOLEAN"))
            return this.parseBooleanLiteral();
        if (this.checkType("LANGLE"))
            return this.parseNodeCapture();
        if (this.checkType("IDENT"))
            return this.parseIdentifier();
        throw this.error(this.peek(), "Expected pattern atom");
    }
    parseValueExpr() {
        if (this.check("KEYWORD", "@where"))
            return this.parseWhereExpr();
        if (this.check("KEYWORD", "@if"))
            return this.parseIfValueExpr();
        if (this.check("KEYWORD", "@select.node") ||
            this.check("KEYWORD", "@select.targets") ||
            this.check("KEYWORD", "@select.sources") ||
            this.check("KEYWORD", "@select.first") ||
            this.check("KEYWORD", "@select.one")) {
            return this.parseDirectiveCallExpr();
        }
        if (this.check("KEYWORD", "@derive.state") ||
            this.check("KEYWORD", "@derive.meta") ||
            this.check("KEYWORD", "@derive.count") ||
            this.check("KEYWORD", "@derive.edgeCount") ||
            this.check("KEYWORD", "@derive.exists") ||
            this.check("KEYWORD", "@derive.path") ||
            this.check("KEYWORD", "@derive.collect") ||
            this.check("KEYWORD", "@derive.sum") ||
            this.check("KEYWORD", "@derive.min") ||
            this.check("KEYWORD", "@derive.max") ||
            this.check("KEYWORD", "@derive.avg") ||
            this.check("KEYWORD", "@derive.abs")) {
            return this.parseDeriveExpr();
        }
        if (this.check("KEYWORD", "@runtime.generateNodeId")) {
            return this.parseRuntimeGenerateNodeIdExpr();
        }
        if (this.check("KEYWORD", "@runtime.generateValueId")) {
            return this.parseRuntimeGenerateValueIdExpr();
        }
        if (this.check("KEYWORD", "@runtime.nextOrder")) {
            return this.parseRuntimeNextOrderExpr();
        }
        if (this.checkType("IDENT"))
            return this.parseBooleanValue();
        if (this.checkType("STRING"))
            return this.parseStringLiteral();
        if (this.checkType("NUMBER"))
            return this.parseNumberLiteral();
        if (this.checkType("BOOLEAN"))
            return this.parseBooleanLiteral();
        if (this.checkType("LANGLE"))
            return this.parseNodeCapture();
        if (this.checkType("LBRACE"))
            return this.parseObjectLiteral();
        if (this.checkType("LBRACKET"))
            return this.parseArrayLiteral();
        throw this.error(this.peek(), "Expected value expression");
    }
    parseIfValueExpr() {
        const start = this.expect("KEYWORD", "@if");
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        let when = null;
        let thenValue = null;
        let elseValue = null;
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @if section name");
            }
            const sectionToken = this.expectType("IDENT");
            this.expect("COLON");
            this.skipNewlines();
            switch (sectionToken.value) {
                case "when":
                    if (when !== null) {
                        throw this.error(sectionToken, 'Duplicate @if section "when"');
                    }
                    when = this.parseGraphControlExpr();
                    break;
                case "then":
                    if (thenValue !== null) {
                        throw this.error(sectionToken, 'Duplicate @if section "then"');
                    }
                    thenValue = this.parseValueExpr();
                    break;
                case "else":
                    if (elseValue !== null) {
                        throw this.error(sectionToken, 'Duplicate @if section "else"');
                    }
                    elseValue = this.parseValueExpr();
                    break;
                default:
                    throw this.error(sectionToken, `Unknown @if section "${sectionToken.value}"`);
            }
            this.skipNewlines();
            if (this.match("COMMA")) {
                this.skipNewlines();
            }
        }
        this.expect("RBRACE");
        return this.node("IfValueExpr", {
            name: "@if",
            when,
            then: thenValue,
            else: elseValue,
        }, start);
    }
    parseDirectiveCallExpr() {
        const start = this.expectType("KEYWORD");
        this.skipNewlines();
        this.expect("LPAREN");
        const args = this.parseArguments();
        this.expect("RPAREN");
        return this.node("DirectiveCallExpr", {
            name: start.value,
            args,
        }, start);
    }
    parseRuntimeGenerateValueIdExpr() {
        const start = this.expect("KEYWORD", "@runtime.generateValueId");
        this.skipNewlines();
        this.expect("LPAREN");
        this.skipNewlines();
        let prefix = null;
        if (!this.checkType("RPAREN")) {
            prefix = this.parseStringLiteral();
            this.skipNewlines();
        }
        this.expect("RPAREN");
        return this.node("RuntimeGenerateValueIdExpr", {
            name: "@runtime.generateValueId",
            prefix,
        }, start);
    }
    parseRuntimeGenerateNodeIdExpr() {
        const start = this.expect("KEYWORD", "@runtime.generateNodeId");
        this.skipNewlines();
        this.expect("LPAREN");
        this.skipNewlines();
        let prefix = null;
        if (!this.checkType("RPAREN")) {
            prefix = this.parseStringLiteral();
            this.skipNewlines();
        }
        this.expect("RPAREN");
        return this.node("RuntimeGenerateNodeIdExpr", {
            name: "@runtime.generateNodeId",
            prefix,
        }, start);
    }
    parseRuntimeNextOrderExpr() {
        const start = this.expect("KEYWORD", "@runtime.nextOrder");
        this.skipNewlines();
        this.expect("LPAREN");
        this.skipNewlines();
        this.expect("RPAREN");
        return this.node("RuntimeNextOrderExpr", {
            name: "@runtime.nextOrder",
        }, start);
    }
    parseDeriveExpr() {
        return this.parseDeriveAddition();
    }
    parseDeriveAddition() {
        let expr = this.parseDeriveMultiplication();
        while (this.checkType("PLUS") || this.checkType("MINUS")) {
            const operator = this.advance();
            const right = this.parseDeriveMultiplication();
            expr = this.node("DeriveBinaryExpr", {
                operator: operator.value,
                left: expr,
                right,
            }, operator);
        }
        return expr;
    }
    parseDeriveMultiplication() {
        let expr = this.parseDerivePrimary();
        while (this.checkType("STAR") ||
            this.checkType("SLASH") ||
            this.checkType("PERCENT")) {
            const operator = this.advance();
            const right = this.parseDerivePrimary();
            expr = this.node("DeriveBinaryExpr", {
                operator: operator.value,
                left: expr,
                right,
            }, operator);
        }
        return expr;
    }
    parseDerivePrimary() {
        if (this.checkType("IDENT")) {
            if (this.peek().value === "current") {
                const token = this.expectType("IDENT");
                return this.node("CurrentValue", {
                    name: "current",
                }, token);
            }
            if (this.peek().value === "previous") {
                const token = this.expectType("IDENT");
                return this.node("PreviousValue", {
                    name: "previous",
                }, token);
            }
        }
        if (this.check("KEYWORD", "@derive.state")) {
            return this.parseDeriveStateExpr();
        }
        if (this.check("KEYWORD", "@derive.meta")) {
            return this.parseDeriveMetaExpr();
        }
        if (this.check("KEYWORD", "@derive.count")) {
            return this.parseDeriveCountExpr();
        }
        if (this.check("KEYWORD", "@derive.edgeCount")) {
            return this.parseDeriveEdgeCountExpr();
        }
        if (this.check("KEYWORD", "@derive.exists")) {
            return this.parseDeriveExistsExpr();
        }
        if (this.check("KEYWORD", "@derive.path")) {
            return this.parseDerivePathExpr();
        }
        if (this.check("KEYWORD", "@derive.collect")) {
            return this.parseDeriveCollectExpr();
        }
        if (this.check("KEYWORD", "@derive.sum")) {
            return this.parseDeriveSumExpr();
        }
        if (this.check("KEYWORD", "@derive.min")) {
            return this.parseDeriveMinExpr();
        }
        if (this.check("KEYWORD", "@derive.max")) {
            return this.parseDeriveMaxExpr();
        }
        if (this.check("KEYWORD", "@derive.avg")) {
            return this.parseDeriveAvgExpr();
        }
        if (this.check("KEYWORD", "@derive.abs")) {
            return this.parseDeriveAbsExpr();
        }
        if (this.checkType("NUMBER"))
            return this.parseNumberLiteral();
        if (this.checkType("STRING"))
            return this.parseStringLiteral();
        throw this.error(this.peek(), "Expected derive expression");
    }
    parseOperatorExpr() {
        const keyword = this.expectType("KEYWORD");
        switch (keyword.value) {
            case "@action":
                return this.parseActionExpr(keyword);
            case "@ctx":
                return this.parseCtxExpr(keyword);
            case "@project":
                return this.parseProjectExpr(keyword);
            case "@reduce":
                return this.parseReduceExpr(keyword);
            default:
                throw this.error(keyword, `Expected operator expression, got "${keyword.value}"`);
        }
    }
    parseActionExpr(startToken) {
        const start = startToken ?? this.expect("KEYWORD", "@action");
        let guard = null;
        let pipeline = null;
        let project = null;
        this.skipNewlines();
        this.expect("LBRACE");
        this.skipNewlines();
        while (!this.checkType("RBRACE")) {
            if (!(this.checkType("IDENT") && this.peekNext().type === "COLON")) {
                throw this.error(this.peek(), "Expected @action section name");
            }
            const sectionToken = this.expectType("IDENT");
            const section = sectionToken.value;
            this.expect("COLON");
            this.skipNewlines();
            switch (section) {
                case "guard":
                    if (guard !== null) {
                        throw this.error(sectionToken, `Duplicate @action section "${section}"`);
                    }
                    guard = this.parseActionGuardExpr();
                    break;
                case "pipeline":
                    if (pipeline !== null) {
                        throw this.error(sectionToken, `Duplicate @action section "${section}"`);
                    }
                    pipeline = this.parseActionPipelineSection();
                    break;
                case "project":
                    if (project !== null) {
                        throw this.error(sectionToken, `Duplicate @action section "${section}"`);
                    }
                    project = this.parseActionProjectSection();
                    break;
                default:
                    throw this.error(sectionToken, `Unknown @action section "${section}"`);
            }
            this.skipNewlines();
        }
        this.expect("RBRACE");
        if (pipeline === null) {
            throw this.error(start, `@action requires a pipeline section`);
        }
        return this.node("ActionExpr", {
            name: "@action",
            guard,
            pipeline,
            project,
        }, start);
    }
    parseActionGuardExpr() {
        if (this.check("KEYWORD", "@query")) {
            return this.parseGraphQueryExpr();
        }
        return this.parseBooleanExpr();
    }
    parseActionPipelineSection() {
        const pipeline = [];
        this.skipNewlines();
        while (this.match("ARROW")) {
            pipeline.push(this.parseActionPipelineStep());
            this.skipNewlines();
        }
        if (pipeline.length === 0) {
            throw this.error(this.peek(), "@action pipeline must contain at least one step");
        }
        return pipeline;
    }
    parseActionPipelineStep() {
        if (this.check("KEYWORD", "@loop")) {
            return this.parseLoopExpr();
        }
        return this.parseGraphPipelineStep();
    }
    parseGraphPipelineSection() {
        const pipeline = [];
        this.skipNewlines();
        while (this.match("ARROW")) {
            pipeline.push(this.parseGraphPipelineStep());
            this.skipNewlines();
        }
        if (pipeline.length === 0) {
            throw this.error(this.peek(), "Pipeline must contain at least one step");
        }
        return pipeline;
    }
    parseActionProjectSection() {
        return this.parseValueExpr();
    }
    parseCtxExpr(startToken) {
        const start = startToken ?? this.expect("KEYWORD", "@ctx");
        this.expect("LPAREN");
        const args = this.parseArguments();
        this.expect("RPAREN");
        return this.node("CtxExpr", {
            name: "@ctx",
            args,
        }, start);
    }
    parseProjectExpr(startToken) {
        const start = startToken ?? this.expect("KEYWORD", "@project");
        let projectionName = null;
        let syntax;
        let args;
        this.skipNewlines();
        if (this.checkType("IDENT") && !this.looksLikeNamedArgumentStart()) {
            projectionName = this.parseIdentifier();
            this.skipNewlines();
        }
        if (this.match("LPAREN")) {
            syntax = "inline";
            args = this.parseArguments();
            this.expect("RPAREN");
        }
        else if (this.match("LBRACE")) {
            syntax = "block";
            args = this.parseProjectBlockArguments();
            this.expect("RBRACE");
        }
        else {
            throw this.error(this.peek(), 'Expected "(" or "{" after @project');
        }
        return this.node("ProjectExpr", {
            name: "@project",
            syntax,
            projectionName,
            args,
        }, start);
    }
    parseReduceExpr(startToken) {
        const start = startToken ?? this.expect("KEYWORD", "@reduce");
        let syntax;
        let args;
        if (this.match("LPAREN")) {
            syntax = "inline";
            args = this.parseArguments();
            this.expect("RPAREN");
        }
        else if (this.match("LBRACE")) {
            syntax = "block";
            args = this.parseProjectBlockArguments();
            this.expect("RBRACE");
        }
        else {
            throw this.error(this.peek(), 'Expected "(" or "{" after @reduce');
        }
        return this.node("ReduceExpr", {
            name: "@reduce",
            syntax,
            args,
        }, start);
    }
    parseTerminalGraphExpr() {
        if (this.check("KEYWORD", "@project")) {
            return this.parseProjectExpr();
        }
        if (this.check("KEYWORD", "@reduce")) {
            return this.parseReduceExpr();
        }
        throw this.error(this.peek(), 'Expected @project(...) or @reduce(...) after "<>"');
    }
    parseProjectBlockArguments() {
        const args = [];
        this.skipNewlines();
        while (!this.checkType("RBRACE")) {
            const start = this.peek();
            if (!this.checkType("IDENT") || this.peekNext().type !== "COLON") {
                throw this.error(this.peek(), "@project block fields must use key: value syntax");
            }
            const key = this.parseIdentifier();
            this.expect("COLON");
            const value = this.parseValueExpr();
            args.push(this.node("Argument", { key, value }, start));
            if (this.match("COMMA")) {
                this.skipNewlines();
                continue;
            }
            if (this.checkType("RBRACE")) {
                break;
            }
            if (this.match("NEWLINE")) {
                this.skipNewlines();
                continue;
            }
            throw this.error(this.peek(), 'Expected newline, comma, or "}" in @project block');
        }
        return args;
    }
    parseArguments() {
        const args = [];
        this.skipNewlines();
        if (this.checkType("RPAREN"))
            return args;
        while (true) {
            this.skipNewlines();
            const start = this.peek();
            if (this.checkType("IDENT") && this.peekNext().type === "COLON") {
                const key = this.parseIdentifier();
                this.expect("COLON");
                const value = this.parseValueExpr();
                args.push(this.node("Argument", { key, value }, start));
            }
            else {
                const value = this.parseValueExpr();
                args.push(this.node("Argument", { key: null, value }, start));
            }
            this.skipNewlines();
            if (!this.match("COMMA"))
                break;
            this.skipNewlines();
        }
        this.skipNewlines();
        return args;
    }
    looksLikeNamedArgumentStart() {
        return this.checkType("IDENT") && this.peekNext().type === "COLON";
    }
    parseNodeCapture() {
        const start = this.expect("LANGLE");
        const shape = this.parseNodeShape();
        this.expect("RANGLE");
        return this.node("NodeCapture", {
            shape,
        }, start);
    }
    parseNodeShape() {
        if (this.looksLikeTraversalExpr()) {
            return this.parseTraversalExpr();
        }
        if (this.checkType("IDENT"))
            return this.parseIdentifier();
        if (this.checkType("STRING"))
            return this.parseStringLiteral();
        if (this.checkType("NUMBER"))
            return this.parseNumberLiteral();
        if (this.checkType("BOOLEAN"))
            return this.parseBooleanLiteral();
        if (this.checkType("LBRACE"))
            return this.parseObjectLiteral();
        throw this.error(this.peek(), "Expected node shape");
    }
    parseTraversalExpr() {
        const start = this.peek();
        const segments = [];
        const first = this.parseActionSegment();
        segments.push(first);
        while (this.match("DDOT")) {
            const context = this.parseIdentifier();
            this.expect("DDOT");
            const segment = this.parseActionSegment();
            segments.push(this.node("ContextLift", {
                context,
                segment,
            }, identToToken(context)));
        }
        return this.node("TraversalExpr", {
            segments,
        }, start);
    }
    parseActionSegment() {
        const start = this.peek();
        const from = this.parseTraversalValue();
        this.expect("DOT");
        const operator = this.parseIdentifier();
        this.expect("DOT");
        const to = this.parseTraversalValue();
        return this.node("ActionSegment", {
            from,
            operator,
            to,
        }, start);
    }
    parseTraversalValue() {
        if (this.checkType("IDENT"))
            return this.parseIdentifier();
        if (this.checkType("STRING"))
            return this.parseStringLiteral();
        if (this.checkType("NUMBER"))
            return this.parseNumberLiteral();
        if (this.checkType("BOOLEAN"))
            return this.parseBooleanLiteral();
        if (this.checkType("LANGLE"))
            return this.parseNodeCapture();
        if (this.checkType("LBRACE"))
            return this.parseObjectLiteral();
        throw this.error(this.peek(), "Expected traversal value");
    }
    parseObjectLiteral() {
        const start = this.expect("LBRACE");
        const properties = [];
        this.skipNewlines();
        while (!this.checkType("RBRACE")) {
            this.skipNewlines();
            const keyToken = this.peek();
            let key;
            if (this.checkType("IDENT")) {
                key = this.advance().value;
            }
            else if (this.checkType("STRING")) {
                key = stripQuotes(this.advance().value);
            }
            else {
                throw this.error(this.peek(), "Expected object key");
            }
            this.expect("COLON");
            const value = this.parseValueExpr();
            properties.push(this.node("ObjectProperty", {
                key,
                value,
            }, keyToken));
            this.skipNewlines();
            if (!this.match("COMMA"))
                break;
            this.skipNewlines();
        }
        this.skipNewlines();
        this.expect("RBRACE");
        return this.node("ObjectLiteral", {
            properties,
        }, start);
    }
    parseArrayLiteral() {
        const start = this.expect("LBRACKET");
        const elements = [];
        this.skipNewlines();
        while (!this.checkType("RBRACKET")) {
            this.skipNewlines();
            elements.push(this.parseValueExpr());
            this.skipNewlines();
            if (!this.match("COMMA"))
                break;
            this.skipNewlines();
        }
        this.skipNewlines();
        this.expect("RBRACKET");
        return this.node("ArrayLiteral", {
            elements,
        }, start);
    }
    parseBooleanExpr() {
        return this.parseOrExpr();
    }
    parseOrExpr() {
        let expr = this.parseAndExpr();
        while (this.matchLogical("||")) {
            const op = this.previous();
            const right = this.parseAndExpr();
            expr = this.node("BinaryBooleanExpr", {
                operator: "||",
                left: expr,
                right,
            }, op);
        }
        return expr;
    }
    parseAndExpr() {
        let expr = this.parseNotExpr();
        while (this.matchLogical("&&")) {
            const op = this.previous();
            const right = this.parseNotExpr();
            expr = this.node("BinaryBooleanExpr", {
                operator: "&&",
                left: expr,
                right,
            }, op);
        }
        return expr;
    }
    parseNotExpr() {
        if (this.matchLogical("!")) {
            const op = this.previous();
            const argument = this.parseNotExpr();
            return this.node("UnaryBooleanExpr", {
                operator: "!",
                argument,
            }, op);
        }
        return this.parseComparisonOrPrimary();
    }
    parseComparisonOrPrimary() {
        if (this.match("LPAREN")) {
            const start = this.previous();
            const expression = this.parseBooleanExpr();
            this.expect("RPAREN");
            return this.node("GroupedBooleanExpr", {
                expression,
            }, start);
        }
        const left = this.parseBooleanValue();
        if (this.matchComparison()) {
            const op = this.previous();
            const right = this.parseBooleanValue();
            return this.node("ComparisonExpr", {
                operator: op.value,
                left,
                right,
            }, op);
        }
        return left;
    }
    parseBooleanValue() {
        if (this.checkType("NUMBER") ||
            this.checkType("STRING") ||
            this.check("KEYWORD", "@derive.state") ||
            this.check("KEYWORD", "@derive.meta") ||
            this.check("KEYWORD", "@derive.count") ||
            this.check("KEYWORD", "@derive.edgeCount") ||
            this.check("KEYWORD", "@derive.exists") ||
            this.check("KEYWORD", "@derive.path") ||
            this.check("KEYWORD", "@derive.collect") ||
            this.check("KEYWORD", "@derive.sum") ||
            this.check("KEYWORD", "@derive.min") ||
            this.check("KEYWORD", "@derive.max") ||
            this.check("KEYWORD", "@derive.avg") ||
            this.check("KEYWORD", "@derive.abs") ||
            (this.checkType("IDENT") &&
                (this.peek().value === "current" || this.peek().value === "previous"))) {
            return this.parseDeriveExpr();
        }
        if (this.checkType("IDENT")) {
            const ident = this.parseIdentifier();
            if (this.match("DOT")) {
                const property = this.parseIdentifier();
                const chain = [property];
                while (this.match("DOT")) {
                    chain.push(this.parseIdentifier());
                }
                return this.node("PropertyAccess", {
                    object: ident,
                    property,
                    chain,
                }, identToToken(ident));
            }
            return ident;
        }
        if (this.checkType("STRING"))
            return this.parseStringLiteral();
        if (this.checkType("NUMBER"))
            return this.parseNumberLiteral();
        if (this.checkType("BOOLEAN"))
            return this.parseBooleanLiteral();
        if (this.checkType("REGEX"))
            return this.parseRegexLiteral();
        throw this.error(this.peek(), "Expected boolean value");
    }
    parseIdentifier() {
        const token = this.expectType("IDENT");
        return this.node("Identifier", {
            name: token.value,
        }, token);
    }
    parseStringLiteral() {
        const token = this.expectType("STRING");
        return this.node("StringLiteral", {
            value: stripQuotes(token.value),
            raw: token.value,
        }, token);
    }
    parseNumberLiteral() {
        const token = this.expectType("NUMBER");
        return this.node("NumberLiteral", {
            value: Number(token.value),
            raw: token.value,
        }, token);
    }
    parseBooleanLiteral() {
        const token = this.expectType("BOOLEAN");
        return this.node("BooleanLiteral", {
            value: token.value === "true",
            raw: token.value,
        }, token);
    }
    parseRegexLiteral() {
        const token = this.expectType("REGEX");
        const { pattern, flags } = splitRegexLiteral(token.value);
        return this.node("RegexLiteral", {
            pattern,
            flags,
            raw: token.value,
        }, token);
    }
    parseWildcard() {
        const token = this.expectType("WILDCARD");
        return this.node("Wildcard", {
            raw: "_",
        }, token);
    }
    /* =========================
       Helpers
       ========================= */
    captureBraceBodyRaw() {
        const start = this.expect("LBRACE");
        let depth = 1;
        let raw = "{";
        while (!this.isAtEnd() && depth > 0) {
            const token = this.advance();
            if (token.type === "LBRACE")
                depth += 1;
            if (token.type === "RBRACE")
                depth -= 1;
            raw += token.value;
        }
        if (depth !== 0) {
            throw this.error(start, "Unterminated action body");
        }
        return raw;
    }
    looksLikeTraversalExpr() {
        if (!this.isTraversalValueStart(this.peek()))
            return false;
        if (this.peekNext().type !== "DOT")
            return false;
        if (this.peekN(2).type !== "IDENT")
            return false;
        if (this.peekN(3).type !== "DOT")
            return false;
        return this.isTraversalValueStart(this.peekN(4));
    }
    isTraversalValueStart(token) {
        return (token.type === "IDENT" ||
            token.type === "STRING" ||
            token.type === "NUMBER" ||
            token.type === "BOOLEAN" ||
            token.type === "LANGLE" ||
            token.type === "LBRACE");
    }
    looksLikeEdgeExpr() {
        return (this.peek().type === "IDENT" &&
            this.peekNext().type === "COLON" &&
            this.peekN(2).type === "STRING" &&
            this.peekN(3).type === "COLON" &&
            this.peekN(4).type === "IDENT");
    }
    isGraphPipelineStart() {
        return (this.peek().type === "IDENT" &&
            this.peekNext().type === "COLON_EQUALS" &&
            this.peekN(2).type === "KEYWORD" &&
            (this.peekN(2).value === "@seed" || this.peekN(2).value === "@compose"));
    }
    // Returns true when the cursor is at `IDENT` and the next non-newline token
    // is a PROJECT (`<>`) token, indicating `name = graphId <> @project(...)`.
    isGraphProjectionExprStart() {
        if (!this.checkType("IDENT"))
            return false;
        let i = 1;
        while (this.peekN(i).type === "NEWLINE")
            i++;
        return this.peekN(i).type === "PROJECT";
    }
    parseGraphSource() {
        if (this.match("KEYWORD", "@seed")) {
            const token = this.previous();
            return this.node("SeedSource", {
                name: "@seed",
            }, token);
        }
        if (this.match("KEYWORD", "@compose")) {
            const token = this.previous();
            this.expect("LPAREN");
            this.skipNewlines();
            this.expect("LBRACKET");
            this.skipNewlines();
            const assets = [];
            while (!this.checkType("RBRACKET")) {
                assets.push(this.parseIdentifier());
                this.skipNewlines();
                if (this.match("COMMA")) {
                    this.skipNewlines();
                    continue;
                }
                break;
            }
            this.skipNewlines();
            this.expect("RBRACKET");
            this.skipNewlines();
            this.expect("COMMA");
            this.skipNewlines();
            this.expectIdentifierValue("merge");
            this.expect("COLON");
            const merge = this.parseIdentifier();
            this.skipNewlines();
            this.expect("RPAREN");
            return this.node("ComposeExpr", {
                name: "@compose",
                assets,
                merge,
            }, token);
        }
        throw this.error(this.peek(), `Expected graph source @seed or @compose(...)`);
    }
    isSystemRelationStart() {
        if (this.peek().type !== "IDENT")
            return false;
        if (this.peekNext().type === "TCOLON" && this.peekN(2).type === "IDENT") {
            return true;
        }
        return (this.peekNext().type === "COLON" &&
            this.peekN(2).type === "STRING" &&
            this.peekN(3).type === "TCOLON" &&
            this.peekN(4).type === "IDENT");
    }
    matchComparison() {
        const token = this.peek();
        if (!["EQ2", "EQ3", "NEQ2", "NEQ3", "LTE", "GTE", "LANGLE", "RANGLE"].includes(token.type)) {
            return false;
        }
        this.current += 1;
        return true;
    }
    matchLogical(expected) {
        const token = this.peek();
        if (expected === "&&" && token.type === "AND") {
            this.current += 1;
            return true;
        }
        if (expected === "||" && token.type === "OR") {
            this.current += 1;
            return true;
        }
        if (expected === "!" && token.type === "BANG") {
            this.current += 1;
            return true;
        }
        return false;
    }
    skipNewlines() {
        while (this.match("NEWLINE")) {
            // consume
        }
    }
    expect(type, value) {
        const token = this.peek();
        if (token.type !== type) {
            throw this.error(token, `Expected ${value ?? type}, got ${token.type}`);
        }
        if (value !== undefined && token.value !== value) {
            throw this.error(token, `Expected ${value}, got ${token.value}`);
        }
        this.current += 1;
        return token;
    }
    expectType(type) {
        return this.expect(type);
    }
    match(type, value) {
        if (!this.checkType(type))
            return false;
        if (value !== undefined && this.peek().value !== value)
            return false;
        this.current += 1;
        return true;
    }
    check(type, value) {
        if (!this.checkType(type))
            return false;
        if (value !== undefined && this.peek().value !== value)
            return false;
        return true;
    }
    checkType(type) {
        if (this.isAtEnd())
            return type === "EOF";
        return this.peek().type === type;
    }
    checkTypeIdentifierValue(value) {
        return this.checkType("IDENT") && this.peek().value === value;
    }
    expectIdentifierValue(value) {
        const token = this.expectType("IDENT");
        if (token.value !== value) {
            throw this.error(token, `Expected ${value}, got ${token.value}`);
        }
        return token;
    }
    advance() {
        if (!this.isAtEnd())
            this.current += 1;
        return this.tokens[this.current - 1];
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    previousOrPeek() {
        return this.current > 0 ? this.previous() : this.peek();
    }
    peek() {
        return this.tokens[this.current];
    }
    peekNext() {
        return this.peekN(1);
    }
    peekN(offset) {
        return this.tokens[Math.min(this.current + offset, this.tokens.length - 1)];
    }
    isAtEnd() {
        return this.peek().type === "EOF";
    }
    error(token, message) {
        return new ParseError(message, token);
    }
    warn(token, message) {
        console.warn(`[TAT parse warning] ${message} at ${token.line}:${token.column}`);
    }
    node(type, props, token) {
        return {
            type,
            ...props,
            span: {
                start: token.index,
                end: token.index + token.value.length,
                line: token.line,
                column: token.column,
            },
        };
    }
}
/* =========================
   Small utilities
   ========================= */
function stripQuotes(raw) {
    if (raw.length >= 2) {
        return raw.slice(1, -1);
    }
    return raw;
}
function splitRegexLiteral(raw) {
    const lastSlash = raw.lastIndexOf("/");
    if (lastSlash <= 0) {
        return { pattern: raw, flags: "" };
    }
    return {
        pattern: raw.slice(1, lastSlash),
        flags: raw.slice(lastSlash + 1),
    };
}
function identToToken(node) {
    return {
        type: "IDENT",
        value: node.name,
        line: node.span?.line ?? 0,
        column: node.span?.column ?? 0,
        index: node.span?.start ?? 0,
    };
}
function atomToToken(node) {
    return {
        type: "IDENT",
        value: node.type,
        line: node.span?.line ?? 0,
        column: node.span?.column ?? 0,
        index: node.span?.start ?? 0,
    };
}
