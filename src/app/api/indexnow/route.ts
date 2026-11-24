import { NextResponse } from 'next/server';
import { PROJECTS } from '@/lib/data';
import { SITE_URL, projectUrl } from '@/lib/seo';

/**
 * IndexNow (https://www.indexnow.org): tells Bing, Yandex, Seznam and Naver
 * which URLs exist or changed, so they recrawl in hours instead of weeks.
 * Bing's index also feeds Edge, DuckDuckGo, Yahoo, Ecosia, ChatGPT search
 * and Copilot.
 *
 * Called weekly by the Vercel cron in vercel.json. The key is public by
 * design: it is the file public/<key>.txt, which proves the site owns it.
 */
const INDEXNOW_KEY = 'c9899bc6f974a7b9d6b53d57379f6e86';

export async function GET(req: Request) {
    // Only Vercel's scheduler (or someone holding CRON_SECRET) may trigger it.
    const secret = process.env.CRON_SECRET;
    const authorized = secret
        ? req.headers.get('authorization') === `Bearer ${secret}`
        : (req.headers.get('user-agent') ?? '').startsWith('vercel-cron/');
    if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const urlList = [
        `${SITE_URL}/`,
        `${SITE_URL}/about`,
        `${SITE_URL}/projects`,
        `${SITE_URL}/experience`,
        `${SITE_URL}/contact`,
        `${SITE_URL}/faq`,
        `${SITE_URL}/legend`,
        `${SITE_URL}/llms.txt`,
        ...PROJECTS.map(projectUrl),
    ];

    const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
            host: new URL(SITE_URL).host,
            key: INDEXNOW_KEY,
            keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
            urlList,
        }),
    });

    // 200 and 202 both mean accepted.
    return NextResponse.json({ status: res.status, submitted: urlList.length }, { status: res.ok ? 200 : 502 });
}
