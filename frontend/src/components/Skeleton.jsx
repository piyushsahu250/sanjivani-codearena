// Loading-state placeholders using the existing `.skeleton` shimmer class from theme.css.
export function SkeletonLine({ width = "100%", height = 14, style }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

export function SkeletonCard({ height = 90 }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <SkeletonLine width="50%" height={11} />
      <SkeletonLine width="70%" height={22} style={{ marginTop: 10 }} />
      <SkeletonLine width="90%" height={height > 90 ? height - 60 : 10} style={{ marginTop: 10 }} />
    </div>
  );
}

export function SkeletonGrid({ count = 4, minWidth = 160 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`, gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
