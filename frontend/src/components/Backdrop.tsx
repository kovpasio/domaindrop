export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-gradient-to-b from-ink-900 via-ink-950 to-ink-950" />
      <div className="absolute inset-0 bg-grid-fade bg-[size:48px_48px] opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
      <div className="absolute -left-40 -top-32 h-96 w-96 rounded-full bg-accent/[0.11] blur-[120px]" />
      <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-rarity-epic/[0.08] blur-[130px]" />
      <div className="absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-teal/[0.055] blur-[120px]" />
      <div className="noise absolute inset-0 opacity-[0.022]" />
    </div>
  );
}
