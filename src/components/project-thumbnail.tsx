'use client';

/**
 * Project thumbnail with a fallback.
 *
 * Adding a project to data.ts shouldn't depend on remembering to drop a PNG
 * into public/project-images first — a missing file used to leave a broken
 * image in the middle of the grid. When the image can't load, the card shows
 * the project's initials on a tinted panel instead, which reads as deliberate.
 */

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ProjectThumbnailProps {
    src: string;
    alt: string;
    aiHint?: string;
    sizes?: string;
    className?: string;
}

/** Up to two initials, so "Ek Aur" reads as EA and "AURA" as A. */
const initialsOf = (title: string): string =>
    title
        .replace(/[^A-Za-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('');

export const ProjectThumbnail: React.FC<ProjectThumbnailProps> = ({
    src,
    alt,
    aiHint,
    sizes,
    className,
}) => {
    const [failed, setFailed] = useState(false);

    if (failed) {
        return (
            <div
                className={cn(
                    'flex h-full w-full items-center justify-center',
                    'bg-gradient-to-br from-primary/25 via-background to-accent/20',
                    className
                )}
                aria-label={alt}
                role="img"
            >
                <span className="text-5xl font-extrabold tracking-tight text-foreground/70">
                    {initialsOf(alt)}
                </span>
            </div>
        );
    }

    return (
        <Image
            src={src}
            alt={alt}
            fill
            className={className}
            data-ai-hint={aiHint}
            sizes={sizes}
            onError={() => setFailed(true)}
        />
    );
};

export default ProjectThumbnail;
