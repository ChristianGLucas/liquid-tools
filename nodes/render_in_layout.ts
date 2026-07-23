import { LiquidRenderInLayoutRequest, LiquidRenderResult } from '../gen/messages_pb';
import { AxiomContext } from '../gen/axiomContext';
import { InputError, parseDataJson, partialsToObject, buildEngine, shapeError, toProtoError } from './lib';

/**
 * Renders `content_template` inside a named layout using standard Liquid
 * layout/block composition (https://liquidjs.com/tags/layout.html):
 * `layout_name` must be a key in `partials` whose value is the layout
 * template, which defines the page shell with `{% block <name> %}default
 * content{% endblock %}` slots; `content_template` fills them with matching
 * `{% block <name> %}...{% endblock %}` overrides. Any part of
 * content_template outside a `{% block %}` is ignored once a layout applies
 * — exactly Liquid's own layout semantics, not a bespoke variant. Both
 * templates share the same `partials` map, so a layout can itself
 * `{% include %}` another supplied partial. Same sandboxed resolution
 * (never the filesystem/a URL) as Render, and no self-imposed size/
 * render-limit guard — that is the platform's job.
 *
 * @param ax - Platform context: ax.log for logging, ax.secrets for secrets.
 */
export async function renderInLayout(ax: AxiomContext, input: LiquidRenderInLayoutRequest): Promise<LiquidRenderResult> {
  const out = new LiquidRenderResult();
  try {
    const contentTemplate = input.getContentTemplate();
    const layoutName = input.getLayoutName();
    if (layoutName.trim() === '') {
      throw new InputError('layout_name must not be empty');
    }
    if (layoutName.includes('"') || /[\r\n]/.test(layoutName)) {
      // layout_name is interpolated into a synthesized `{% layout "..." %}`
      // tag below — reject a quote/newline outright rather than risk it
      // breaking out of that string literal and being parsed as extra tag
      // syntax. Both layout_name and partials come from the same caller, so
      // this can't reach anything the caller doesn't already fully control
      // (they could write any tag directly in content_template); it's still
      // a correctness footgun worth a clear error instead of silent breakage.
      throw new InputError('layout_name must not contain a `"` character or a newline');
    }
    const data = parseDataJson(input.getDataJson());
    const partials = partialsToObject(input.getPartialsMap());
    if (!Object.prototype.hasOwnProperty.call(partials, layoutName)) {
      throw new InputError(`layout_name "${layoutName}" is not a key in partials`);
    }
    const engine = buildEngine(partials, { strictVariables: false, strictFilters: false });
    // The `{% layout %}` tag is how Liquid itself declares "render me inside
    // this layout" — prepending it lets a caller supply an ordinary
    // block-tagged content template without needing to know that syntax.
    const wrapped = `{% layout "${layoutName}" %}${contentTemplate}`;
    const output = await engine.parseAndRender(wrapped, data);
    out.setOk(true);
    out.setOutput(output);
    return out;
  } catch (e) {
    out.setOk(false);
    out.setError(toProtoError(shapeError(e)));
    return out;
  }
}
