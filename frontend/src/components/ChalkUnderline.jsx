// The platform's signature mark: a hand-scratched chalk underline,
// standing in for the red-pen tick of a graded exam paper.
export default function ChalkUnderline({ width = 140, color = "var(--amber)" }) {
  return (
    <svg
      width={width}
      height="10"
      viewBox="0 0 140 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", marginTop: 2 }}
      aria-hidden="true"
    >
      <path
        d="M2 6.5C22 3.5 44 8.5 66 5C88 1.5 108 7.5 138 4"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
