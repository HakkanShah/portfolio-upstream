import { cn } from '@/lib/utils';
import React from 'react';

type AnimatedDivProps = {
  children: React.ReactNode;
  className?: string;
  /** Milliseconds before the reveal starts once the element is on screen. */
  delay?: number;
  variant?: 'fade' | 'slide' | 'scale' | 'slideLeft' | 'slideRight';
  /** Seconds. */
  duration?: number;
  as?: keyof React.JSX.IntrinsicElements;
};

/**
 * Reveals its content when it scrolls into view.
 *
 * This used to be a framer-motion component that rendered at opacity 0 and
 * only became visible once React had loaded and an observer fired. On a slow
 * phone that left whole sections blank for seconds, and it is why the hero
 * photo was the page's slowest paint. It is now plain markup: the effect is
 * CSS (`[data-reveal]` in globals.css), started by a small script in the
 * document head that runs before React does (see `REVEAL_SCRIPT` in
 * app/layout.tsx). Without JavaScript nothing is hidden.
 */
const AnimatedDiv: React.FC<AnimatedDivProps> = ({
  children,
  className,
  delay = 0,
  variant = 'slide',
  duration = 0.6,
  as = 'div',
}) => {
  // Every tag takes these three props; the cast just keeps TS from
  // computing the union of all intrinsic elements' prop types.
  const Tag = as as 'div';

  return (
    <Tag
      data-reveal={variant}
      className={cn(className)}
      style={
        {
          '--reveal-delay': `${delay}ms`,
          '--reveal-duration': `${duration}s`,
        } as React.CSSProperties
      }
    >
      {children}
    </Tag>
  );
};

export default AnimatedDiv;
