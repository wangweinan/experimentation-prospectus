export function InfoTip({ text }: { text: string }) {
  return (
    <span
      className="info-tip"
      tabIndex={0}
      role="note"
      aria-label={`How this works: ${text}`}
      data-tooltip={text}
      title={text}
    >
      ?
    </span>
  );
}
