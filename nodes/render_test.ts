import { LiquidRenderRequest } from '../gen/messages_pb';
import { render } from './render';
import { ctx, DOCUMENTED_EXAMPLES } from './testkit';

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

  it('renders a large-but-legitimate loop output in full, with no self-imposed output cap', async () => {
    // Output size scales with template loops; this package no longer caps
    // it — that is the platform's job. 300,000 iterations of a 50-byte
    // literal produces ~14.3 MiB of output; confirm it comes back whole.
    const fifty = '0123456789'.repeat(5);
    const result = await render(ctx, req(`{% for i in (1..300000) %}${fifty}{% endfor %}`, '{}'));
    expect(result.getOk()).toBe(true);
    expect(result.getOutput().length).toBe(300000 * 50);
  }, 20000);

  it('is deterministic: the same input renders the same output on repeated calls', async () => {
    const input = req('{{ a }}-{{ b | upcase }}', '{"a":"x","b":"y"}');
    const r1 = await render(ctx, input);
    const r2 = await render(ctx, input);
    expect(r1.getOutput()).toBe(r2.getOutput());
    expect(r1.getOutput()).toBe('x-Y');
  });
});
