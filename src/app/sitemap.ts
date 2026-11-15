import type { MetadataRoute } from 'next';

const SITE_URL = 'https://hakkan.is-a.dev';

/**
 * One page, so one entry. The images ride along so Google Images can tie the
 * profile photo and the share card to this page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: `${SITE_URL}/`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
            images: [`${SITE_URL}/profile.jpg`, `${SITE_URL}/og-hakkan-shah.jpg`],
        },
    ];
}
