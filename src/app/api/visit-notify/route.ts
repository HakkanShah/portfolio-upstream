import { NextResponse } from 'next/server';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    editMessage,
    isBot,
    lookupIsp,
    makeToken,
    postMessage,
    rateLimited,
    readToken,
    requestFacts,
    resumeEmbed,
    visitEmbed,
} from '@/lib/analytics/server';
import type { ClientInfo, Engagement, ResumeKind, ResumeVia } from '@/lib/analytics/track';

/**
 * Discord notifications for visits and resume downloads.
 *
 *   { type: 'visit' }   posts a new message and returns a signed token for it
 *   { type: 'update' }  edits that message with what the visitor did
 *   { type: 'resume' }  posts a separate message for a resume open/download
 *
 * Bots are dropped without a message and without being counted.
 */

const RESUME_VIAS: ResumeVia[] = ['hero', 'terminal', 'assistant', 'preview'];
const RESUME_KINDS: ResumeKind[] = ['preview', 'download'];

/**
 * The next visit number, exactly once per visit. The old read-then-increment
 * could hand two simultaneous visitors the same number.
 */
async function nextVisitNumber(): Promise<number | null> {
    try {
        const ref = doc(db, 'site_stats', 'visitors');
        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            const next = (snap.exists() ? Number(snap.data().count) || 0 : 0) + 1;
            tx.set(ref, { count: next }, { merge: true });
            return next;
        });
    } catch (error) {
        // The message still goes out, just without a number.
        console.error('[visit-notify] visitor count failed:', error instanceof Error ? error.message : error);
        return null;
    }
}

/** Only fields of the expected shape get through to the message. */
const asClient = (value: unknown): Partial<ClientInfo> =>
    value && typeof value === 'object' ? (value as Partial<ClientInfo>) : {};

const asEngagement = (value: unknown): Engagement | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const e = value as Partial<Engagement>;
    const strings = (list: unknown, max: number) =>
        Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, max).map((x) => x.slice(0, 60)) : [];
    return {
        activeMs: Math.max(0, Math.min(Number(e.activeMs) || 0, 24 * 3600 * 1000)),
        maxScroll: Math.max(0, Math.min(Number(e.maxScroll) || 0, 100)),
        sections: strings(e.sections, 12),
        assistantOpened: Boolean(e.assistantOpened),
        assistantQuestions: Math.max(0, Math.min(Number(e.assistantQuestions) || 0, 999)),
        terminalCommands: strings(e.terminalCommands, 12),
        games: strings(e.games, 10),
        outbound: strings(e.outbound, 10),
        contactForm: Boolean(e.contactForm),
        resume: Array.isArray(e.resume)
            ? e.resume
                  .filter((r) => r && RESUME_VIAS.includes(r.via))
                  .slice(0, 6)
                  .map((r) => ({ via: r.via, kinds: (r.kinds ?? []).filter((k) => RESUME_KINDS.includes(k)) }))
            : [],
    };
};

/** Requests must come from the site itself (or local development). */
const fromThisSite = (req: Request): boolean => {
    const origin = req.headers.get('origin');
    if (!origin) return true; // sendBeacon from some browsers omits it
    try {
        const host = new URL(origin).hostname;
        return host === 'hakkan.is-a.dev' || host === 'localhost' || host.endsWith('.vercel.app');
    } catch {
        return false;
    }
};

export async function POST(req: Request) {
    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (!webhook) {
        console.error('[visit-notify] DISCORD_WEBHOOK_URL is not set');
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const facts = requestFacts(req);
    if (isBot(facts.userAgent)) return new NextResponse(null, { status: 204 });
    if (!fromThisSite(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: Record<string, unknown>;
    try {
        body = (await req.json()) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    const client = asClient(body.client);
    const engagement = asEngagement(body.engagement);

    try {
        switch (body.type) {
            case 'visit': {
                if (rateLimited(`visit:${facts.ip}`, 6, 10 * 60 * 1000)) {
                    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
                }
                const [visitNumber, isp] = await Promise.all([nextVisitNumber(), lookupIsp(facts.ip)]);
                const left = body.final === true;
                const messageId = await postMessage(webhook, visitEmbed({ visitNumber, facts, client, engagement, isp, left }));
                const token = messageId ? makeToken({ messageId, visitNumber: visitNumber ?? 0, startedAt: Date.now() }, webhook) : null;
                return NextResponse.json({ token, visitNumber });
            }

            case 'update': {
                const token = readToken(body.token, webhook);
                if (!token) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
                if (rateLimited(`update:${token.messageId}`, 30, 10 * 60 * 1000)) {
                    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
                }
                const isp = await lookupIsp(facts.ip);
                await editMessage(
                    webhook,
                    token.messageId,
                    visitEmbed({ visitNumber: token.visitNumber, facts, client, engagement, isp, left: true })
                );
                return NextResponse.json({ ok: true });
            }

            case 'resume': {
                const via = RESUME_VIAS.includes(body.via as ResumeVia) ? (body.via as ResumeVia) : null;
                const kinds = Array.isArray(body.kinds)
                    ? (body.kinds as unknown[]).filter((k): k is ResumeKind => RESUME_KINDS.includes(k as ResumeKind))
                    : [];
                if (!via || !kinds.length) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
                if (rateLimited(`resume:${facts.ip}`, 5, 10 * 60 * 1000)) {
                    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
                }
                const visitNumber = Number.isInteger(body.visitNumber) ? (body.visitNumber as number) : null;
                await postMessage(webhook, resumeEmbed({ via, kinds, visitNumber, facts, client }));
                return NextResponse.json({ ok: true });
            }

            default:
                return NextResponse.json({ error: 'Bad request' }, { status: 400 });
        }
    } catch (error) {
        console.error('[visit-notify]', error instanceof Error ? error.message : error);
        return NextResponse.json({ error: 'Notification failed' }, { status: 502 });
    }
}
