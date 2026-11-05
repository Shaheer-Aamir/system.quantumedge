import logo from "@/app/qe-logo.png";

export function Logo({ height = 40, className }: { height?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo.src} alt="Quantum Edge" width={Math.round((height * logo.width) / logo.height)} height={height}
      style={{ height, width: "auto" }} className={className} />
  );
}
