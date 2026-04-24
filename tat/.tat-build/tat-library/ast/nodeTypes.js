/* =========================
   Type Guards
   ========================= */
export function isIdentifierNode(node) {
    return !!node && typeof node === "object" && node.type === "Identifier";
}
export function isNodeCaptureNode(node) {
    return !!node && typeof node === "object" && node.type === "NodeCapture";
}
export function isTraversalExprNode(node) {
    return !!node && typeof node === "object" && node.type === "TraversalExpr";
}
export function isMatchExprNode(node) {
    return !!node && typeof node === "object" && node.type === "MatchExpr";
}
export function isPathExprNode(node) {
    return !!node && typeof node === "object" && node.type === "PathExpr";
}
export function isWhyExprNode(node) {
    return !!node && typeof node === "object" && node.type === "WhyExpr";
}
export function isHowExprNode(node) {
    return !!node && typeof node === "object" && node.type === "HowExpr";
}
export function isSeedEdgeBindingNode(node) {
    return !!node && typeof node === "object" && node.type === "SeedEdgeBinding";
}
