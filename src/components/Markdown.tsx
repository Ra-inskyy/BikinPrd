import { Check, Square } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Renderer Markdown minimal tanpa dependensi, dioptimalkan untuk spec PRD.
 * Mendukung: heading, bold/italic/inline-code, link, daftar tak berurut &
 * berurut, checklist task (- [ ] / - [x]), code fence, blockquote, hr.
 */

let keyCounter = 0;
const nextKey = () => `md-${keyCounter++}`;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Urutan penting: kode dulu supaya tidak diformat di dalamnya.
  const regex =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(<code key={nextKey()}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={nextKey()}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={nextKey()}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (m) {
        nodes.push(
          <a key={nextKey()} href={m[2]} target="_blank" rel="noreferrer">
            {m[1]}
          </a>,
        );
      }
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function Markdown({ content }: { content: string }) {
  const lines = (content || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blok kode (code fence)
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // lewati penutup fence
      blocks.push(
        <pre key={nextKey()}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Judul (heading)
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
      blocks.push(<Tag key={nextKey()}>{renderInline(text)}</Tag>);
      i++;
      continue;
    }

    // Garis horizontal
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<hr key={nextKey()} />);
      i++;
      continue;
    }

    // Kutipan (blockquote)
    if (line.trim().startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={nextKey()}>{renderInline(quote.join(" "))}</blockquote>,
      );
      continue;
    }

    // Daftar (tak berurut / berurut / task)
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const raw = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, "");
        const task = /^\[([ xX])\]\s+(.*)$/.exec(raw);
        if (task) {
          const done = task[1].toLowerCase() === "x";
          items.push(
            <li key={nextKey()} className="task-item">
              {done ? (
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              ) : (
                <Square className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <span className={done ? "text-muted-foreground" : undefined}>
                {renderInline(task[2])}
              </span>
            </li>,
          );
        } else {
          items.push(<li key={nextKey()}>{renderInline(raw)}</li>);
        }
        i++;
      }
      blocks.push(
        ordered ? (
          <ol key={nextKey()}>{items}</ol>
        ) : (
          <ul key={nextKey()}>{items}</ul>
        ),
      );
      continue;
    }

    // Baris kosong
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraf (kumpulkan baris berurutan yang tidak kosong & non-spesial)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(">")
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={nextKey()}>{renderInline(para.join(" "))}</p>);
  }

  return <div className="prose-prd">{blocks}</div>;
}
