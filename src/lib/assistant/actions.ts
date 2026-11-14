/**
 * Assistant actions
 *
 * What the assistant can *do* on the page, as opposed to say. Every action is
 * declared as data so the on-device brain, the model route and the UI all
 * speak the same vocabulary, and so the client can decide how to run one.
 *
 * Nothing here trusts a URL it was handed: a target is checked against the
 * page's real sections, and a link against a small scheme allowlist, before
 * anything happens.
 */

import { getSectionId, type SectionId } from './sections';

export type AssistantAction =
    | { type: 'navigate'; target: SectionId; label?: string }
    | { type: 'open_url'; url: string; label: string }
    | { type: 'download'; url: string; label: string };

export interface ActionOutcome {
    /** The action ran to completion without the browser getting in the way. */
    done: boolean;
    /** The browser blocked it — the visitor has to tap the button instead. */
    blocked: boolean;
}

const SAFE_SCHEMES = ['https:', 'http:', 'mailto:', 'tel:'];

/**
 * A link is only followed if it is an absolute URL on a scheme we allow, or a
 * path on this site. Anything else (javascript:, data:) is dropped.
 */
export const isSafeUrl = (url: string): boolean => {
    if (!url) return false;
    if (url.startsWith('/')) return !url.startsWith('//');

    try {
        return SAFE_SCHEMES.includes(new URL(url).protocol);
    } catch {
        return false;
    }
};

/** Drops anything malformed, so the UI never renders a dead button. */
export const sanitizeActions = (actions: AssistantAction[] | undefined): AssistantAction[] => {
    if (!actions?.length) return [];

    const seen = new Set<string>();
    const safe: AssistantAction[] = [];

    for (const action of actions) {
        if (action.type === 'navigate') {
            const target = getSectionId(action.target);
            if (!target) continue;
            const key = `navigate:${target}`;
            if (seen.has(key)) continue;
            seen.add(key);
            safe.push({ ...action, target });
            continue;
        }

        if (!isSafeUrl(action.url)) continue;
        const key = `${action.type}:${action.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        safe.push(action);
    }

    return safe.slice(0, 3);
};

/** How the assistant says what it is about to do. */
export const describeAction = (action: AssistantAction): string => {
    switch (action.type) {
        case 'navigate':
            return `Taking you to ${action.target}.`;
        case 'download':
            return `Opening ${action.label.toLowerCase()}.`;
        case 'open_url':
        default:
            return `Opening ${action.label.toLowerCase()}.`;
    }
};

const scrollToSection = (target: SectionId): boolean => {
    const element = document.getElementById(target);
    if (!element) return false;

    // On a phone the chat is a sheet that locks the page's scroll while it is
    // open. The visitor has just asked to be taken somewhere, so release it —
    // otherwise scrollTo is silently a no-op and the assistant looks like it
    // ignored them.
    if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
    }

    const offset = element.getBoundingClientRect().top + window.pageYOffset - 100;
    window.scrollTo({ top: offset, behavior: 'smooth' });
    return true;
};

/**
 * Run an action in the browser.
 *
 * A pop-up opened outside a user gesture is usually blocked — and an answer
 * arrives after a network round trip or after speech, so the gesture is long
 * gone. We try anyway, and report `blocked` so the caller can leave the button
 * on screen for the visitor to tap.
 */
export const executeAction = (action: AssistantAction): ActionOutcome => {
    if (typeof window === 'undefined') return { done: false, blocked: false };

    try {
        if (action.type === 'navigate') {
            return { done: scrollToSection(action.target), blocked: false };
        }

        if (!isSafeUrl(action.url)) return { done: false, blocked: false };

        if (action.type === 'download') {
            const link = document.createElement('a');
            link.href = action.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            link.remove();
            return { done: true, blocked: false };
        }

        const opened = window.open(action.url, '_blank', 'noopener,noreferrer');
        return { done: Boolean(opened), blocked: !opened };
    } catch {
        return { done: false, blocked: true };
    }
};
