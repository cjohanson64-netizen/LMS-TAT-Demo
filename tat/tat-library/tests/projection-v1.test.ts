import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { tokenize } from "../lexer/tokenize.ts";
import { parse } from "../parser/parse.ts";
import { executeProgram } from "../runtime/executeProgram.ts";

function runTat(source: string) {
  const tokens = tokenize(source);
  const ast = parse(tokens);
  return executeProgram(ast);
}

function getProjection(result: any, name: string) {
  const projections = result?.state?.projections ?? result?.debug?.projections;

  if (!projections) {
    return undefined;
  }

  if (projections instanceof Map) {
    if (projections.has(name)) {
      return projections.get(name);
    }

    if (projections.has("graph")) {
      return projections.get("graph");
    }

    if (projections.size === 1) {
      return [...projections.values()][0];
    }

    return undefined;
  }

  return projections[name] ?? projections.graph;
}

describe("@projection + @select v1", () => {
  it("@select.node works with @derive.state", () => {
    const source = `
viewer_node = <{}>
assignment_node = <{}>

@seed:
  nodes: [viewer_node, assignment_node]
  root: assignment_node

@projection assignment_status {
  focus: assignment_node

  contract: {
    nodeId: required,
    viewerRole: required
  }

  fields: {
    nodeId: @select.node(focus),
    viewerRole: @derive.state {
      node: focus
      key: "viewerRole"
    }
  }
}

graph := @seed
  -> @graft.state(assignment_node, "viewerRole", "STUDENT")
  <> @project assignment_status {
    focus: assignment_node
  }
`;

    const result = runTat(source);
    const p = getProjection(result, "assignment_status");
    assert.ok(p, "Projection result was not found in state.projections");

    assert.equal(p.nodeId, "assignment_node");
    assert.equal(p.viewerRole, "STUDENT");
  });

  it("@select.targets returns node refs", () => {
    const source = `
student_node = <{}>
submission_node = <{}>

@seed:
  nodes: [student_node, submission_node]
  edges: [
    e := [student_node : "submitted" : submission_node]
  ]
  root: student_node

@projection test {
  focus: student_node

  contract: {
    submissions: required,
    count: required
  }

  fields: {
    submissions: @select.targets(focus, "submitted"),
    count: @derive.count(submissions)
  }
}

graph := @seed
  <> @project test {
    focus: student_node
  }
`;

    const result = runTat(source);
    const p = getProjection(result, "test");
    assert.ok(p, "Projection result was not found in state.projections");

    assert.deepEqual(p.submissions, ["submission_node"]);
    assert.equal(p.count, 1);
  });

  it("@select.sources returns node refs", () => {
    const source = `
assignment_node = <{}>
submission_node = <{}>

@seed:
  nodes: [assignment_node, submission_node]
  edges: [
    e := [submission_node : "forAssignment" : assignment_node]
  ]
  root: assignment_node

@projection test {
  focus: assignment_node

  contract: {
    submissions: required,
    count: required
  }

  fields: {
    submissions: @select.sources(focus, "forAssignment"),
    count: @derive.count(submissions)
  }
}

graph := @seed
  <> @project test {
    focus: assignment_node
  }
`;

    const result = runTat(source);
    const p = getProjection(result, "test");
    assert.ok(p, "Projection result was not found in state.projections");

    assert.deepEqual(p.submissions, ["submission_node"]);
    assert.equal(p.count, 1);
  });

  it("@select.first returns null", () => {
    const source = `
assignment_node = <{}>

@seed:
  nodes: [assignment_node]
  root: assignment_node

@projection test {
  focus: assignment_node

  contract: {
    first: required
  }

  fields: {
    first: @select.first(@select.sources(focus, "forAssignment"))
  }
}

graph := @seed
  <> @project test {
    focus: assignment_node
  }
`;

    const result = runTat(source);
    const p = getProjection(result, "test");
    assert.ok(p, "Projection result was not found in state.projections");

    assert.equal(p.first, null);
  });

  it("@select.one throws on empty", () => {
    const source = `
assignment_node = <{}>

@seed:
  nodes: [assignment_node]
  root: assignment_node

@projection test {
  focus: assignment_node

  contract: {
    one: required
  }

  fields: {
    one: @select.one(@select.sources(focus, "forAssignment"))
  }
}

graph := @seed
  <> @project test {
    focus: assignment_node
  }
`;

    assert.throws(() => runTat(source));
  });

  it("contract validation fails", () => {
    const source = `
assignment_node = <{}>

@seed:
  nodes: [assignment_node]
  root: assignment_node

@projection test {
  focus: assignment_node

  contract: {
    node: required,
    status: required
  }

  fields: {
    node: @select.node(focus)
  }
}

graph := @seed
  <> @project test {
    focus: assignment_node
  }
`;

    assert.throws(() => runTat(source));
  });

  it("earlier fields are available to later fields", () => {
    const source = `
assignment_node = <{}>
submission_a = <{}>
submission_b = <{}>

@seed:
  nodes: [assignment_node, submission_a, submission_b]
  edges: [
    e1 := [submission_a : "forAssignment" : assignment_node],
    e2 := [submission_b : "forAssignment" : assignment_node]
  ]
  root: assignment_node

@projection test {
  focus: assignment_node

  contract: {
    submissions: required,
    summary: required
  }

  fields: {
    submissions: @select.sources(focus, "forAssignment"),
    summary: {
      count: @derive.count(submissions)
    }
  }
}

graph := @seed
  <> @project test {
    focus: assignment_node
  }
`;

    const result = runTat(source);
    const p = getProjection(result, "test");
    assert.ok(p);

    assert.deepEqual(p.submissions, ["submission_a", "submission_b"]);
    assert.equal(p.summary.count, 2);
  });

  it("@select.one throws on multiple results", () => {
    const source = `
assignment_node = <{}>
submission_a = <{}>
submission_b = <{}>

@seed:
  nodes: [assignment_node, submission_a, submission_b]
  edges: [
    e1 := [submission_a : "forAssignment" : assignment_node],
    e2 := [submission_b : "forAssignment" : assignment_node]
  ]
  root: assignment_node

@projection test {
  focus: assignment_node

  contract: {
    one: required
  }

  fields: {
    one: @select.one(@select.sources(focus, "forAssignment"))
  }
}

graph := @seed
  <> @project test {
    focus: assignment_node
  }
`;

    assert.throws(() => runTat(source));
  });
});
