import { LiquidTemplateRequest } from '../gen/messages_pb';
import { validateTemplate } from './validate_template';
import { ctx, DOCUMENTED_EXAMPLES } from './testkit';
import { MAX_TEMPLATE_BYTES } from './lib';

function req(template: string): LiquidTemplateRequest {
  const input = new LiquidTemplateRequest();
  input.setTemplate(template);
  return input;
}

describe('ValidateTemplate', () => {
  it('accepts every documented Shopify Liquid example as syntactically valid (independent oracle)', async () => {
    for (const { template } of DOCUMENTED_EXAMPLES) {
      const result = await validateTemplate(ctx, req(template));
      expect(result.getValid()).toBe(true);
      expect(result.getError()).toBeUndefined();
    }
  });

  it('reports an unclosed {% if %} as invalid with a precise line/col', async () => {
    const result = await validateTemplate(ctx, req('Hello {% if x %}unterminated'));
    expect(result.getValid()).toBe(false);
    expect(result.getError()!.getKind()).toBe('parse_error');
    expect(result.getError()!.getLine()).toBe(1);
    expect(result.getError()!.getCol()).toBeGreaterThan(0);
  });

  it('reports a malformed filter expression as invalid', async () => {
    const result = await validateTemplate(ctx, req('{{ 1 +++ }}'));
    expect(result.getValid()).toBe(false);
    expect(result.getError()!.getKind()).toBe('parse_error');
  });

  it('reports an unknown tag name as invalid', async () => {
    const result = await validateTemplate(ctx, req('{% notarealtag %}'));
    expect(result.getValid()).toBe(false);
    expect(result.getError()!.getKind()).toBe('parse_error');
  });

  it('accepts an empty template as valid (renders to empty text)', async () => {
    const result = await validateTemplate(ctx, req(''));
    expect(result.getValid()).toBe(true);
  });

  it('rejects an oversized template as a structured limit_exceeded error, not a crash', async () => {
    const huge = 'x'.repeat(MAX_TEMPLATE_BYTES + 100);
    const result = await validateTemplate(ctx, req(huge));
    expect(result.getValid()).toBe(false);
    expect(result.getError()!.getKind()).toBe('limit_exceeded');
  });

  it('does not require a data context to validate (no data is ever consulted)', async () => {
    const result = await validateTemplate(ctx, req('{{ some.deeply.nested.path }}'));
    expect(result.getValid()).toBe(true);
  });
});
