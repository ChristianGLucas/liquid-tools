# liquid-tools

Composable [Axiom](https://axiomide.com) nodes for [Liquid](https://shopify.github.io/liquid/) (Shopify/Jekyll-style) template rendering, wrapping [LiquidJS](https://liquidjs.com) (MIT).

Built for the Axiom marketplace (handle: `christiangeorgelucas`).

## Nodes

- **Render** — render a Liquid template against a JSON data context. Undefined variables render empty; undefined filters pass through. `{% include %}`/`{% render %}` resolve only from a caller-supplied `partials` map — never the filesystem or a URL.
- **RenderStrict** — same as Render, but any undefined variable or filter reference is a structured error instead of being silently tolerated.
- **RenderInLayout** — renders content inside a named layout using Liquid's own `{% layout %}`/`{% block %}` composition.
- **ExtractVariables** — statically analyzes a template (no rendering, no data required): every variable referenced, which of those are globals the caller must supply, locals introduced by `{% assign %}`/`{% capture %}`, and the distinct tags/filters used.
- **ValidateTemplate** — checks a template parses as valid Liquid syntax, returning a structured error with line/column on failure.

Every node is stateless, deterministic, and bounded: template/data/partials size, parse time, render time, memory, and total render-node count are all capped, so a pathological template (e.g. a huge `{% for i in (1..1e12) %}`) fails fast with a structured error instead of hanging or exhausting memory. `{% include %}`/`{% render %}`/`{% layout %}` tags are resolved through an in-memory sandbox that can only ever return a value the caller supplied in `partials` — real filesystem/network access is structurally impossible, not merely disabled.

## License

MIT — see [LICENSE](./LICENSE).
