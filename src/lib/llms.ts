/**
 * llms.txt (https://llmstxt.org): a plain Markdown summary of the site for AI
 * agents and answer engines, which read it instead of parsing the page.
 * Generated from data.ts so it never goes stale.
 */

import { ABOUT_ME, CERTIFICATIONS, EDUCATION, EXPERIENCE, PROJECTS } from '@/lib/data';
import { faqEntries } from '@/lib/faq';
import {
    CURRENT_ROLE,
    JOB_TITLE,
    LEGAL_NAME,
    LOCATION,
    NAME,
    PROFILES,
    PUBLIC_EMAIL,
    SITE_URL,
    githubLine,
    persistProductNames,
    isPersistProduct,
    projectSlug,
    skillsLine,
} from '@/lib/seo';

const projectLine = (p: (typeof PROJECTS)[number]) =>
    `- [${p.title}](${SITE_URL}/projects/${projectSlug(p)}): ${p.description}${isPersistProduct(p) ? ` (built at ${CURRENT_ROLE.company})` : ''}`;

export const llmsSummary = (): string =>
    [
        `# ${NAME}`,
        '',
        `> ${NAME} (${LEGAL_NAME}) is a ${JOB_TITLE} at ${CURRENT_ROLE.company}, based in ${LOCATION}. He builds AI agents that act on real interfaces, the full stack systems behind them, and the product UI around them. Creator of ${persistProductNames()}.`,
        '',
        `Contact: ${PUBLIC_EMAIL}. Profiles: ${PROFILES.map((p) => `[${p.name}](${p.url})`).join(', ')}.`,
        '',
        '## Projects',
        '',
        ...PROJECTS.map(projectLine),
        '',
        '## About',
        '',
        `- [Portfolio](${SITE_URL}/): the whole portfolio on one page`,
        `- [All projects](${SITE_URL}/projects)`,
        `- [Experience, skills, education and certifications](${SITE_URL}/experience)`,
        `- [Contact](${SITE_URL}/contact)`,
        `- [Full profile in plain text](${SITE_URL}/llms-full.txt): everything below in one file`,
        `- [Resume (PDF)](${SITE_URL}/Hakkan_Parbej_Shah_Resume.pdf)`,
        '',
    ].join('\n');

export const llmsFull = (): string =>
    [
        `# ${NAME} — ${JOB_TITLE}`,
        '',
        `> ${ABOUT_ME}`,
        '',
        `- Website: ${SITE_URL}/`,
        `- Email: ${PUBLIC_EMAIL}`,
        `- Location: ${LOCATION} (IST), works remotely`,
        ...PROFILES.map((p) => `- ${p.name}: ${p.url}`),
        `- ${githubLine()}`,
        '',
        '## Frequently asked',
        '',
        ...faqEntries().flatMap((entry) => [`### ${entry.question}`, '', entry.answer, '']),
        '## Experience',
        '',
        ...EXPERIENCE.flatMap((role) => [
            `### ${role.role} — ${role.company} (${role.period})`,
            '',
            role.details.overview,
            '',
            ...role.details.responsibilities.map((item) => `- ${item}`),
            '',
            `Achievements: ${role.details.achievements.join('; ')}.`,
            '',
            `Stack: ${role.details.technologies.join(', ')}.`,
            '',
        ]),
        '## Projects',
        '',
        ...PROJECTS.flatMap((p) => [
            `### ${p.title}`,
            '',
            `${SITE_URL}/projects/${projectSlug(p)}`,
            '',
            p.longDescription,
            '',
            `Why: ${p.why}`,
            '',
            `Stack: ${p.tags.join(', ')}.${p.liveUrl ? ` Live: ${p.liveUrl}.` : ''}${p.repoUrl ? ` Source: ${p.repoUrl}.` : ' Source: private.'}`,
            '',
        ]),
        '## Skills',
        '',
        skillsLine() + '.',
        '',
        '## Education',
        '',
        ...EDUCATION.map((e) => `- ${e.degree}, ${e.institution} (${e.period}) — ${e.details}`),
        '',
        '## Certifications',
        '',
        ...CERTIFICATIONS.map((c) => `- ${c.name} — ${c.issuer}`),
        '',
    ].join('\n');
