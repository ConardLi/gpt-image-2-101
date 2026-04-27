import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from 'react';

interface SkeletonImgProps extends ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Optional accent color used to lightly tint the placeholder.
   * Pass the case's `category_accent` so the skeleton picks up the visual
   * language of the category it's about to reveal.
   */
  accent?: string;
}

/**
 * Drop-in replacement for `<img>` that renders a friendly skeleton placeholder
 * underneath while the real bitmap is decoding. Once the image fires `onLoad`
 * (or is already in the browser cache on mount) the skeleton fades out and
 * the image fades in.
 *
 * Must be placed inside a `position: relative` parent so the absolutely
 * positioned skeleton can stretch to cover it.
 */
export function SkeletonImg({
  accent,
  className,
  onLoad,
  onError,
  ...rest
}: SkeletonImgProps) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // If the browser served the image from cache, the native `load` event
  // may have fired before React mounted us. Check `complete` on mount.
  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true);
    onLoad?.(e);
  };
  const handleError = (e: SyntheticEvent<HTMLImageElement>) => {
    // Treat decode errors as "loaded" so the user isn't stuck staring at a
    // shimmering skeleton forever — the broken-image icon is more honest.
    setLoaded(true);
    onError?.(e);
  };

  return (
    <>
      {!loaded && (
        <span
          className="cs-skel"
          aria-hidden="true"
          style={accent ? ({ '--cs-accent': accent } as CSSProperties) : undefined}
        >
          <svg
            className="cs-skel-icon"
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            aria-hidden="true"
          >
            <rect x="3" y="6" width="26" height="20" rx="2" />
            <circle cx="11" cy="13" r="2" />
            <path d="M3 22l7-7 6 5 5-4 8 6" />
          </svg>
        </span>
      )}
      <img
        {...rest}
        ref={ref}
        className={`${className ?? ''} ${loaded ? 'cs-img-on' : 'cs-img-off'}`.trim()}
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  );
}
