/**
 * Everything search engines and AI agents read about the site, derived from
 * src/lib/data.ts so a new project or job title updates the pages, the
 * structured data, the sitemap and llms.txt together.
 */

import {
    ABOUT_ME,
    CERTIFICATIONS,
    CONTACT_INFO,
    EDUCATION,
    EXPERIENCE,
    GITHUB_STATS,
    PROJECTS,
    SKILLS,
    type Project,
} from '@/lib/data';

export const SITE_URL = 'https://hakkan.is-a.dev';
export const NAME = 'Hakkan Shah';
export const LEGAL_NAME = 'Hakkan Parbej Shah';
export const JOB_TITLE = 'Full Stack AI Engineer';
export const LOCATION = 'Kolkata, India';
export const OG_IMAGE = '/og-hakkan-shah.jpg';
/** Named after him: image search reads file names. */
export const PROFILE_PHOTO = '/hakkan-shah.jpg';

/**
 * Short on purpose: Google cut the longer one down to just the name. Every
 * other page is "<page> | Hakkan Shah" (the layout's title template), so each
 * sitelink gets its own label instead of a shared "Full Stack AI Engineer".
 */
export const HOME_TITLE = 'Hakkan Shah – Full Stack AI Engineer';
export const HOME_DESCRIPTION =
    'Hakkan Shah is a Full Stack AI Engineer in India. He builds AI agents, LLM apps and full stack products with Next.js, TypeScript and Python. Creator of OHMSchool & AURA.';

export const PERSON_ID = `${SITE_URL}/#person`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Contact details that are fine to publish. The phone number is not. */
export const PUBLIC_EMAIL = CONTACT_INFO.find((c) => c.name === 'Email')?.value ?? '';

export const PROFILES = CONTACT_INFO.filter((c) => /^https?:\/\//.test(c.href)).map((c) => ({
    name: c.name,
    url: c.href,
}));

export const CURRENT_ROLE = EXPERIENCE[0];

// ============ Projects ============

export const projectSlug = (project: Pick<Project, 'title'>): string =>
    project.title
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

export const projectUrl = (project: Pick<Project, 'title'>) => `${SITE_URL}/projects/${projectSlug(project)}`;

export const findProject = (slug: string): Project | undefined => PROJECTS.find((p) => projectSlug(p) === slug);

/**
 * The projects he leads with (data.ts order). Site-wide lists link these and
 * then "all projects", so search engines see which pages matter most; linking
 * all 13 equally is how AluChat ended up as a sitelink ahead of OHMSchool.
 */
export const FEATURED_PROJECT_COUNT = 5;
export const featuredProjects = () => PROJECTS.slice(0, FEATURED_PROJECT_COUNT);

/** Projects built at Persist rather than on his own. */
const PERSIST_PRODUCTS = new Set(['OHMSchool', 'AURA']);
export const isPersistProduct = (project: Project) => PERSIST_PRODUCTS.has(project.title);

/** "Creator of OHMSchool and AURA": the products he leads at Persist. */
export const persistProducts = () => PROJECTS.filter(isPersistProduct);
export const persistProductNames = () => persistProducts().map((p) => p.title).join(' and ');

const PLATFORM_HINTS: [RegExp, string][] = [
    [/android|kotlin|jetpack/i, 'Android'],
    [/windows|wpf|\.net/i, 'Windows'],
    [/desktop/i, 'Windows, macOS'],
    [/github app/i, 'Web'],
];

const platformOf = (project: Project) => {
    const haystack = `${project.tags.join(' ')} ${project.description}`;
    return PLATFORM_HINTS.find(([pattern]) => pattern.test(haystack))?.[1] ?? 'Web';
};

const categoryOf = (project: Project) => {
    const haystack = `${project.tags.join(' ')} ${project.description}`.toLowerCase();
    if (/learning|education|k-12/.test(haystack)) return 'EducationalApplication';
    if (/game|cube/.test(haystack)) return 'GameApplication';
    if (/developer|github|resume|cv|interview/.test(haystack)) return 'DeveloperApplication';
    return 'WebApplication';
};

// ============ Structured data ============

export const personSchema = () => ({
    '@type': 'Person',
    '@id': PERSON_ID,
    name: NAME,
    alternateName: [LEGAL_NAME, 'Hakkan'],
    givenName: 'Hakkan',
    familyName: 'Shah',
    url: `${SITE_URL}/`,
    image: {
        '@type': 'ImageObject',
        '@id': `${SITE_URL}/#profile-photo`,
        url: `${SITE_URL}${PROFILE_PHOTO}`,
        width: 1024,
        height: 1364,
        caption: NAME,
    },
    jobTitle: JOB_TITLE,
    description: ABOUT_ME,
    email: `mailto:${PUBLIC_EMAIL}`,
    address: {
        '@type': 'PostalAddress',
        addressLocality: 'Kolkata',
        addressRegion: 'West Bengal',
        addressCountry: 'IN',
    },
    nationality: { '@type': 'Country', name: 'India' },
    worksFor: { '@type': 'Organization', name: CURRENT_ROLE.company, url: 'https://persist.org/' },
    hasOccupation: [
        {
            '@type': 'Occupation',
            name: JOB_TITLE,
            occupationLocation: { '@type': 'Country', name: 'India' },
            skills: CURRENT_ROLE.details.technologies.join(', '),
        },
        { '@type': 'Occupation', name: 'AI Engineer' },
        { '@type': 'Occupation', name: 'Full Stack Engineer' },
    ],
    alumniOf: {
        '@type': 'CollegeOrUniversity',
        name: EDUCATION[0].institution,
    },
    hasCredential: [
        {
            '@type': 'EducationalOccupationalCredential',
            credentialCategory: 'degree',
            name: `${EDUCATION[0].degree} (${EDUCATION[0].period})`,
            recognizedBy: { '@type': 'CollegeOrUniversity', name: EDUCATION[0].institution },
        },
        ...CERTIFICATIONS.map((cert) => ({
            '@type': 'EducationalOccupationalCredential',
            credentialCategory: 'certificate',
            name: cert.name,
            recognizedBy: { '@type': 'Organization', name: cert.issuer },
            url: cert.url,
        })),
    ],
    award: CURRENT_ROLE.details.achievements[0],
    knowsAbout: Array.from(
        new Set([
            'Artificial Intelligence',
            'AI Agents',
            'Large Language Models',
            'Generative AI',
            'Retrieval-Augmented Generation',
            'Full Stack Web Development',
            ...SKILLS.flatMap((group) => group.skills.map((skill) => skill.name)),
        ])
    ),
    sameAs: PROFILES.map((profile) => profile.url),
});

export const projectSchema = (project: Project) => ({
    '@type': 'SoftwareApplication',
    '@id': `${projectUrl(project)}#software`,
    name: project.title,
    description: project.description,
    abstract: project.longDescription,
    url: project.liveUrl || projectUrl(project),
    mainEntityOfPage: projectUrl(project),
    image: `${SITE_URL}${project.thumbnail}`,
    applicationCategory: categoryOf(project),
    operatingSystem: platformOf(project),
    keywords: project.tags.join(', '),
    author: { '@id': PERSON_ID },
    creator: { '@id': PERSON_ID },
    ...(isPersistProduct(project) ? { publisher: { '@type': 'Organization', name: 'Persist', url: 'https://persist.org/' } } : {}),
    ...(project.repoUrl ? { codeRepository: project.repoUrl, isAccessibleForFree: true } : {}),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
});

export const projectListSchema = () => ({
    '@type': 'ItemList',
    '@id': `${SITE_URL}/#projects`,
    name: `Projects by ${NAME}`,
    numberOfItems: PROJECTS.length,
    itemListElement: PROJECTS.map((project, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: projectUrl(project),
        name: project.title,
    })),
});

// ============ Plain-language facts, for the FAQ and llms.txt ============

export const githubLine = () =>
    `${GITHUB_STATS.publicRepos} public repositories and ${GITHUB_STATS.totalPRs} merged pull requests on GitHub (github.com/${GITHUB_STATS.username}).`;

export const skillsLine = () => SKILLS.map((group) => `${group.name}: ${group.skills.map((s) => s.name).join(', ')}`).join('. ');
