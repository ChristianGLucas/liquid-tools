import { LiquidRenderRequest } from '../gen/messages_pb';
import { renderStrict } from './render_strict';
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

describe('RenderStrict', () => {
  it('renders every documented Shopify Liquid example identically to Render when nothing is undefined', async () => {
    // INDEPENDENT ORACLE: DOCUMENTED_EXAMPLES (testkit.ts), transcribed from
    // Shopify's own docs. None of these reference an undefined name, so
    // strict mode must produce the exact same output as lax Render.
    for (const { template, data, expected } of DOCUMENTED_EXAMPLES) {
      const result = await renderStrict(ctx, req(template, JSON.stringify(data)));
      expect(result.getOk()).toBe(true);
      expect(result.getOutput()).toBe(expected);
    }
  });

  it('errors on an undefined variable instead of silently rendering empty', async () => {
    const strict = await renderStrict(ctx, req('Hello {{ missing }}!', '{}'));
    expect(strict.getOk()).toBe(false);
    expect(strict.getError()!.getKind()).toBe('undefined');
    expect(strict.getError()!.getMessage()).toContain('missing');

    // Contrast with lax Render on the identical input, proving this is a
    // genuine behavioral difference and not just a different node that
    // happens to always fail.
    const lax = await render(ctx, req('Hello {{ missing }}!', '{}'));
    expect(lax.getOk()).toBe(true);
    expect(lax.getOutput()).toBe('Hello !');
  });

  it('errors on an undefined filter instead of silently passing the value through', async () => {
    const result = await renderStrict(ctx, req('{{ 1 | nope }}', '{}'));
    expect(result.getOk()).toBe(false);
    expect(['undefined', 'parse_error']).toContain(result.getError()!.getKind());
    expect(result.getError()!.getMessage()).toContain('nope');
  });

  it('also errors on an undefined variable used only in an {% if %} condition', async () => {
    const result = await renderStrict(ctx, req('{% if missing %}shown{% else %}hidden{% endif %}', '{}'));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('undefined');

    // Contrast with lax Render: a missing key in a condition is just falsy.
    const lax = await render(ctx, req('{% if missing %}shown{% else %}hidden{% endif %}', '{}'));
    expect(lax.getOk()).toBe(true);
    expect(lax.getOutput()).toBe('hidden');
  });

  it('rejects a path-traversal-shaped include name as a structured error', async () => {
    const result = await renderStrict(ctx, req('{% include "../../etc/passwd" %}', '{}'));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('render_error');
  });
});
