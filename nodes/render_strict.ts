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
 * Renders exactly like Render, except ANY reference to a variable with no
 * matching key anywhere in data_json — a bare `{{ variable }}`
 * interpolation, or one used in a `{% if %}`/`{% for %}`/other tag
 * condition — is a structured `undefined` error instead of silently
 * treating it as empty/falsy, and any `| filter` name that isn't a
 * recognized built-in filter is a structured `parse_error` instead of a
 * silent no-op passthrough. Useful for catching a typo'd variable or filter
 * name (e.g. `{{ user.naem }}`, or `{% if usre.active %}`) that Render would
 * otherwise mask. Same sandboxed `partials` resolution and parse/render/
 * memory/output bounds as Render.
 *
 * @param ax - Platform context: ax.log for logging, ax.secrets for secrets.
 */
export async function renderStrict(ax: AxiomContext, input: LiquidRenderRequest): Promise<LiquidRenderResult> {
  const out = new LiquidRenderResult();
  try {
    const template = input.getTemplate();
    checkBytes(template, 'template', MAX_TEMPLATE_BYTES);
    const data = parseDataJson(input.getDataJson());
    const partials = partialsToObject(input.getPartialsMap());
    const engine = buildEngine(partials, { strictVariables: true, strictFilters: true });
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
