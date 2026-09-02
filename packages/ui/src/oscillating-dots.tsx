export function OscillatingDots() {
  return (
    <span
      className="inline-flex w-[1.05em] justify-between motion-reduce:w-auto"
      aria-hidden="true"
    >
      <span className="inline-block animate-oscillating-dot motion-reduce:hidden">
        .
      </span>
      <span className="inline-block animate-oscillating-dot delay-[0.18s] motion-reduce:hidden">
        .
      </span>
      <span className="inline-block animate-oscillating-dot delay-[0.36s] motion-reduce:hidden">
        .
      </span>
      <span className="hidden motion-reduce:inline">...</span>
    </span>
  );
}
