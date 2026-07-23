import { LiquidTemplateRequest, LiquidVariablesResult, LiquidVariableRef } from '../gen/messages_pb';
import { AxiomContext } from '../gen/axiomContext';
import { Liquid, Variable } from 'liquidjs';
import { walkTagsAndFilters, shapeError, toProtoError, SandboxFS } from './lib';

// A segment is normally a string (`.name`) or number (`[0]`), but LiquidJS
// also allows a DYNAMIC segment — `{{ arr[idx] }}` — whose index is itself
// another Variable; stringify it via its own `.toString()` (its dotted path)
// rather than assume every segment is already a plain string.
function segmentToString(seg: string | number | Variable): string {
  if (typeof seg === 'string') return seg;
  if (typeof seg === 'number') return String(seg);
  return seg.toString();
}

function toRef(v: Variable): LiquidVariableRef {
  const ref = new LiquidVariableRef();
  ref.setSegmentsList(v.segments.map(segmentToString));
  ref.setLine(v.location.row);
  ref.setCol(v.location.col);
  return ref;
}

/**
 * Statically analyzes a Liquid template WITHOUT rendering it or requiring any
 * data: every variable path it reads (`variables` — includes loop/assign-
 * scoped names, e.g. the `item` in `{% for item in items %}{{ item }}
 * {% endfor %}`), the subset actually resolved from OUTSIDE the template
 * (`globals` — exactly what a caller must supply in Render's data_json for
 * every value to be defined), names the template introduces itself via
 * `{% assign %}`/`{% capture %}` (`locals`), the distinct tag names used
 * (e.g. "if", "for"), and the distinct filter names used (e.g. "upcase",
 * "truncate"). `ok` is false and every list is empty if the template does
 * not parse as valid Liquid — use ValidateTemplate for just the parse check.
 * No network/filesystem access: `{% include %}`/`{% render %}`/`{% layout %}`
 * names are inventoried as ordinary tag usage, never resolved — this request
 * carries no `partials`, and LiquidJS's static analysis is explicitly told
 * not to follow them (`{ partials: false }`), backed by an always-empty
 * sandbox filesystem as defense in depth.
 *
 * @param ax - Platform context: ax.log for logging, ax.secrets for secrets.
 */
export async function extractVariables(ax: AxiomContext, input: LiquidTemplateRequest): Promise<LiquidVariablesResult> {
  const out = new LiquidVariablesResult();
  try {
    const template = input.getTemplate();
    // `analyze()` DEFAULTS to following {% include %}/{% render %}/
    // {% layout %} targets to analyze them too (StaticAnalysisOptions.
    // partials defaults to true) — against the engine's configured `fs`,
    // which defaults to the REAL filesystem relative to cwd. This request
    // has no partials to follow anyway, so `{ partials: false }` disables
    // that entirely; the always-empty SandboxFS is a second, independent
    // layer that can never touch a real file even if that option were
    // dropped by a future edit.
    const engine = new Liquid({ fs: new SandboxFS({}) });
    const parsed = engine.parse(template);
    const analysis = await engine.analyze(parsed, { partials: false });
    const { tags, filters } = walkTagsAndFilters(parsed as unknown as Parameters<typeof walkTagsAndFilters>[0]);

    out.setOk(true);
    out.setVariablesList(Object.values(analysis.variables).flat().map(toRef));
    out.setGlobalsList(Object.values(analysis.globals).flat().map(toRef));
    out.setLocalsList(Object.keys(analysis.locals));
    out.setTagsList(tags);
    out.setFiltersList(filters);
    return out;
  } catch (e) {
    out.setOk(false);
    out.setError(toProtoError(shapeError(e)));
    return out;
  }
}
