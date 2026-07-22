import { LiquidRenderRequest, LiquidRenderResult } from '../gen/messages_pb';
import { AxiomContext } from '../gen/axiomContext';
import {
  checkBytes,
  parseDataJson,
  partialsToObject,
  buildEngine,
  renderCallOptions,
  checkOutputBytes,
  shapeError,
  toProtoError,
  MAX_TEMPLATE_BYTES,
} from './lib';

/**
 * Renders a Liquid template (Shopify/Jekyll-style `{{ variables }}`,
 * `{% tags %}`, filters, loops, conditionals) against a JSON data context and
 * returns the rendered text. Uses Liquid's own default ("lax") semantics: an
 * undefined variable renders as empty text and an undefined filter is a
 * no-op passthrough of its input — use RenderStrict instead to error on
 * either. `{% include %}`/`{% render %}` resolve a name ONLY from this
 * request's own `partials` map — never the filesystem or a URL — so an
 * unresolved name comes back as a structured render_error, not a leak of
 * anything outside the request. Rendering is bounded (parse size, render
 * time, memory, and total node count), so a pathological template such as
 * `{% for i in (1..100000000000) %}` fails fast with a structured
 * limit_exceeded error instead of hanging or exhausting memory — the bound
 * lives in the template text itself, not the data, so it can't be sidestepped
 * by a small data_json. Deterministic: the same template + data_json +
 * partials always renders the same output.
 *
 * @param ax - Platform context: ax.log for logging, ax.secrets for secrets.
 */
export async function render(ax: AxiomContext, input: LiquidRenderRequest): Promise<LiquidRenderResult> {
  const out = new LiquidRenderResult();
  try {
    const template = input.getTemplate();
    checkBytes(template, 'template', MAX_TEMPLATE_BYTES);
    const data = parseDataJson(input.getDataJson());
    const partials = partialsToObject(input.getPartialsMap());
    const engine = buildEngine(partials, { strictVariables: false, strictFilters: false });
    const output = await engine.parseAndRender(template, data, renderCallOptions());
    checkOutputBytes(output);
    out.setOk(true);
    out.setOutput(output);
    return out;
  } catch (e) {
    out.setOk(false);
    out.setError(toProtoError(shapeError(e)));
    return out;
  }
}
