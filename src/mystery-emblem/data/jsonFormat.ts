/**
 * Readable JSON Formatter for Editor-Written Project Files (`jsonFormat.ts`)
 *
 * Keeps short arrays/objects on one line and expands the rest with 2-space indentation,
 * so files written by the Dev Tools editors stay compact and produce small git diffs.
 */

export function formatProjectJson(value: unknown, maxInlineWidth = 100): string {
  return `${formatNode(value, 0, maxInlineWidth)}\n`;
}

function formatNode(value: unknown, depth: number, maxWidth: number): string {
  const inline = JSON.stringify(value);
  if (inline === undefined) return 'null';
  if (value === null || typeof value !== 'object') return inline;

  const indent = '  '.repeat(depth);
  if (inline.length + indent.length <= maxWidth) return spaceInline(value);

  const childIndent = '  '.repeat(depth + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => `${childIndent}${formatNode(item, depth + 1, maxWidth)}`);
    return `[\n${items.join(',\n')}\n${indent}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined
  );
  if (entries.length === 0) return '{}';
  const lines = entries.map(
    ([k, v]) => `${childIndent}${JSON.stringify(k)}: ${formatNode(v, depth + 1, maxWidth)}`
  );
  return `{\n${lines.join(',\n')}\n${indent}}`;
}

/** Single-line form with a space after `:` and `,` for readability. */
function spaceInline(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => spaceInline(v)).join(', ')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined
  );
  if (entries.length === 0) return '{}';
  return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${spaceInline(v)}`).join(', ')} }`;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const hasArrayOfObjects = (v: unknown): boolean =>
  isPlainObject(v) &&
  Object.values(v).some((x) => Array.isArray(x) && x.some((item) => item !== null && typeof item === 'object'));

/**
 * Formats a `chapter.json` in the hand-written house style: top-level `"key": value`, tile rows
 * and spawn lists one item per line in compact JSON, and events expanded with short actions inline.
 */
export function formatChapterJson(chapter: Record<string, unknown>): string {
  const compact = (v: unknown) => JSON.stringify(v);
  const pad = (n: number) => '  '.repeat(n);

  const nested = (value: unknown, depth: number): string => {
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      if (value.every((x) => x === null || typeof x !== 'object') && compact(value).length <= 100) return compact(value);
      return `[\n${value.map((x) => `${pad(depth + 1)}${nested(x, depth + 1)}`).join(',\n')}\n${pad(depth)}]`;
    }
    if (isPlainObject(value)) {
      const expand = hasArrayOfObjects(value) || ('type' in value && depth >= 4 && compact(value).length > 70);
      if (!expand) return compact(value);
      const lines = Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${pad(depth + 1)}${JSON.stringify(k)}:${nested(v, depth + 1)}`);
      return `{\n${lines.join(',\n')}\n${pad(depth)}}`;
    }
    return compact(value);
  };

  const lines = Object.entries(chapter)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => {
      let body: string;
      if (Array.isArray(value)) {
        const primitives = value.every((x) => x === null || typeof x !== 'object');
        body =
          value.length === 0
            ? '[]'
            : primitives && key !== 'rows' && compact(value).length <= 100
              ? compact(value)
              : `[\n${value.map((item) => `${pad(2)}${key === 'events' ? nested(item, 2) : compact(item)}`).join(',\n')}\n${pad(1)}]`;
      } else {
        body = compact(value);
      }
      return `${pad(1)}${JSON.stringify(key)}: ${body}`;
    });
  return `{\n${lines.join(',\n')}\n}\n`;
}
