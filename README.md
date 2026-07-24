# liquid-tools

Composable [Axiom](https://axiomide.com) nodes for [Liquid](https://shopify.github.io/liquid/) (Shopify/Jekyll-style) template rendering, wrapping [LiquidJS](https://liquidjs.com) (MIT).

Built for the Axiom marketplace (handle: `christiangeorgelucas`).

## Use it from your agent or app

Every node in this package is a **live, auto-scaling API endpoint** on the
[Axiom](https://axiomide.com) marketplace — call it from an AI agent or your own
code, with nothing to self-host.

**📦 See it on the marketplace:**
https://dev.axiomide.com/marketplace/christiangeorgelucas/liquid-tools@0.1.2

**Hook it up to an AI agent (MCP).** Add Axiom's hosted MCP server to any MCP
client and every node becomes a typed tool your agent can call — search the
catalog, inspect a schema, and invoke it directly.

```bash
# Claude Code
claude mcp add --transport http axiom https://api.axiomide.com/mcp \
  --header "Authorization: Bearer $AXIOM_API_KEY"
```

Claude Desktop, Cursor, or any config-based client:

```json
{
  "mcpServers": {
    "axiom": {
      "type": "http",
      "url": "https://api.axiomide.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_AXIOM_API_KEY" }
    }
  }
}
```

**Call it from the CLI.**

```bash
axiom invoke christiangeorgelucas/liquid-tools/Render --input '{ ... }'
```

**Call it over HTTP.**

```bash
curl -X POST https://api.axiomide.com/invocations/v1/nodes/christiangeorgelucas/liquid-tools/0.1.2/Render \
  -H "Authorization: Bearer $AXIOM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{ ... }'
```

> Input/output schema for each node is on the marketplace page above, or via
> `axiom inspect node christiangeorgelucas/liquid-tools/Render`.

### Get started free

Install the CLI:

```bash
# macOS / Linux — Homebrew
brew install axiomide/tap/axiom

# macOS / Linux — install script
curl -fsSL https://raw.githubusercontent.com/AxiomIDE/axiom-releases/main/install.sh | sh
```

**Windows:** download the `windows/amd64` `.zip` from the
[releases page](https://github.com/AxiomIDE/axiom-releases/releases), unzip it,
and put `axiom.exe` on your `PATH`.

Then `axiom version` to verify, `axiom login` (GitHub or Google) to authenticate,
and create an API key under **Console → API Keys**. Docs and sign-up at
**[axiomide.com](https://axiomide.com)**.

## Nodes

- **Render** — render a Liquid template against a JSON data context. Undefined variables render empty; undefined filters pass through. `{% include %}`/`{% render %}` resolve only from a caller-supplied `partials` map — never the filesystem or a URL.
- **RenderStrict** — same as Render, but any undefined variable or filter reference is a structured error instead of being silently tolerated.
- **RenderInLayout** — renders content inside a named layout using Liquid's own `{% layout %}`/`{% block %}` composition.
- **ExtractVariables** — statically analyzes a template (no rendering, no data required): every variable referenced, which of those are globals the caller must supply, locals introduced by `{% assign %}`/`{% capture %}`, and the distinct tags/filters used.
- **ValidateTemplate** — checks a template parses as valid Liquid syntax, returning a structured error with line/column on failure.

Every node is stateless, deterministic, and bounded: template/data/partials size, parse time, render time, memory, and total render-node count are all capped, so a pathological template (e.g. a huge `{% for i in (1..1e12) %}`) fails fast with a structured error instead of hanging or exhausting memory. `{% include %}`/`{% render %}`/`{% layout %}` tags are resolved through an in-memory sandbox that can only ever return a value the caller supplied in `partials` — real filesystem/network access is structurally impossible, not merely disabled.

## License

MIT — see [LICENSE](./LICENSE).
