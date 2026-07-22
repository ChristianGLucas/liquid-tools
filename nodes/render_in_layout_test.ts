import { LiquidRenderInLayoutRequest } from '../gen/messages_pb';
import { renderInLayout } from './render_in_layout';
import { ctx } from './testkit';

function req(contentTemplate: string, layoutName: string, dataJson = '', partials: Record<string, string> = {}) {
  const input = new LiquidRenderInLayoutRequest();
  input.setContentTemplate(contentTemplate);
  input.setLayoutName(layoutName);
  input.setDataJson(dataJson);
  const map = input.getPartialsMap();
  for (const [k, v] of Object.entries(partials)) map.set(k, v);
  return input;
}

describe('RenderInLayout', () => {
  it('composes content into a named layout via standard Liquid block semantics (independent oracle: liquidjs.com/tags/layout)', async () => {
    // https://liquidjs.com/tags/layout.html documents exactly this
    // layout+block shape: a layout with a `{% block %}` default slot, and
    // content overriding it — transcribed from that doc, not derived from
    // this implementation.
    const result = await renderInLayout(
      ctx,
      req(
        '{% block content %}Hello {{ name }}{% endblock %}',
        'base',
        '{"name":"World"}',
        { base: '<html><body>{% block content %}default{% endblock %}</body></html>' }
      )
    );
    expect(result.getOk()).toBe(true);
    expect(result.getOutput()).toBe('<html><body>Hello World</body></html>');
  });

  it('falls back to the layout default when content does not override the block', async () => {
    const result = await renderInLayout(
      ctx,
      req('', 'base', '{}', { base: '<html>{% block content %}default content{% endblock %}</html>' })
    );
    expect(result.getOk()).toBe(true);
    expect(result.getOutput()).toBe('<html>default content</html>');
  });

  it('a layout can itself {% include %} another supplied partial', async () => {
    const result = await renderInLayout(
      ctx,
      req('{% block content %}Body{% endblock %}', 'base', '{}', {
        base: '{% include "header" %}<main>{% block content %}{% endblock %}</main>',
        header: '<h1>Site</h1>',
      })
    );
    expect(result.getOk()).toBe(true);
    expect(result.getOutput()).toBe('<h1>Site</h1><main>Body</main>');
  });

  it('errors with a structured invalid_input when layout_name is not a key in partials', async () => {
    const result = await renderInLayout(ctx, req('{% block content %}x{% endblock %}', 'missing-layout', '{}', {}));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('invalid_input');
  });

  it('errors with a structured invalid_input when layout_name is empty', async () => {
    const result = await renderInLayout(ctx, req('x', '', '{}', { base: 'y' }));
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('invalid_input');
  });

  it('rejects a layout_name containing a double-quote rather than risk breaking out of the synthesized tag', async () => {
    const result = await renderInLayout(
      ctx,
      req('x', 'base" %}{% include "leak', '{}', { 'base" %}{% include "leak': 'y' })
    );
    expect(result.getOk()).toBe(false);
    expect(result.getError()!.getKind()).toBe('invalid_input');
  });
});
