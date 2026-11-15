'use client';

import { useEffect } from 'react';
import { startTracking } from '@/lib/analytics/track';

/**
 * Starts visitor analytics once the page is idle, so it never competes with
 * the first paint. Everything else lives in lib/analytics/track.ts.
 */
export default function VisitorTracker() {
    useEffect(() => {
        type IdleWindow = Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
            cancelIdleCallback?: (id: number) => void;
        };
        const w = window as IdleWindow;

        if (typeof w.requestIdleCallback === 'function') {
            const id = w.requestIdleCallback(() => void startTracking(), { timeout: 3000 });
            return () => w.cancelIdleCallback?.(id);
        }
        const timer = setTimeout(() => void startTracking(), 1500);
        return () => clearTimeout(timer);
    }, []);

    return null;
}
