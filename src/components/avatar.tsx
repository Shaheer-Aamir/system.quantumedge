type Props = { name: string; src?: string | null; size?: number };

export function Avatar({ name, src, size = 40 }: Props) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span style={{ ...style, fontSize: size * 0.38 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-white" aria-hidden="true">
      {initials || <i className="bi bi-person" />}
    </span>
  );
}
