/** Parse JSON without silently accepting duplicate (including escaped) keys. */
export function parseUniqueJSON(source: string): unknown {
  const value: unknown = JSON.parse(source);
  // Only tokenize valid JSON, and consume entire strings so embedded braces
  // and escaped quotes cannot alter nesting. Callers own their size limits.
  const objects: Set<string>[] = [];
  for (const match of source.matchAll(/"(?:[^"\\]|\\.)*"\s*:?|[{}]/g)) {
    const token = match[0];
    if (token === '{') objects.push(new Set());
    else if (token === '}') objects.pop();
    else if (token.endsWith(':')) {
      const key: string = JSON.parse(token.slice(0, -1)), current = objects.at(-1)!;
      if (current.has(key)) throw new Error('Duplicate JSON fields.');
      current.add(key);
    }
  }
  return value;
}
