/**
 * Our photos are two pictures stacked top/bottom. In small square frames we
 * show the two halves side by side instead, so each half keeps roughly its
 * phone-photo shape and nothing important gets cropped.
 */
export default function SplitPhoto({ src, className = '' }: { src: string; className?: string }) {
  return (
    <span className={`split-photo ${className}`} aria-hidden>
      <span>
        <img src={src} alt="" loading="lazy" decoding="async" />
      </span>
      <span>
        <img className="split-bottom" src={src} alt="" loading="lazy" decoding="async" />
      </span>
    </span>
  )
}
