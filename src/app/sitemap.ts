import type { MetadataRoute } from 'next';
import { PROJECTS } from '@/lib/data';
import { OG_IMAGE, PROFILE_PHOTO, SITE_URL, projectUrl } from '@/lib/seo';

/**
 * The home page and one page per project. Images ride along so image search
 * can tie the photos and screenshots to their pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();
    return [
        {
            url: `${SITE_URL}/`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 1,
            images: [`${SITE_URL}${PROFILE_PHOTO}`, `${SITE_URL}${OG_IMAGE}`],
        },
        // The standalone pages: what search engines show as sitelinks.
        ...['/about', '/projects', '/experience', '/contact', '/faq'].map((path) => ({
            url: `${SITE_URL}${path}`,
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        })),
        // The joke page: indexable so friends can Google it, low priority,
        // and linked from nowhere else on the site.
        { url: `${SITE_URL}/legend`, lastModified: now, changeFrequency: 'yearly' as const, priority: 0.2 },
        ...PROJECTS.map((project, index) => ({
            url: projectUrl(project),
            lastModified: now,
            changeFrequency: 'monthly' as const,
            // The first projects are the ones he leads with.
            priority: index < 3 ? 0.9 : 0.7,
            images: [`${SITE_URL}${project.thumbnail}`],
        })),
    ];
}
