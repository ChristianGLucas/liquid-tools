// Shared bounds, sandboxing, and error-shaping helpers for the liquid-tools
// nodes. Not a node and not a test file, so it is neither registered nor
// collected.
//
// The algorithmically hard part — Liquid tokenizing, parsing, and rendering
// (variables, tags, filters, loops, conditionals, layouts/blocks) — is
// entirely owned by LiquidJS (https://liquidjs.com, MIT); nothing here
// reimplements any of it. What lives here is: (a) up-front size bounds on
// every caller-controlled dimension (template/data/partials bytes, partial
// count) enforced BEFORE anything is parsed, so a bound never depends on
// first allocating the thing it's supposed to prevent, (b) LiquidJS's own
// built-in parse/render/memory/template guards (`parseLimit`/`renderLimit`/
// `memoryLimit`/`templateLimit` — LiquidJS calls these out as "for DoS
// handling") wired to generous-but-finite values as defense in depth behind
// the size bounds, (c) a from-scratch in-memory filesystem stand-in
// (`SandboxFS`) so {% include %}/{% render %}/{% layout %} tags can only
// ever resolve a name the caller supplied in `partials` — never the real
// filesystem or a URL, so path traversal and SSRF through those tags are
// structurally impossible rather than merely disabled, and (d) turning any
// thrown error (ours or LiquidJS's) into this package's one structured
// LiquidError shape.

import { Liquid } from 'liquidjs';
import type { FS } from 'liquidjs';
import { LiquidError } from '../gen/messages_pb';

export class InputError extends Error {}
export class BoundsError extends Error {}

// Defense-in-depth ceilings on every caller-controlled input dimension.
//
// The deployed Axiom platform accepts up to a 16 MiB invoke payload (17 MiB
// request body; nginx ingress allows 64 MiB; the internal gRPC hop allows
// 24 MiB) — these are text bounds (no base64 inflation) sized so that a
// single request's worst case — template + data_json + the total of all
// partials — stays comfortably under that 16 MiB ceiling with several MiB of
// headroom for JSON/protobuf framing, and so the rendered output that comes
// back in the response independently stays under it too.
//   MAX_TEMPLATE_BYTES + MAX_DATA_JSON_BYTES + MAX_PARTIALS_TOTAL_BYTES
//     = 2 + 8 + 2 = 12 MiB of worst-case request body, vs. a 16 MiB cap.
//   MAX_OUTPUT_BYTES = 12 MiB of worst-case response body, vs. the same cap.
// (Earlier revisions of this package capped MAX_OUTPUT_BYTES at 640 KiB as a
// workaround for a since-fixed platform ingress bug that silently truncated
// invokes at ~1 MiB; that workaround is gone as of 0.1.1 — see git history.)
export const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024; // 2 MiB
export const MAX_DATA_JSON_BYTES = 8 * 1024 * 1024; // 8 MiB
export const MAX_PARTIAL_BYTES = 1 * 1024 * 1024; // 1 MiB per partial
export const MAX_PARTIALS_COUNT = 64;
export const MAX_PARTIALS_TOTAL_BYTES = 2 * 1024 * 1024; // 2 MiB across all partials combined
export const MAX_OUTPUT_BYTES = 12 * 1024 * 1024; // 12 MiB
export const MAX_DATA_CONTEXTS = 1; // reserved (single-context render nodes only, see retrospective)

// LiquidJS's own DoS-handling engine options (see liquid-options.d.ts),
// scaled up alongside the byte ceilings above so a template/context that
// legitimately uses the new larger budgets doesn't get cut off by an engine
// guard sized for the old ~1 MiB-ingress era. LiquidJS's own docs describe
// "a typical PC" as comfortably handling 1e8 parseLimit chars, 1e9
// memoryLimit bytes, and ~1e5 templateLimit renders/sec — every value below
// stays at least one order of magnitude under those references.
// parseLimit bounds total characters parsed, renderLimit bounds wall-clock
// render time (ms), memoryLimit bounds new-object/string allocation during
// render, templateLimit (a render() call option) bounds the total number of
// tag/HTML/output nodes rendered — this is what actually stops a
// `{% for i in (1..100000000000) %}` bomb, since that loop's bound lives in
// the template text itself, not in any caller-supplied data size.
export const PARSE_LIMIT_CHARS = 6_000_000;
export const RENDER_LIMIT_MS = 8_000;
export const MEMORY_LIMIT_BYTES = 64_000_000;
export const TEMPLATE_RENDER_LIMIT = 500_000;

export function byteLen(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

export function checkBytes(value: string, field: string, max: number): void {
  const n = byteLen(value);
  if (n > max) {
    throw new BoundsError(`${field} is ${n} bytes, exceeding the ${max}-byte limit`);
  }
}

/** Validates + converts a caller-supplied partials map (jspb.Map<string,string>
 * or a plain object) into a plain Record, enforcing count and per-entry/total
 * size bounds before any of it reaches the Liquid engine or SandboxFS. */
export function partialsToObject(
  map: { forEach(cb: (value: string, key: string) => void): void } | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!map) return out;
  let count = 0;
  let totalBytes = 0;
  map.forEach((value, key) => {
    count += 1;
    if (count > MAX_PARTIALS_COUNT) {
      throw new BoundsError(`partials has more than ${MAX_PARTIALS_COUNT} entries`);
    }
    checkBytes(value, `partials["${key}"]`, MAX_PARTIAL_BYTES);
    totalBytes += byteLen(value);
    if (totalBytes > MAX_PARTIALS_TOTAL_BYTES) {
      throw new BoundsError(`partials total size exceeds ${MAX_PARTIALS_TOTAL_BYTES} bytes`);
    }
    out[key] = value;
  });
  return out;
}

/** Parses data_json into the plain object LiquidJS renders against. Rejects
 * malformed JSON and any non-object top level (Liquid's render scope must be
 * a set of named bindings, not a bare array/string/number) with a structured
 * InputError rather than letting either fail deep inside the engine. Empty
 * string means "no context" (renders against {}). */
export function parseDataJson(dataJson: string): Record<string, unknown> {
  checkBytes(dataJson, 'data_json', MAX_DATA_JSON_BYTES);
  const trimmed = dataJson.trim();
  if (trimmed === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataJson);
  } catch (e) {
    throw new InputError(`data_json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InputError('data_json must decode to a JSON object (e.g. {"name": "World"}), not an array or scalar');
  }
  return parsed as Record<string, unknown>;
}

/** An in-memory-only stand-in for LiquidJS's `FS` interface. Every method
 * resolves purely against the `mapping` object handed to the constructor —
 * `resolve()` returns the requested name unchanged (never joined against a
 * real directory), and `readFile`/`readFileSync` only ever return a value
 * already present in `mapping`. There is no code path here that reads a real
 * file or opens a real socket, so {% include %}/{% render %}/{% layout %}
 * tags can only ever "reach" a template the caller passed in `partials` —
 * traversal strings like "../../etc/passwd" simply miss the map and 404,
 * exactly like any other unknown name. */
export class SandboxFS implements FS {
  sep = '/';
  constructor(private mapping: Record<string, string>) {}
  async exists(filepath: string): Promise<boolean> {
    return Object.prototype.hasOwnProperty.call(this.mapping, filepath);
  }
  existsSync(filepath: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.mapping, filepath);
  }
  async readFile(filepath: string): Promise<string> {
    return this.readFileSync(filepath);
  }
  readFileSync(filepath: string): string {
    if (!Object.prototype.hasOwnProperty.call(this.mapping, filepath)) {
      throw new InputError(`no partial named "${filepath}" was supplied`);
    }
    return this.mapping[filepath];
  }
  resolve(_dir: string, file: string, _ext: string): string {
    return file;
  }
  dirname(_filepath: string): string {
    return '';
  }
  async contains(_root: string, _file: string): Promise<boolean> {
    return true;
  }
  containsSync(_root: string, _file: string): boolean {
    return true;
  }
}

export interface BuildEngineOptions {
  strictVariables?: boolean;
  strictFilters?: boolean;
}

/** Builds one LiquidJS engine wired to this package's sandbox + bounds. A
 * fresh engine is built per invocation (engines are cheap and stateless
 * here) so one request's `partials` can never leak into another's. */
export function buildEngine(partials: Record<string, string>, opts: BuildEngineOptions = {}): Liquid {
  return new Liquid({
    fs: new SandboxFS(partials),
    relativeReference: false,
    // dynamicPartials stays at its default (true): it only controls whether
    // `{% include some_var %}` (a variable naming the partial) is permitted
    // in addition to a literal `{% include "name" %}` — either way,
    // resolution always goes through SandboxFS, which can only ever return
    // a value already in `partials`. Turning it off would ALSO break plain
    // quoted-literal include/render/layout names (LiquidJS then passes the
    // raw, still-quoted token text to fs.resolve instead of the evaluated
    // string), which is not what we want.
    strictVariables: opts.strictVariables ?? false,
    strictFilters: opts.strictFilters ?? false,
    parseLimit: PARSE_LIMIT_CHARS,
    renderLimit: RENDER_LIMIT_MS,
    memoryLimit: MEMORY_LIMIT_BYTES,
  });
}

/** Per-call render() options carrying the same DoS-handling bounds — passed
 * explicitly to every render/parseAndRender call as defense in depth
 * alongside the constructor-level options above (LiquidJS honors both; a
 * per-call templateLimit has no constructor-level equivalent). */
export function renderCallOptions(): { renderLimit: number; memoryLimit: number; templateLimit: number } {
  return { renderLimit: RENDER_LIMIT_MS, memoryLimit: MEMORY_LIMIT_BYTES, templateLimit: TEMPLATE_RENDER_LIMIT };
}

export interface ShapedError {
  kind: string;
  message: string;
  line: number;
  col: number;
}

/** Turns any thrown value (ours or LiquidJS's) into this package's one
 * structured error shape. LiquidJS errors carry a `.token` whose
 * `getPosition()` gives the 1-based [line, col] the error occurred at;
 * our own InputError/BoundsError have no template position (0/0). */
export function shapeError(e: unknown): ShapedError {
  if (e instanceof InputError) {
    return { kind: 'invalid_input', message: e.message, line: 0, col: 0 };
  }
  if (e instanceof BoundsError) {
    return { kind: 'limit_exceeded', message: e.message, line: 0, col: 0 };
  }
  if (e && typeof e === 'object' && 'name' in e) {
    const name = String((e as { name?: unknown }).name ?? '');
    const message = e instanceof Error ? e.message : String(e);
    let line = 0;
    let col = 0;
    const token = (e as { token?: { getPosition?: () => [number, number] } }).token;
    if (token && typeof token.getPosition === 'function') {
      try {
        [line, col] = token.getPosition();
      } catch {
        // position unavailable — keep 0/0
      }
    }
    const limitHit = /limit exceeded/i.test(message);
    let kind: string;
    if (limitHit) kind = 'limit_exceeded';
    else if (name === 'UndefinedVariableError') kind = 'undefined';
    else if (name === 'ParseError' || name === 'TokenizationError') kind = 'parse_error';
    else if (name === 'RenderError') kind = 'render_error';
    else kind = 'render_error';
    return { kind, message, line, col };
  }
  return { kind: 'render_error', message: e instanceof Error ? e.message : String(e), line: 0, col: 0 };
}

export function toProtoError(shaped: ShapedError): LiquidError {
  const err = new LiquidError();
  err.setKind(shaped.kind);
  err.setMessage(shaped.message);
  err.setLine(shaped.line);
  err.setCol(shaped.col);
  return err;
}

/** Structural (duck-typed) shape of the pieces of LiquidJS's internal AST
 * this walk touches. LiquidJS does not export a public "visit every node"
 * API, so this walks the same shape `analyze()` itself traverses
 * internally: a Tag node exposes `.name` plus, for the built-in
 * block-shaped tags, one of `.templates` (for/capture/tablerow/unless/raw
 * body), `.branches` (if/case, each `{ templates: [...] }`), or
 * `.elseTemplates` (for/case else-branch); an Output node exposes
 * `.value.filters`, an array of `{ name: string }`. Anything not matching
 * one of those shapes is left untouched — this is a best-effort inventory
 * of tag/filter USAGE for ExtractVariables, not a re-implementation of
 * Liquid's grammar. */
interface WalkNode {
  name?: string;
  templates?: WalkNode[];
  elseTemplates?: WalkNode[];
  branches?: { templates?: WalkNode[] }[];
  value?: { filters?: { name?: string }[] };
}

const MAX_WALK_NODES = 200_000; // matches the render-side TEMPLATE_RENDER_LIMIT order of magnitude

/** Collects the distinct tag names and filter names referenced anywhere in
 * an already-parsed template (see `engine.parse()`). Bounded by
 * MAX_WALK_NODES so a pathologically deep/wide (but under MAX_TEMPLATE_BYTES)
 * template can't make static analysis itself expensive. */
export function walkTagsAndFilters(nodes: WalkNode[]): { tags: string[]; filters: string[] } {
  const tags = new Set<string>();
  const filters = new Set<string>();
  let visited = 0;

  function visit(list: WalkNode[] | undefined): void {
    if (!list) return;
    for (const node of list) {
      visited += 1;
      if (visited > MAX_WALK_NODES) {
        throw new BoundsError(`template has more than ${MAX_WALK_NODES} nodes to statically analyze`);
      }
      // Tag nodes (block-shaped or bodyless) expose `.name`; Output nodes
      // (`{{ ... }}`) and HTML nodes never do, so this alone distinguishes
      // "a tag was used here" without needing to enumerate every tag class.
      if (typeof node.name === 'string') {
        tags.add(node.name);
      }
      if (node.value?.filters) {
        for (const f of node.value.filters) {
          if (f.name) filters.add(f.name);
        }
      }
      visit(node.templates);
      visit(node.elseTemplates);
      if (node.branches) {
        for (const b of node.branches) visit(b.templates);
      }
    }
  }

  visit(nodes);
  return { tags: [...tags].sort(), filters: [...filters].sort() };
}

/** Final output-size guard, applied AFTER render. `memoryLimit`/`renderLimit`
 * bound cost during rendering, but a legitimate-looking small template can
 * still expand to a large-but-not-pathological output (e.g. a big loop over
 * a big but allowed data_json) — reject deterministically with a structured
 * error rather than ship a response over the platform's response-body cap. */
export function checkOutputBytes(output: string): void {
  const n = byteLen(output);
  if (n > MAX_OUTPUT_BYTES) {
    throw new BoundsError(`rendered output is ${n} bytes, exceeding the ${MAX_OUTPUT_BYTES}-byte limit`);
  }
}
