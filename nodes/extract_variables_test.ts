import { LiquidTemplateRequest } from '../gen/messages_pb';
import { extractVariables } from './extract_variables';
import { ctx } from './testkit';
import { MAX_TEMPLATE_BYTES } from './lib';

function req(template: string): LiquidTemplateRequest {
  const input = new LiquidTemplateRequest();
  input.setTemplate(template);
  return input;
}

function segLists(refs: { getSegmentsList(): string[] }[]): string[][] {
  return refs.map((r) => r.getSegmentsList());
}

describe('ExtractVariables', () => {
  it('lists every referenced variable, splitting globals (caller-must-supply) from loop-scoped names — hand-verified against the template text', async () => {
    // INDEPENDENT ORACLE: hand-read from the template text itself — `name`,
    // `show`, `items`, and `missing.foo` are read from outside the template
    // (globals); `item` is introduced by the {% for %} loop, so it is a
    // variable REFERENCE but not something a caller must supply.
    const tpl = 'Hello {{ name | upcase }}! {% if show %}{% for item in items %}{{ item }}{% endfor %}{% endif %} {{ missing.foo }}';
    const result = await extractVariables(ctx, req(tpl));
    expect(result.getOk()).toBe(true);

    const varSegs = segLists(result.getVariablesList());
    expect(varSegs).toContainEqual(['name']);
    expect(varSegs).toContainEqual(['show']);
    expect(varSegs).toContainEqual(['items']);
    expect(varSegs).toContainEqual(['item']);
    expect(varSegs).toContainEqual(['missing', 'foo']);

    const globalSegs = segLists(result.getGlobalsList());
    expect(globalSegs).toContainEqual(['name']);
    expect(globalSegs).toContainEqual(['show']);
    expect(globalSegs).toContainEqual(['items']);
    expect(globalSegs).toContainEqual(['missing', 'foo']);
    // 'item' is loop-local: it must NOT be reported as something the caller
    // needs to supply in data_json.
    expect(globalSegs).not.toContainEqual(['item']);

    expect(result.getTagsList().sort()).toEqual(['for', 'if']);
    expect(result.getFiltersList()).toEqual(['upcase']);
  });

  it('reports an {% assign %}-introduced name as a local, not a global', async () => {
    const result = await extractVariables(ctx, req('{% assign x = 1 %}{{ x }}{{ y }}'));
    expect(result.getOk()).toBe(true);
    expect(result.getLocalsList()).toEqual(['x']);
    expect(segLists(result.getGlobalsList())).toContainEqual(['y']);
    expect(segLists(result.getGlobalsList())).not.toContainEqual(['x']);
    expect(result.getTagsList()).toContain('assign');
  });

  it('collects every distinct filter name used, deduplicated', async () => {
    const tpl = '{{ name | upcase | truncate: 5 }} {% for x in xs %}{{ x | append: "!" }}{% endfor %} {{ other | upcase }}';
    const result = await extractVariables(ctx, req(tpl));
    expect(result.getOk()).toBe(true);
    expect(result.getFiltersList().sort()).toEqual(['append', 'truncate', 'upcase']);
  });

  it('returns ok=false with a structured parse_error for a malformed template, not a crash', async () => {
    const result = await extractVariables(ctx, req('{% if x %}unterminated'));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('parse_error');
    expect(result.getVariablesList()).toEqual([]);
  });

  it('rejects an oversized template as a structured limit_exceeded error', async () => {
    const huge = 'x'.repeat(MAX_TEMPLATE_BYTES + 100);
    const result = await extractVariables(ctx, req(huge));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('limit_exceeded');
  });

  it('never resolves an {% include %} name — it is inventoried as tag usage only', async () => {
    const result = await extractVariables(ctx, req('{% include "does-not-exist-anywhere" %}'));
    expect(result.getOk()).toBe(true);
    expect(result.getTagsList()).toContain('include');
  });
});
