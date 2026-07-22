// Shared test context for liquid-tools node unit tests. Not a node and not
// a test file (no describe/it), so it is neither registered as a node nor
// collected by jest.
import { AxiomContext, AxiomLogger, AxiomSecrets, AxiomReflection, AxiomMutation } from '../gen/axiomContext';

const reflection: AxiomReflection = {
  flow: {
    nodes: [],
    edges: [],
    loopEdges: [],
    position: { currentInstance: 0, depth: 0, loopIterations: {}, subflowStackGraphIds: [] },
    graphId: '',
  },
};

const mutation: AxiomMutation = {
  flow: {
    addNode: (_p: string, _v: string) => 0,
    addEdge: (_s: number, _d: number) => {},
  },
};

export const ctx: AxiomContext = {
  log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } satisfies AxiomLogger,
  secrets: { get: (_n: string): [string, boolean] => ['', false] } satisfies AxiomSecrets,
  executionId: 'test-execution-id',
  flowId: 'test-flow-id',
  tenantId: 'test-tenant-id',
  reflection,
  mutation,
};

/**
 * INDEPENDENT ORACLES — worked examples transcribed verbatim from Shopify's
 * own official Liquid documentation (https://shopify.dev/docs/api/liquid),
 * not computed by calling this package's implementation. Liquid is a
 * language spec, not a library API we can cross-check against a second
 * implementation, so the spec's own documented examples are the oracle,
 * exactly as duration-tools uses the ISO 8601 spec's own worked example.
 */
export const DOCUMENTED_EXAMPLES = [
  // https://shopify.dev/docs/api/liquid/filters/upcase
  { template: '{{ "Parker Moore" | upcase }}', data: {}, expected: 'PARKER MOORE' },
  // https://shopify.dev/docs/api/liquid/filters/capitalize
  { template: '{{ "my great title" | capitalize }}', data: {}, expected: 'My great title' },
  // https://shopify.dev/docs/api/liquid/filters/truncate (default omission "...")
  {
    template: '{{ "Ground control to Major Tom." | truncate: 20 }}',
    data: {},
    expected: 'Ground control to...',
  },
  // https://shopify.dev/docs/api/liquid/filters/plus
  { template: '{{ 4 | plus: 2 }}', data: {}, expected: '6' },
  // https://shopify.dev/docs/api/liquid/tags/for (basic loop over an array)
  {
    template: '{% for p in products %}{{ p }} {% endfor %}',
    data: { products: ['hat', 'shirt', 'shoes'] },
    expected: 'hat shirt shoes ',
  },
  // https://shopify.dev/docs/api/liquid/tags/if-else
  {
    template: '{% if product.title == "Awesome Shoes" %}These shoes are awesome!{% endif %}',
    data: { product: { title: 'Awesome Shoes' } },
    expected: 'These shoes are awesome!',
  },
] as const;
