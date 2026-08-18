import { Link } from "@/i18n/navigation";

/**
 * Small, dependency-free markdown renderer for agent-drafted articles.
 *
 * Deliberately narrow: headings, paragraphs, lists, tables, bold/italic/code
 * and links. Nothing is rendered as raw HTML, so a model that emits a <script>
 * tag produces visible text rather than an XSS hole.
 */

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern =
    /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[1]) {
      const href = match[3];
      const label = match[2];
      nodes.push(
        href.startsWith("/") ? (
          <Link key={key} href={href} className="link-slide font-medium text-brand-700 underline-offset-4 hover:underline">
            {label}
          </Link>
        ) : (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer nofollow"
            className="font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            {label}
          </a>
        ),
      );
    } else if (match[4]) {
      nodes.push(
        <strong key={key} className="font-medium text-ink-900">
          {match[5]}
        </strong>,
      );
    } else if (match[6]) {
      nodes.push(
        <code key={key} className="num rounded bg-paper-dark px-1.5 py-0.5 text-[0.9em]">
          {match[7]}
        </code>,
      );
    } else if (match[8]) {
      nodes.push(<em key={key}>{match[9]}</em>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function TableBlock({ rows, keyPrefix }: { rows: string[]; keyPrefix: string }) {
  const cells = rows
    .filter((r) => !/^\|[\s:|-]+\|$/.test(r.trim()))
    .map((row) =>
      row
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim()),
    );
  if (!cells.length) return null;
  const [header, ...body] = cells;
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-ink-200">
      <table className="w-full text-sm">
        <thead className="bg-paper-dark">
          <tr>
            {header.map((cell, i) => (
              <th
                key={i}
                className="num border-b border-ink-200 px-4 py-2.5 text-start text-[10px] uppercase tracking-[0.1em] text-ink-500"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 bg-white">
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="px-4 py-2.5 align-top text-ink-700">
                  {inline(cell, `${keyPrefix}-${r}-${c}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let orderedBuffer: string[] = [];
  let tableBuffer: string[] = [];

  const flushLists = () => {
    if (listBuffer.length) {
      const items = [...listBuffer];
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-4 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-ink-700">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
              <span className="leading-relaxed">{inline(item, `li-${blocks.length}-${i}`)}</span>
            </li>
          ))}
        </ul>,
      );
      listBuffer = [];
    }
    if (orderedBuffer.length) {
      const items = [...orderedBuffer];
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="my-4 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-ink-700">
              <span className="num mt-0.5 shrink-0 text-xs font-medium text-brand-700">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="leading-relaxed">{inline(item, `oli-${blocks.length}-${i}`)}</span>
            </li>
          ))}
        </ol>,
      );
      orderedBuffer = [];
    }
    if (tableBuffer.length) {
      blocks.push(
        <TableBlock key={`tbl-${blocks.length}`} rows={[...tableBuffer]} keyPrefix={`t${blocks.length}`} />,
      );
      tableBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      tableBuffer.push(trimmed);
      continue;
    }
    if (tableBuffer.length) flushLists();

    if (!trimmed) {
      flushLists();
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      if (orderedBuffer.length) flushLists();
      listBuffer.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      if (listBuffer.length) flushLists();
      orderedBuffer.push(trimmed.replace(/^\d+\.\s+/, ""));
      continue;
    }
    flushLists();

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={blocks.length} className="mt-8 text-lg font-medium text-ink-900">
          {inline(trimmed.slice(4), `h3-${blocks.length}`)}
        </h3>,
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={blocks.length} className="mt-10 font-display text-2xl font-medium tracking-tight text-ink-900">
          {inline(trimmed.slice(3), `h2-${blocks.length}`)}
        </h2>,
      );
    } else if (trimmed.startsWith("# ")) {
      blocks.push(
        <h2 key={blocks.length} className="mt-10 font-display text-2xl font-medium tracking-tight text-ink-900">
          {inline(trimmed.slice(2), `h1-${blocks.length}`)}
        </h2>,
      );
    } else if (trimmed.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={blocks.length}
          className="my-5 border-s-2 border-brand-400 ps-4 text-ink-600 italic"
        >
          {inline(trimmed.slice(2), `q-${blocks.length}`)}
        </blockquote>,
      );
    } else {
      blocks.push(
        <p key={blocks.length} className="mt-4 leading-relaxed text-ink-700">
          {inline(trimmed, `p-${blocks.length}`)}
        </p>,
      );
    }
  }
  flushLists();

  return <div className="max-w-none">{blocks}</div>;
}
