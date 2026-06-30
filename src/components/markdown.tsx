import type { ReactNode } from "react";

function renderInline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={keyBase + i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={keyBase + i}>{part}</span>
    ),
  );
}

/** Minimal renderer for the headings/bullets/bold the coach returns. */
export function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (bullets.length) {
      const items = bullets;
      out.push(
        <ul key={"ul" + key} className="my-2 space-y-1.5">
          {items.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink-soft">
              <span className="mt-0.5 text-accent">•</span>
              <span>{renderInline(b, "b" + key + i)}</span>
            </li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  text.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("## ")) {
      flush(String(i));
      out.push(
        <h4 key={"h" + i} className="mt-3 mb-1 text-sm font-semibold text-ink first:mt-0">
          {t.slice(3)}
        </h4>,
      );
    } else if (t.startsWith("- ")) {
      bullets.push(t.slice(2));
    } else if (t === "") {
      flush(String(i));
    } else {
      flush(String(i));
      out.push(
        <p key={"p" + i} className="text-sm leading-relaxed text-ink-soft">
          {renderInline(t, "p" + i)}
        </p>,
      );
    }
  });
  flush("end");
  return <div className="space-y-1">{out}</div>;
}
