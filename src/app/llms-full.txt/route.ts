import { llmsFull } from '@/lib/llms';

// Built once at deploy time from data.ts.
export const dynamic = 'force-static';

export function GET() {
    return new Response(llmsFull(), {
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
    });
}
