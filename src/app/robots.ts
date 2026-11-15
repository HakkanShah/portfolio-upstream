import type { MetadataRoute } from 'next';

const SITE_URL = 'https://hakkan.is-a.dev';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            // The chat endpoint answers POSTs from the assistant; there is
            // nothing for a crawler to index there.
            disallow: '/api/',
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
