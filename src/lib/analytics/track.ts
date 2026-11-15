/**
 * Visitor analytics, browser side.
 *
 * One Discord message per visit: `startTracking()` posts it once the page is
 * idle, and every time the tab is hidden (switching apps, closing the tab)
 * the same message is edited with what the visitor did since. Resume opens
 * and downloads also get a message of their own.
 *
 * Nothing here may slow the page or throw: every call is fire-and-forget and
 * wrapped, and storage access tolerates private mode.
 */

export type ResumeVia = 'hero' | 'terminal' | 'assistant' | 'preview';
export type ResumeKind = 'preview' | 'download';

export type TrackEvent =
    | { type: 'assistant_open' }
    | { type: 'assistant_question' }
    | { type: 'terminal_command'; command: string }
    | { type: 'game_open'; game: string }
    | { type: 'outbound'; label: string }
    | { type: 'contact_form' }
    /** `via` omitted: the download that follows a preview, credited to whatever opened it. */
    | { type: 'resume'; via?: ResumeVia; kind: ResumeKind };

/** What the visitor did, as the visit message shows it. */
export interface Engagement {
    activeMs: number;
    maxScroll: number;
    sections: string[];
    assistantOpened: boolean;
    assistantQuestions: number;
    terminalCommands: string[];
    games: string[];
    outbound: string[];
    contactForm: boolean;
    resume: { via: ResumeVia; kinds: ResumeKind[] }[];
}

/** Browser facts the server can't see in the request headers. */
export interface ClientInfo {
    visitorId: string;
    referrer: string;
    landing: string;
    utm: Record<string, string>;
    screen: string;
    viewport: string;
    dpr: number;
    languages: string[];
    timezone: string;
    colorScheme: 'dark' | 'light';
    touch: boolean;
    connection?: string;
    saveData?: boolean;
    deviceMemory?: number;
    cores?: number;
    /** Client hints: the real device model and OS version on Chromium. */
    model?: string;
    platformVersion?: string;
    browserVersion?: string;
    visits: number;
    firstSeen: number;
    lastSeen: number | null;
}

const VISITOR_KEY = 'hk_visitor';
const SESSION_KEY = 'hk_visit_session';
const ENDPOINT = '/api/visit-notify';

const store = {
    get<T>(storage: 'local' | 'session', key: string): T | null {
        try {
            const raw = (storage === 'local' ? localStorage : sessionStorage).getItem(key);
            return raw ? (JSON.parse(raw) as T) : null;
        } catch {
            return null;
        }
    },
    set(storage: 'local' | 'session', key: string, value: unknown): void {
        try {
            (storage === 'local' ? localStorage : sessionStorage).setItem(key, JSON.stringify(value));
        } catch {
            // Private mode: this visit just won't be remembered.
        }
    },
};

interface VisitorRecord {
    id: string;
    visits: number;
    firstSeen: number;
    lastSeen: number;
}

interface SessionRecord {
    /** Signed by the server; lets this tab edit its own message and no other. */
    token: string | null;
    visitNumber: number | null;
    engagement: Engagement;
}

const emptyEngagement = (): Engagement => ({
    activeMs: 0,
    maxScroll: 0,
    sections: [],
    assistantOpened: false,
    assistantQuestions: 0,
    terminalCommands: [],
    games: [],
    outbound: [],
    contactForm: false,
    resume: [],
});

let started = false;
let client: ClientInfo | null = null;
let session: SessionRecord = { token: null, visitNumber: null, engagement: emptyEngagement() };
let visitSent = false;
let activeSince: number | null = null;
let dirty = false;
/** Active time already reported, so reading without clicking still updates. */
let reportedActiveMs = 0;
/** They switched away while the first message was still being posted. */
let leftBeforeToken = false;

const pushUnique = (list: string[], value: string, max = 12) => {
    if (value && !list.includes(value) && list.length < max) list.push(value);
};

const saveSession = () => store.set('session', SESSION_KEY, session);

/** Active time only counts while the tab is visible. */
const flushActiveTime = () => {
    if (activeSince !== null) {
        session.engagement.activeMs += Date.now() - activeSince;
        activeSince = document.visibilityState === 'visible' ? Date.now() : null;
    }
};

const post = (body: unknown, beacon: boolean): Promise<Response | null> => {
    const json = JSON.stringify(body);
    if (beacon && typeof navigator.sendBeacon === 'function') {
        // Survives the tab closing, which fetch does not reliably.
        const ok = navigator.sendBeacon(ENDPOINT, new Blob([json], { type: 'application/json' }));
        if (ok) return Promise.resolve(null);
    }
    return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
        keepalive: true,
    }).catch(() => null);
};

// ============ Resume: one message per burst ============
// Opening the preview auto-downloads 1.5 s later; that is one event to a
// person, so events within a few seconds are sent as one message.

let resumeTimer: ReturnType<typeof setTimeout> | null = null;
let resumeBurst: { via: ResumeVia; kinds: ResumeKind[] } | null = null;

const sendResume = (beacon: boolean) => {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = null;
    if (!resumeBurst || !client) return;
    const burst = resumeBurst;
    resumeBurst = null;
    void post({ type: 'resume', client, via: burst.via, kinds: burst.kinds, visitNumber: session.visitNumber }, beacon);
};

// ============ Public API ============

export const track = (event: TrackEvent): void => {
    try {
        const e = session.engagement;
        switch (event.type) {
            case 'assistant_open':
                e.assistantOpened = true;
                break;
            case 'assistant_question':
                e.assistantOpened = true;
                e.assistantQuestions += 1;
                break;
            case 'terminal_command':
                pushUnique(e.terminalCommands, event.command.slice(0, 20));
                break;
            case 'game_open':
                pushUnique(e.games, event.game);
                break;
            case 'outbound':
                pushUnique(e.outbound, event.label.slice(0, 60), 10);
                break;
            case 'contact_form':
                e.contactForm = true;
                break;
            case 'resume': {
                const last = e.resume[e.resume.length - 1];
                const via = event.via ?? resumeBurst?.via ?? last?.via ?? 'preview';
                if (last && (last.via === via || !event.via || resumeBurst)) {
                    if (!last.kinds.includes(event.kind)) last.kinds.push(event.kind);
                } else if (e.resume.length < 6) {
                    e.resume.push({ via, kinds: [event.kind] });
                }
                if (!resumeBurst) resumeBurst = { via, kinds: [] };
                if (!resumeBurst.kinds.includes(event.kind)) resumeBurst.kinds.push(event.kind);
                if (resumeTimer) clearTimeout(resumeTimer);
                resumeTimer = setTimeout(() => sendResume(false), 3000);
                break;
            }
        }
        dirty = true;
        saveSession();
    } catch {
        // Analytics never breaks the page.
    }
};

const isAutomated = (): boolean => {
    try {
        return navigator.webdriver === true || /HeadlessChrome|Lighthouse|PageSpeed/i.test(navigator.userAgent);
    } catch {
        return false;
    }
};

/** `isNewVisit` is false for a reload in the same tab, which isn't another visit. */
const collectClientInfo = async (isNewVisit: boolean): Promise<ClientInfo> => {
    const now = Date.now();
    const previous = store.get<VisitorRecord>('local', VISITOR_KEY);
    const visitor: VisitorRecord = !previous
        ? { id: Math.random().toString(36).slice(2, 10), visits: 1, firstSeen: now, lastSeen: now }
        : isNewVisit
            ? { ...previous, visits: previous.visits + 1, lastSeen: now }
            : previous;
    if (isNewVisit || !previous) store.set('local', VISITOR_KEY, visitor);

    const params = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    for (const key of ['ref', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
        const value = params.get(key);
        if (value) utm[key] = value.slice(0, 80);
    }

    type Nav = Navigator & {
        connection?: { effectiveType?: string; saveData?: boolean };
        deviceMemory?: number;
        userAgentData?: { getHighEntropyValues: (hints: string[]) => Promise<Record<string, unknown>> };
    };
    const nav = navigator as Nav;

    let hints: Record<string, unknown> = {};
    try {
        hints = (await nav.userAgentData?.getHighEntropyValues(['model', 'platformVersion', 'uaFullVersion'])) ?? {};
    } catch {
        // Not Chromium, or the hints were refused.
    }

    return {
        visitorId: visitor.id,
        referrer: document.referrer.slice(0, 300),
        landing: (location.pathname + location.hash).slice(0, 120),
        utm,
        screen: `${screen.width}×${screen.height}`,
        viewport: `${innerWidth}×${innerHeight}`,
        dpr: Math.round(devicePixelRatio * 100) / 100,
        languages: (navigator.languages ?? [navigator.language]).slice(0, 3),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        touch: navigator.maxTouchPoints > 0,
        connection: nav.connection?.effectiveType,
        saveData: nav.connection?.saveData,
        deviceMemory: nav.deviceMemory,
        cores: navigator.hardwareConcurrency,
        model: typeof hints.model === 'string' && hints.model ? hints.model : undefined,
        platformVersion: typeof hints.platformVersion === 'string' ? hints.platformVersion : undefined,
        browserVersion: typeof hints.uaFullVersion === 'string' ? hints.uaFullVersion : undefined,
        visits: visitor.visits,
        firstSeen: visitor.firstSeen,
        lastSeen: previous && isNewVisit ? previous.lastSeen : null,
    };
};

/** Sends what happened since the last update, editing the visit message. */
const sendUpdate = () => {
    if (!client) return;
    flushActiveTime();
    if (resumeBurst) sendResume(true);
    const moreTime = session.engagement.activeMs - reportedActiveMs >= 1000;
    if (!dirty && !moreTime && visitSent && session.token) return;
    dirty = false;
    reportedActiveMs = session.engagement.activeMs;
    saveSession();

    if (session.token) {
        void post({ type: 'update', token: session.token, client, engagement: session.engagement }, true);
    } else if (visitSent) {
        // The first message is still on its way; edit it as soon as it lands.
        leftBeforeToken = true;
        dirty = true;
    } else {
        // They left before the first message went out: send it now, complete.
        visitSent = true;
        void post({ type: 'visit', client, engagement: session.engagement, final: true }, true);
    }
};

const watchEngagement = () => {
    activeSince = document.visibilityState === 'visible' ? Date.now() : null;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') sendUpdate();
        // Only restart the clock if it was stopped; a repeated "visible"
        // event must not throw away the time already running.
        else if (activeSince === null) activeSince = Date.now();
    });
    addEventListener('pagehide', sendUpdate);

    let ticking = false;
    addEventListener(
        'scroll',
        () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                const max = document.documentElement.scrollHeight - innerHeight;
                const pct = max > 0 ? Math.min(100, Math.round((scrollY / max) * 100)) : 100;
                if (pct > session.engagement.maxScroll) {
                    session.engagement.maxScroll = pct;
                    dirty = true;
                }
            });
        },
        { passive: true }
    );

    // A section counts as seen once a third of it has been on screen.
    const seen = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting && entry.target.id) {
                    const before = session.engagement.sections.length;
                    pushUnique(session.engagement.sections, entry.target.id);
                    if (session.engagement.sections.length !== before) dirty = true;
                    seen.unobserve(entry.target);
                }
            }
        },
        { threshold: 0.33 }
    );
    const observeSections = () => document.querySelectorAll('section[id]').forEach((el) => seen.observe(el));
    observeSections();
    // Below-the-fold sections stream in after load.
    setTimeout(observeSections, 3000);

    // Links leaving the site: project demos, GitHub, LinkedIn, email.
    document.addEventListener(
        'click',
        (event) => {
            const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!link) return;
            const href = link.href;
            if (href.startsWith('mailto:')) return track({ type: 'outbound', label: 'Email link' });
            if (href.startsWith('tel:')) return track({ type: 'outbound', label: 'Phone link' });
            try {
                const url = new URL(href);
                if (url.origin === location.origin) return;
                const text = (link.getAttribute('aria-label') || link.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
                track({ type: 'outbound', label: `${url.hostname.replace(/^www\./, '')}${text ? ` (${text})` : ''}` });
            } catch {
                // Not a URL we can read.
            }
        },
        { capture: true }
    );
};

export const startTracking = async (): Promise<void> => {
    if (started || typeof window === 'undefined') return;
    started = true;
    if (isAutomated()) return;

    try {
        const previous = store.get<SessionRecord>('session', SESSION_KEY);
        if (previous) {
            // A reload in the same tab: keep editing the same message.
            session = { ...previous, engagement: { ...emptyEngagement(), ...previous.engagement } };
            visitSent = true;
        }

        client = await collectClientInfo(!previous);
        watchEngagement();
        if (visitSent) return;

        visitSent = true;
        const res = await post({ type: 'visit', client, engagement: session.engagement }, false);
        if (res?.ok) {
            const data = (await res.json().catch(() => null)) as { token?: string; visitNumber?: number } | null;
            session.token = data?.token ?? null;
            session.visitNumber = data?.visitNumber ?? null;
            saveSession();
            if (leftBeforeToken && session.token) sendUpdate();
        }
    } catch {
        // Analytics never breaks the page.
    }
};
