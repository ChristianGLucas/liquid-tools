import { LiquidRenderRequest } from '../gen/messages_pb';
import { render } from './render';
import { ctx, DOCUMENTED_EXAMPLES } from './testkit';
import { MAX_TEMPLATE_BYTES, MAX_DATA_JSON_BYTES, MAX_PARTIAL_BYTES, MAX_PARTIALS_TOTAL_BYTES } from './lib';

function req(template: string, dataJson = '', partials: Record<string, string> = {}): LiquidRenderRequest {
  const input = new LiquidRenderRequest();
  input.setTemplate(template);
  input.setDataJson(dataJson);
  const map = input.getPartialsMap();
  for (const [k, v] of Object.entries(partials)) map.set(k, v);
  return input;
}

describe('Render', () => {
  it('renders every documented Shopify Liquid example correctly (independent oracle)', async () => {
    // INDEPENDENT ORACLE: DOCUMENTED_EXAMPLES (testkit.ts) is transcribed
    // from Shopify's own official Liquid docs, not computed by calling this
    // implementation.
    for (const { template, data, expected } of DOCUMENTED_EXAMPLES) {
      const result = await render(ctx, req(template, JSON.stringify(data)));
      expect(result.getOk()).toBe(true);
      expect(result.getOutput()).toBe(expected);
    }
  });

  it('renders an undefined variable as empty text (lax default)', async () => {
    const result = await render(ctx, req('Hello {{ missing }}!', '{}'));
    expect(result.getOk()).toBe(true);
    expect(result.getOutput()).toBe('Hello !');
  });

  it('passes a value through unchanged for an undefined filter (lax default)', async () => {
    const result = await render(ctx, req('{{ 1 | nope }}', '{}'));
    expect(result.getOk()).toBe(true);
    expect(result.getOutput()).toBe('1');
  });

  it('resolves {% include %} only from the partials map, never the filesystem', async () => {
    const result = await render(ctx, req('{% include "header" %}, {{ name }}', '{"name":"World"}', {
      header: 'Hi {{ name }}',
    }));
    expect(result.getOk()).toBe(true);
    expect(result.getOutput()).toBe('Hi World, World');
  });

  it('a path-traversal-shaped {% include %} name is a structured error, never a filesystem read', async () => {
    const result = await render(ctx, req('{% include "../../../../etc/passwd" %}', '{}'));
    expect(result.getOk()).toBe(false);
    // LiquidJS wraps the sandbox's "no such partial" as its own RenderError
    // (lookup failure), which this package classifies as render_error.
    expect(result.getError()!.getKind()).toBe('render_error');
    expect(result.getError()!.getMessage()).not.toMatch(/root:|bin\/bash/); // never actual file contents
  });

  it('rejects malformed data_json as a structured invalid_input error, not a crash', async () => {
    const result = await render(ctx, req('{{ x }}', '{not json'));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('invalid_input');
  });

  it('rejects a non-object top-level data_json (array) as invalid_input', async () => {
    const result = await render(ctx, req('{{ x }}', '[1,2,3]'));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('invalid_input');
  });

  it('reports a malformed template as a structured parse_error with line/col, not a crash', async () => {
    const result = await render(ctx, req('Hello {% if x %}unterminated', '{}'));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('parse_error');
    expect(result.getError()!.getLine()).toBeGreaterThan(0);
  });

  it('rejects an oversized template as a structured limit_exceeded error, not a crash', async () => {
    const huge = '{{ "x" }}'.repeat(Math.ceil(MAX_TEMPLATE_BYTES / 9) + 100);
    const result = await render(ctx, req(huge, '{}'));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('limit_exceeded');
  });

  it('rejects an oversized data_json as a structured limit_exceeded error, not a crash', async () => {
    // Regression: MAX_DATA_JSON_BYTES was raised 256 KiB -> 8 MiB in 0.1.1;
    // the bound itself (checked before JSON.parse) must still hold.
    const huge = 'x'.repeat(MAX_DATA_JSON_BYTES + 100);
    const result = await render(ctx, req('{{ x }}', huge));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('limit_exceeded');
  });

  it('rejects a single oversized partial as a structured limit_exceeded error', async () => {
    // Regression: MAX_PARTIAL_BYTES was raised 128 KiB -> 1 MiB in 0.1.1.
    const huge = 'x'.repeat(MAX_PARTIAL_BYTES + 100);
    const result = await render(ctx, req('{% include "big" %}', '{}', { big: huge }));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('limit_exceeded');
  });

  it('rejects partials whose combined size exceeds the total-partials cap even though each is individually within bounds', async () => {
    // Regression: in 0.1.1 the total-partials-size cap was decoupled from
    // MAX_OUTPUT_BYTES into its own MAX_PARTIALS_TOTAL_BYTES constant — make
    // sure it is still enforced independently of the per-partial cap.
    const each = Math.floor(MAX_PARTIALS_TOTAL_BYTES / 3) + 1000; // < MAX_PARTIAL_BYTES, but 3x > MAX_PARTIALS_TOTAL_BYTES
    expect(each).toBeLessThan(MAX_PARTIAL_BYTES);
    const partials = { a: 'x'.repeat(each), b: 'x'.repeat(each), c: 'x'.repeat(each) };
    const result = await render(ctx, req('{% include "a" %}', '{}', partials));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('limit_exceeded');
  });

  it('bounds a pathological range-loop bomb regardless of data size', async () => {
    // The loop bound lives in the TEMPLATE, not data_json — a small
    // data_json cannot be used to detect or defeat this, so the engine's
    // own memory/render/template-count guards must catch it. TEMPLATE_RENDER_LIMIT
    // is 500,000 nodes and RENDER_LIMIT_MS is 8s (both scaled up from the
    // ~1 MiB-ingress-era defaults in 0.1.1), so this now takes longer to
    // trip than it used to — give it a generous test timeout.
    const result = await render(ctx, req('{% for i in (1..100000000000) %}{{ i }}{% endfor %}', '{}'));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('limit_exceeded');
  }, 20000);

  it('bounds a circular {% include %} recursion instead of hanging', async () => {
    const result = await render(
      ctx,
      req('{% include "a" %}', '{}', { a: '{% include "b" %}', b: '{% include "a" %}' })
    );
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('limit_exceeded');
  }, 20000);

  it('rejects a small template whose loop would render an oversized output, as a structured error', async () => {
    // A tiny template + tiny data_json (well under both byte caps) can still
    // expand into a huge output via a template-internal loop bound — this
    // must be caught by checkOutputBytes (MAX_OUTPUT_BYTES = 12 MiB) after
    // render, not by first requiring an oversized request. 300,000
    // iterations of a 50-byte literal is comfortably under
    // TEMPLATE_RENDER_LIMIT (500,000 nodes) — so it's the output-byte guard,
    // not the node-count guard, that must catch this — while producing
    // ~14.3 MiB of output, over the 12 MiB output cap.
    const fifty = '0123456789'.repeat(5);
    const result = await render(ctx, req(`{% for i in (1..300000) %}${fifty}{% endfor %}`, '{}'));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('limit_exceeded');
  }, 20000);

  it('is deterministic: the same input renders the same output on repeated calls', async () => {
    const input = req('{{ a }}-{{ b | upcase }}', '{"a":"x","b":"y"}');
    const r1 = await render(ctx, input);
    const r2 = await render(ctx, input);
    expect(r1.getOutput()).toBe(r2.getOutput());
    expect(r1.getOutput()).toBe('x-Y');
  });
});
