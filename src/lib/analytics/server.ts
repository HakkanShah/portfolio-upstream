/**
 * Visitor analytics, server side: who the request is from, and how it reads
 * in Discord. Used only by app/api/visit-notify.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { UAParser } from 'ua-parser-js';
import type { ClientInfo, Engagement, ResumeKind, ResumeVia } from './track';

// ============ Bots ============

/**
 * Things that run the page's JavaScript without a person behind them:
 * search crawlers that render pages, Lighthouse and PageSpeed, uptime
 * checks and automated browsers. They used to be announced and counted (a
 * headless Chrome in a Google data centre showed up as "Council Bluffs, US").
 *
 * Link-preview bots (WhatsApp, Telegram, Discord, Slack) never run
 * JavaScript, so they never reach this endpoint; matching those names would
 * only drop real people using those apps' built-in browsers.
 */
const BOT_UA =
    /bot\b|bot\/|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|page speed|google-pagerenderer|googleother|google-inspectiontool|gtmetrix|pingdom|uptime|phantom|puppeteer|playwright|selenium|cypress|electron\/|python|curl|wget|httpie|axios|node-fetch|undici|go-http|okhttp|java\/|libwww|vercel-screenshot/i;

export const isBot = (userAgent: string): boolean => !userAgent || userAgent.length < 20 || BOT_UA.test(userAgent);

// ============ Request facts ============

export interface RequestFacts {
    ip: string;
    userAgent: string;
    city?: string;
    region?: string;
    country?: string;
    latitude?: string;
    longitude?: string;
    timezone?: string;
    postal?: string;
}

const header = (req: Request, name: string): string | undefined => {
    const value = req.headers.get(name);
    if (!value) return undefined;
    try {
        // Vercel URL-encodes the city ("Council%20Bluffs").
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

/** Vercel's own geolocation headers: free, and present on every request. */
export const requestFacts = (req: Request): RequestFacts => ({
    ip: (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim() || 'unknown',
    userAgent: req.headers.get('user-agent') || '',
    city: header(req, 'x-vercel-ip-city'),
    region: header(req, 'x-vercel-ip-country-region'),
    country: header(req, 'x-vercel-ip-country'),
    latitude: header(req, 'x-vercel-ip-latitude'),
    longitude: header(req, 'x-vercel-ip-longitude'),
    timezone: header(req, 'x-vercel-ip-timezone'),
    postal: header(req, 'x-vercel-ip-postal-code'),
});

/** The ISP, best effort: one try, short timeout, never blocks the message. */
export const lookupIsp = async (ip: string): Promise<string | undefined> => {
    if (!ip || ip === 'unknown' || ip === '::1' || ip.startsWith('127.')) return undefined;
    try {
        const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/org/`, {
            signal: AbortSignal.timeout(1500),
            headers: { 'User-Agent': 'portfolio-visit-notify' },
        });
        if (!res.ok) return undefined;
        const text = (await res.text()).trim();
        // Rate-limited replies come back as 200 with a message.
        return text && text.length < 80 && !/limit|error|undefined/i.test(text) ? text : undefined;
    } catch {
        return undefined;
    }
};

// ============ Rate limit ============
// Per server instance, so best effort, but enough to stop one script from
// flooding the channel.

const hits = new Map<string, number[]>();

export const rateLimited = (key: string, max: number, windowMs: number): boolean => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > max;
};

// ============ Signed edit tokens ============
// The browser gets a token naming its own message; edits need it, so nobody
// can rewrite other visits' messages by guessing ids.

interface TokenData {
    messageId: string;
    visitNumber: number;
    startedAt: number;
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export const makeToken = (data: TokenData, secret: string): string => {
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
    return `${payload}.${sign(payload, secret)}`;
};

export const readToken = (token: unknown, secret: string): TokenData | null => {
    if (typeof token !== 'string' || token.length > 400) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload, secret));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as TokenData;
        // A visit message stays editable for a day.
        return Date.now() - data.startedAt < 24 * 60 * 60 * 1000 ? data : null;
    } catch {
        return null;
    }
};

// ============ Wording ============

const clip = (value: unknown, max: number): string => String(value ?? '').slice(0, max);

/** Where the visitor came from, named the way a person would say it. */
export const describeSource = (client: Partial<ClientInfo>): { label: string; detail?: string } => {
    const utm = client.utm ?? {};
    const tagged = utm.ref || utm.source || utm.utm_source;
    const campaign = [utm.utm_medium, utm.utm_campaign].filter(Boolean).join(' / ');

    const referrer = clip(client.referrer, 300);
    let host = '';
    try {
        host = referrer ? new URL(referrer).hostname.replace(/^www\./, '').replace(/^m\./, '') : '';
    } catch {
        host = '';
    }

    const known: [RegExp, string][] = [
        [/linkedin|lnkd\.in|com\.linkedin\.android/, 'LinkedIn'],
        [/google\./, 'Google'],
        [/bing\.com/, 'Bing'],
        [/duckduckgo/, 'DuckDuckGo'],
        [/github\.com/, 'GitHub'],
        [/(^|\.)x\.com|twitter|t\.co$/, 'X / Twitter'],
        [/facebook|fb\.com|l\.facebook/, 'Facebook'],
        [/instagram/, 'Instagram'],
        [/whatsapp|wa\.me/, 'WhatsApp'],
        [/reddit/, 'Reddit'],
        [/youtube|youtu\.be/, 'YouTube'],
        [/discord/, 'Discord'],
        [/t\.me|telegram/, 'Telegram'],
        [/persist\.org/, 'Persist'],
        [/g\.dev|developers\.google/, 'Google Developers profile'],
        [/chatgpt|openai/, 'ChatGPT'],
        [/perplexity/, 'Perplexity'],
    ];
    const named = host ? known.find(([pattern]) => pattern.test(host) || pattern.test(referrer))?.[1] : undefined;

    if (tagged) {
        return {
            label: `🏷️ ${clip(tagged, 40)}`,
            detail: [named ? `via ${named}` : host || undefined, campaign || undefined].filter(Boolean).join(' · ') || undefined,
        };
    }
    if (named) return { label: named, detail: host };
    if (host) return { label: host };
    return { label: 'Direct', detail: 'typed the URL, a bookmark, or an app that hides the referrer' };
};

const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export const ago = (ms: number): string => {
    const min = Math.round(ms / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const h = Math.round(min / 60);
    if (h < 48) return `${h} h ago`;
    return `${Math.round(h / 24)} days ago`;
};

export const duration = (ms: number): string => {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

const SECTION_NAMES: Record<string, string> = {
    home: 'Home', about: 'About', experience: 'Experience', projects: 'Projects', github: 'GitHub',
    skills: 'Skills', education: 'Education', certifications: 'Certifications', contact: 'Contact',
};

const RESUME_VIA: Record<ResumeVia, string> = {
    hero: '"My Resume" button',
    terminal: 'terminal `resume` command',
    assistant: 'the assistant',
    preview: 'download button in the preview',
};

const describeDevice = (userAgent: string, client: Partial<ClientInfo>): string => {
    const ua = new UAParser(userAgent);
    const browser = ua.getBrowser();
    const os = ua.getOS();
    const device = ua.getDevice();

    let osName = [os.name, os.version].filter(Boolean).join(' ');
    // Windows 11 reports itself as Windows 10 in the user agent; the client
    // hint's platform version tells them apart (13+ is Windows 11).
    if (os.name === 'Windows' && client.platformVersion && Number(client.platformVersion.split('.')[0]) >= 13) osName = 'Windows 11';
    if (os.name === 'Android' && client.platformVersion) osName = `Android ${client.platformVersion.split('.')[0]}`;

    const model = clip(client.model, 40) || [device.vendor, device.model].filter((part) => part && part !== 'K').join(' ');
    const type = device.type === 'mobile' ? '📱 Phone' : device.type === 'tablet' ? '📱 Tablet' : client.touch && /Mac/.test(osName) ? '📱 iPad' : '🖥️ Desktop';
    const version = (clip(client.browserVersion, 20) || browser.version || '').split('.')[0];

    return [`${type} · ${browser.name ?? 'Unknown browser'}${version ? ` ${version}` : ''} on ${osName || 'unknown OS'}`, model || undefined]
        .filter(Boolean)
        .join('\n');
};

// ============ Messages ============

interface Embed {
    title: string;
    description?: string;
    color: number;
    fields: { name: string; value: string; inline?: boolean }[];
    footer?: { text: string };
    timestamp?: string;
}

const field = (name: string, value: string | undefined, inline = false) =>
    value && value.trim() ? { name, value: value.slice(0, 1024), inline } : null;

const locationLine = (facts: RequestFacts) => {
    const place = [facts.city, facts.region, facts.country].filter(Boolean).join(', ') || 'Unknown';
    const map = facts.latitude && facts.longitude ? ` · [map](https://www.google.com/maps?q=${facts.latitude},${facts.longitude})` : '';
    return `${place}${facts.postal ? ` ${facts.postal}` : ''}${map}`;
};

const localTime = (timezone?: string) => {
    if (!timezone) return undefined;
    try {
        return new Date().toLocaleTimeString('en-IN', { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
    } catch {
        return undefined;
    }
};

const describeEngagement = (e: Engagement | undefined, final: boolean): string | undefined => {
    if (!e) return undefined;
    const lines: string[] = [];
    lines.push(`⏱️ ${duration(e.activeMs)} active · scrolled ${e.maxScroll}%`);
    if (e.sections.length) lines.push(`👀 ${e.sections.map((id) => SECTION_NAMES[id] ?? id).join(' → ')}`);
    if (e.resume.length) lines.push(`📄 Resume: ${e.resume.map((r) => `${r.kinds.join(' + ')} via ${RESUME_VIA[r.via] ?? r.via}`).join('; ')}`);
    if (e.contactForm) lines.push('✉️ Sent the contact form');
    if (e.assistantOpened) lines.push(`🤖 Assistant: ${e.assistantQuestions ? `${e.assistantQuestions} question${e.assistantQuestions === 1 ? '' : 's'}` : 'opened'}`);
    if (e.terminalCommands.length) lines.push(`⌨️ Terminal: ${e.terminalCommands.map((c) => `\`${c}\``).join(' ')}`);
    if (e.games.length) lines.push(`🎮 Played: ${e.games.join(', ')}`);
    if (e.outbound.length) lines.push(`🔗 Clicked: ${e.outbound.join(', ')}`);
    if (!final && lines.length === 1 && !e.activeMs) return undefined;
    return lines.join('\n');
};

export interface VisitMessageInput {
    /** 0 or null when the counter was unavailable. */
    visitNumber: number | null;
    facts: RequestFacts;
    client: Partial<ClientInfo>;
    engagement?: Engagement;
    isp?: string;
    /** True once the visitor has left (the tab was hidden or closed). */
    left: boolean;
}

export const visitEmbed = ({ visitNumber, facts, client, engagement, isp, left }: VisitMessageInput): Embed => {
    const source = describeSource(client);
    const returning = (client.visits ?? 1) > 1;
    const time = localTime(client.timezone || facts.timezone);

    const visitorLine = returning
        ? `🔁 Returning — ${ordinal(client.visits ?? 2)} visit${client.lastSeen ? `, last seen ${ago(Date.now() - client.lastSeen)}` : ''}${client.firstSeen ? `\nFirst visit ${new Date(client.firstSeen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`
        : '✨ First visit';

    const extras = [
        client.screen && `screen ${client.screen} @${client.dpr}x`,
        client.colorScheme && `${client.colorScheme} mode`,
        client.languages?.length && client.languages.join(', '),
    ].filter(Boolean);

    const network = [isp, client.connection && `${client.connection}${client.saveData ? ' (data saver)' : ''}`].filter(Boolean).join(' · ');

    return {
        title: `${returning ? '🔁 Returning visitor' : '🚀 New visitor'}${visitNumber ? ` #${visitNumber}` : ''}`,
        description: [
            `**From:** ${source.label}${source.detail ? ` — ${source.detail}` : ''}`,
            client.landing && client.landing !== '/' ? `**Landed on:** \`${clip(client.landing, 80)}\`` : undefined,
            left ? '⚪ Left the site (or switched away)' : '🟢 On the site now',
        ]
            .filter(Boolean)
            .join('\n'),
        color: left ? 0x5865f2 : returning ? 0xf1c40f : 0x00ff9d,
        fields: [
            field('📍 Location', `${locationLine(facts)}${time ? `\n🕒 Their time: ${time}${client.timezone ? ` (${client.timezone})` : ''}` : ''}`, false),
            field('💻 Device', `${describeDevice(facts.userAgent, client)}${extras.length ? `\n${extras.join(' · ')}` : ''}`, false),
            field('🌐 Network', network || undefined, true),
            field('👤 Visitor', visitorLine, true),
            field('📊 What they did', describeEngagement(engagement, left), false),
        ].filter(Boolean) as Embed['fields'],
        footer: { text: `IP ${facts.ip} · visitor ${clip(client.visitorId, 12) || '?'}` },
        timestamp: new Date().toISOString(),
    };
};

export const resumeEmbed = (input: {
    via: ResumeVia;
    kinds: ResumeKind[];
    visitNumber: number | null;
    facts: RequestFacts;
    client: Partial<ClientInfo>;
}): Embed => {
    const downloaded = input.kinds.includes('download');
    const source = describeSource(input.client);
    return {
        title: downloaded ? '📄 Resume downloaded!' : '📄 Resume opened',
        description: `Via ${RESUME_VIA[input.via] ?? input.via}${input.kinds.length > 1 ? ' (preview, then download)' : ''}${input.visitNumber ? ` · visitor #${input.visitNumber}` : ''}`,
        color: 0xe23636,
        fields: [
            field('📍 Location', locationLine(input.facts), true),
            field('💻 Device', describeDevice(input.facts.userAgent, input.client), true),
            field('🔗 Came from', `${source.label}${source.detail ? ` — ${source.detail}` : ''}`, false),
            field('👤 Visitor', (input.client.visits ?? 1) > 1 ? `🔁 ${ordinal(input.client.visits ?? 2)} visit` : '✨ First visit', true),
        ].filter(Boolean) as Embed['fields'],
        footer: { text: `IP ${input.facts.ip} · visitor ${clip(input.client.visitorId, 12) || '?'}` },
        timestamp: new Date().toISOString(),
    };
};

// ============ Discord ============

const BOT_IDENTITY = { username: 'Portfolio Visitor Bot', avatar_url: 'https://hakkan.is-a.dev/icon.png' };

const webhookUrl = (base: string, path = '', params: Record<string, string> = {}) => {
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/$/, '') + path;
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
};

/** Posts a message and returns its id, so the visit can be edited later. */
export const postMessage = async (base: string, embed: Embed): Promise<string | null> => {
    const res = await fetch(webhookUrl(base, '', { wait: 'true' }), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...BOT_IDENTITY, embeds: [embed] }),
    });
    if (!res.ok) throw new Error(`Discord ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    return data?.id ?? null;
};

export const editMessage = async (base: string, messageId: string, embed: Embed): Promise<void> => {
    const res = await fetch(webhookUrl(base, `/messages/${encodeURIComponent(messageId)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) throw new Error(`Discord ${res.status}: ${(await res.text()).slice(0, 200)}`);
};
