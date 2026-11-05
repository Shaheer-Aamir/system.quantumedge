import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

// Renders the small formatting set used in scripts: # heading, ## subheading, **bold**, - bullet, > words to say.
export function ScriptView({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: number) => {
    if (!bullets.length) return;
    out.push(<ul key={`ul${key}`} className="my-2 list-disc space-y-1 pl-6">{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
    bullets = [];
  };
  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^[-*]\s+/.test(line)) { bullets.push(line.replace(/^[-*]\s+/, "")); return; }
    flush(i);
    if (line.startsWith("## ")) out.push(<h4 key={i} className="mb-1 mt-4 font-semibold">{inline(line.slice(3))}</h4>);
    else if (line.startsWith("# ")) out.push(<h3 key={i} className="mb-1 mt-5 text-lg font-semibold">{inline(line.slice(2))}</h3>);
    else if (line.startsWith("> ")) out.push(<blockquote key={i} className="my-2 border-l-2 border-ice pl-4 italic">{inline(line.slice(2))}</blockquote>);
    else if (line.trim() === "") out.push(<div key={i} className="h-2" />);
    else out.push(<p key={i}>{inline(line)}</p>);
  });
  flush(-1);
  return <div className="space-y-0.5 text-[15px] leading-relaxed">{out}</div>;
}
