import { LiquidTemplateRequest, LiquidValidateResult } from '../gen/messages_pb';
import { AxiomContext } from '../gen/axiomContext';
import { Liquid } from 'liquidjs';
import { checkBytes, shapeError, toProtoError, SandboxFS, MAX_TEMPLATE_BYTES } from './lib';

/**
 * Checks whether a string is syntactically valid Liquid, without rendering
 * it or requiring any data context. `valid` is true iff `template` parses
 * cleanly; otherwise `error` (kind "parse_error") carries the 1-based
 * `line`/`col` of the first syntax problem — e.g. an unclosed `{% if %}`, a
 * malformed filter expression, or an unknown tag name. No network/filesystem
 * access: `{% include %}`/`{% render %}`/`{% layout %}` names are only
 * checked for syntactic well-formedness, never resolved.
 *
 * @param ax - Platform context: ax.log for logging, ax.secrets for secrets.
 */
export async function validateTemplate(ax: AxiomContext, input: LiquidTemplateRequest): Promise<LiquidValidateResult> {
  const out = new LiquidValidateResult();
  try {
    const template = input.getTemplate();
    checkBytes(template, 'template', MAX_TEMPLATE_BYTES);
    // parse() alone never follows {% include %}/{% render %}/{% layout %}
    // targets (only render()/analyze() do), so this is already safe with no
    // fs configured — the always-empty SandboxFS is defense in depth in
    // case that ever changes.
    const engine = new Liquid({ fs: new SandboxFS({}) });
    engine.parse(template);
    out.setValid(true);
    return out;
  } catch (e) {
    out.setValid(false);
    out.setError(toProtoError(shapeError(e)));
    return out;
  }
}
