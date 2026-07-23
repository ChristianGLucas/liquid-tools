// Shared sandboxing and error-shaping helpers for the liquid-tools nodes. Not
// a node and not a test file, so it is neither registered nor collected.
//
// The algorithmically hard part — Liquid tokenizing, parsing, and rendering
// (variables, tags, filters, loops, conditionals) — is entirely owned by
// LiquidJS (https://liquidjs.com, MIT); nothing here reimplements any of it.
// What lives here is: (a) a from-scratch in-memory filesystem stand-in
// (`SandboxFS`) so {% include %}/{% render %}/{% layout %} tags can only ever
// resolve a name the caller supplied in `partials` — never the real
// filesystem or a URL, so path traversal and SSRF through those tags are
// structurally impossible rather than merely disabled (this is CAPABILITY
// safety, not a size/DoS cap, and stays), and (b) turning any thrown error
// (ours or LiquidJS's) into this package's one structured LiquidError shape.
//
// This package intentionally carries NO byte-size ceilings, partial-count
// caps, or output-size limits, and does NOT configure any of LiquidJS's own
// `parseLimit`/`renderLimit`/`memoryLimit`/`templateLimit` DoS-handling engine
// options (they are simply left at LiquidJS's own defaults, which are
// unlimited). A node is a pure input→output function; request/response size,
// memory, and abusive/pathological-input ("bomb") concerns are the
// platform's job, not this package's — duplicating them here would just be
// a second, divergent copy of a policy the platform already enforces. (Prior
// revisions of this package enforced MAX_TEMPLATE_BYTES/MAX_DATA_JSON_BYTES/
// MAX_PARTIAL_BYTES/MAX_PARTIALS_TOTAL_BYTES/MAX_OUTPUT_BYTES and scaled-up
// LiquidJS engine limits as a workaround for a since-fixed platform ingress
// bug; that workaround, and the raised-cap "remediation" that followed it in
// 0.1.1, are both gone as of this version — see git history.)

import { Liquid } from 'liquidjs';
import type { FS } from 'liquidjs';
import { LiquidError } from '../gen/messages_pb';

export class InputError extends Error {}

/** Validates + converts a caller-supplied partials map (jspb.Map<string,string>
 * or a plain object) into a plain Record for LiquidJS/SandboxFS to consult.
 * No count or size bound: that is the platform's concern, not this node's. */
export function partialsToObject(
  map: { forEach(cb: (value: string, key: string) => void): void } | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!map) return out;
  map.forEach((value, key) => {
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

/** Builds one LiquidJS engine wired to this package's sandbox. A fresh engine
 * is built per invocation (engines are cheap and stateless here) so one
 * request's `partials` can never leak into another's. Deliberately does NOT
 * set `parseLimit`/`renderLimit`/`memoryLimit` — those are LiquidJS's own
 * DoS-handling knobs, and bounding parse/render cost is the platform's job,
 * not this node's; left unset, LiquidJS defaults every one of them to
 * unlimited. */
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
  });
}

export interface ShapedError {
  kind: string;
  message: string;
  line: number;
  col: number;
}

/** Turns any thrown value (ours or LiquidJS's) into this package's one
 * structured error shape. LiquidJS errors carry a `.token` whose
 * `getPosition()` gives the 1-based [line, col] the error occurred at; our
 * own InputError has no template position (0/0). */
export function shapeError(e: unknown): ShapedError {
  if (e instanceof InputError) {
    return { kind: 'invalid_input', message: e.message, line: 0, col: 0 };
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
    let kind: string;
    if (name === 'UndefinedVariableError') kind = 'undefined';
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

/** Collects the distinct tag names and filter names referenced anywhere in
 * an already-parsed template (see `engine.parse()`). No node-count bound:
 * bounding the cost of a pathologically deep/wide template is the
 * platform's job, not this node's. */
export function walkTagsAndFilters(nodes: WalkNode[]): { tags: string[]; filters: string[] } {
  const tags = new Set<string>();
  const filters = new Set<string>();

  function visit(list: WalkNode[] | undefined): void {
    if (!list) return;
    for (const node of list) {
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
