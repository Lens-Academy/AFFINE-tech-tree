import { describe, expect, it } from "vitest";
import {
  assignManualPositions,
  countCrossings,
  NODE_W,
  PAD,
  type Edge,
  type GraphTopic,
} from "./layout";

const STEP = NODE_W + PAD;

function byId(topics: GraphTopic[], edges: Edge[]) {
  const positioned = assignManualPositions(topics, edges);
  return new Map(positioned.map((n) => [n.id, n]));
}

function col(x: number) {
  return Math.round(x / STEP);
}

function row(y: number) {
  return Math.round(y / (30 + PAD));
}

describe("level assignment", () => {
  it("places a linear chain at increasing levels", () => {
    const topics: GraphTopic[] = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ];
    const edges: Edge[] = [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ];
    const m = byId(topics, edges);
    expect(col(m.get(1)!.x)).toBe(0);
    expect(col(m.get(2)!.x)).toBe(1);
    expect(col(m.get(3)!.x)).toBe(2);
  });

  it("roots (no parents) are at level 0", () => {
    const topics: GraphTopic[] = [
      { id: 1, name: "Root A" },
      { id: 2, name: "Root B" },
      { id: 3, name: "Child" },
    ];
    const edges: Edge[] = [
      { from: 1, to: 3 },
      { from: 2, to: 3 },
    ];
    const m = byId(topics, edges);
    expect(col(m.get(1)!.x)).toBe(0);
    expect(col(m.get(2)!.x)).toBe(0);
    expect(col(m.get(3)!.x)).toBe(1);
  });
});

describe("root ordering", () => {
  it("places higher-outdegree root above lower-outdegree root", () => {
    const topics: GraphTopic[] = [
      { id: 1, name: "Big" },
      { id: 2, name: "Small" },
      { id: 3, name: "C1" },
      { id: 4, name: "C2" },
      { id: 5, name: "C3" },
    ];
    const edges: Edge[] = [
      { from: 1, to: 3 },
      { from: 1, to: 4 },
      { from: 2, to: 5 },
    ];
    const m = byId(topics, edges);
    expect(m.get(1)!.y).toBeLessThan(m.get(2)!.y);
  });
});

describe("sub-groups", () => {
  it("each root's children start at the root's y position", () => {
    const topics: GraphTopic[] = [
      { id: 1, name: "R1" },
      { id: 2, name: "R2" },
      { id: 3, name: "A" },
      { id: 4, name: "B" },
      { id: 5, name: "C" },
    ];
    const edges: Edge[] = [
      { from: 1, to: 3 },
      { from: 1, to: 4 },
      { from: 2, to: 5 },
    ];
    const m = byId(topics, edges);
    // R1's children (A, B) should be near R1's row
    expect(row(m.get(3)!.y)).toBe(row(m.get(1)!.y));
    // R2's child (C) should be near R2's row
    expect(row(m.get(5)!.y)).toBe(row(m.get(2)!.y));
  });

  it("has a gap between root sub-groups", () => {
    const topics: GraphTopic[] = [
      { id: 1, name: "R1" },
      { id: 2, name: "R2" },
      { id: 3, name: "A" },
      { id: 4, name: "B" },
      { id: 5, name: "C" },
    ];
    const edges: Edge[] = [
      { from: 1, to: 3 },
      { from: 1, to: 4 },
      { from: 2, to: 5 },
    ];
    const m = byId(topics, edges);
    const r1Bottom = Math.max(row(m.get(3)!.y), row(m.get(4)!.y));
    const r2Top = row(m.get(2)!.y);
    expect(r2Top).toBeGreaterThan(r1Bottom);
  });
});

// Real data from the AFFINE tech tree Turso DB (2026-03-21)
const REAL_TOPICS: GraphTopic[] = [
  { id: 1, name: "Ontological Crisis" },
  { id: 2, name: "Consequentialist Cognition / Agency" },
  { id: 3, name: "Reflective Stability / Tiling" },
  { id: 5, name: "Intensional vs extensional models" },
  { id: 6, name: "Coherence" },
  { id: 7, name: "Instrumental Convergence" },
  { id: 8, name: "Coherent Extrapolated Volition" },
  { id: 9, name: "PreDCA" },
  { id: 10, name: "Planning/Prediction Duality?" },
  { id: 11, name: "Outer / Inner Alignment" },
  { id: 12, name: "Staying focused on the problem" },
  { id: 16, name: "Acausal" },
  { id: 17, name: "KANSI" },
  { id: 18, name: "Obfuscation / steganography" },
  { id: 20, name: "Selection and Control" },
  { id: 21, name: "Goodhart" },
  { id: 23, name: "Instrumental/Terminal" },
  { id: 24, name: "Value formation etc" },
  { id: 26, name: "Deconfusion" },
  { id: 27, name: "Proper Use of Language" },
  { id: 28, name: "Natural Abstraction" },
  { id: 29, name: "Value" },
  { id: 30, name: "Conceptual refactoring" },
  { id: 31, name: "Optimization" },
  { id: 32, name: "Multiple Agency" },
  { id: 33, name: "Substitution hazards" },
  { id: 34, name: "Utility" },
  { id: 35, name: "Recursive self-improvement" },
  { id: 36, name: "Perils of Predictors" },
  { id: 37, name: "Corrigibility" },
  { id: 38, name: "Orthogonality & Obliqueness" },
  { id: 39, name: "Nearest unblocked strategy" },
  { id: 41, name: "Ontology" },
  { id: 42, name: "Decision theory" },
  { id: 43, name: "Infra-Bayesianism" },
  { id: 44, name: "Imprecise Probability" },
  { id: 45, name: "Probability" },
  { id: 46, name: "Anthropics" },
  { id: 47, name: "Reinforcement Learning" },
  { id: 48, name: "Mesa-Optimization" },
  { id: 49, name: "Impact Regularization" },
  { id: 54, name: "The Pointers Problem" },
  { id: 55, name: "Wireheading" },
  { id: 57, name: "Performative Prediction" },
  { id: 59, name: "Deep Deceptiveness" },
  { id: 62, name: "Deception" },
  { id: 63, name: "Prediction" },
  { id: 64, name: "Value inversion" },
];

const REAL_EDGES: Edge[] = [
  { from: 2, to: 10 },
  { from: 2, to: 32 },
  { from: 2, to: 36 },
  { from: 2, to: 37 },
  { from: 2, to: 59 },
  { from: 6, to: 8 },
  { from: 8, to: 46 },
  { from: 11, to: 48 },
  { from: 21, to: 18 },
  { from: 21, to: 39 },
  { from: 21, to: 49 },
  { from: 21, to: 54 },
  { from: 21, to: 55 },
  { from: 23, to: 7 },
  { from: 23, to: 35 },
  { from: 23, to: 38 },
  { from: 27, to: 5 },
  { from: 29, to: 24 },
  { from: 29, to: 64 },
  { from: 31, to: 2 },
  { from: 31, to: 48 },
  { from: 33, to: 12 },
  { from: 34, to: 42 },
  { from: 35, to: 3 },
  { from: 35, to: 17 },
  { from: 41, to: 1 },
  { from: 41, to: 26 },
  { from: 41, to: 28 },
  { from: 41, to: 30 },
  { from: 42, to: 2 },
  { from: 42, to: 3 },
  { from: 42, to: 6 },
  { from: 42, to: 16 },
  { from: 42, to: 37 },
  { from: 42, to: 46 },
  { from: 43, to: 9 },
  { from: 44, to: 43 },
  { from: 45, to: 42 },
  { from: 45, to: 44 },
  { from: 46, to: 16 },
  { from: 47, to: 43 },
  { from: 57, to: 36 },
  { from: 62, to: 18 },
  { from: 62, to: 59 },
  { from: 63, to: 10 },
  { from: 63, to: 36 },
  { from: 63, to: 57 },
];

describe("real data regression", () => {
  it("places all topics", () => {
    const positioned = assignManualPositions(REAL_TOPICS, REAL_EDGES);
    expect(positioned.length).toBe(REAL_TOPICS.length);
  });

  it("uses level 0 for root nodes with no prerequisites", () => {
    const m = byId(REAL_TOPICS, REAL_EDGES);
    for (const id of [45, 41, 21, 63, 62, 31, 23, 11, 29, 33, 27, 47, 34]) {
      expect(col(m.get(id)!.x)).toBe(0);
    }
  });

  it("Decision theory is at level 1 (child of Probability)", () => {
    const m = byId(REAL_TOPICS, REAL_EDGES);
    expect(col(m.get(42)!.x)).toBe(1);
  });

  it("crossings are bounded", () => {
    const positioned = assignManualPositions(REAL_TOPICS, REAL_EDGES);
    const crossings = countCrossings(positioned, REAL_EDGES);
    expect(crossings).toBeLessThanOrEqual(8);
  });

  it("no two nodes overlap (same x and y)", () => {
    const positioned = assignManualPositions(REAL_TOPICS, REAL_EDGES);
    const coords = new Set<string>();
    for (const n of positioned) {
      const key = `${n.x},${n.y}`;
      expect(coords.has(key)).toBe(false);
      coords.add(key);
    }
  });
});
