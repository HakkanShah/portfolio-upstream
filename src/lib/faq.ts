/**
 * Questions people (and AI assistants) ask about Hakkan, answered from
 * data.ts. Rendered as the FAQ section and as FAQPage structured data, and
 * included in llms.txt, so the three always say the same thing.
 *
 * Answers are written in the third person and stick to what the portfolio
 * states; nothing here may promise more than the data does.
 */

import { EDUCATION, EXPERIENCE, GITHUB_STATS, PROJECTS, SKILLS } from '@/lib/data';
import { PROFILE_PROSE } from '@/content/profile';
import { CURRENT_ROLE, JOB_TITLE, LEGAL_NAME, NAME, PROFILES, PUBLIC_EMAIL, persistProductNames, projectSlug } from '@/lib/seo';

export interface FaqEntry {
    question: string;
    /** Plain text: shown on the page and used verbatim in the structured data. */
    answer: string;
    /** Optional links shown under the answer on the page. */
    links?: { label: string; href: string }[];
}

const skillGroup = (name: string) => SKILLS.find((group) => group.name === name)?.skills.map((s) => s.name) ?? [];

/** His own words on what he's open to, if he has written them. */
const availability = (): string | null =>
    PROFILE_PROSE.split(/\n\s*\n/)
        .map((part) => part.replace(/\s*\n\s*/g, ' ').trim())
        .find((part) => /^I'm open to/i.test(part)) ?? null;

export const faqEntries = (): FaqEntry[] => {
    const [flagship, second, third] = PROJECTS;
    const openSource = PROJECTS.filter((p) => p.repoUrl);
    const degree = EDUCATION[0];
    const earlier = EXPERIENCE.slice(1);
    const linkedin = PROFILES.find((p) => p.name === 'LinkedIn');
    const github = PROFILES.find((p) => p.name === 'GitHub');
    const quote = availability();

    return [
        {
            question: `Who is ${NAME}?`,
            answer: `${NAME} (${LEGAL_NAME}) is a ${JOB_TITLE} at ${CURRENT_ROLE.company}, based in Kolkata, India. He builds AI agents that act on real interfaces, the full stack systems that keep them reliable, and the product UI around them. He joined ${CURRENT_ROLE.company} after winning its Startupathon against 250+ builders, and is the creator of ${persistProductNames()}.`,
        },
        {
            question: `What does ${NAME} do at ${CURRENT_ROLE.company}?`,
            answer: `${CURRENT_ROLE.description} Day to day he works with ${CURRENT_ROLE.details.technologies.slice(0, 8).join(', ')}.`,
        },
        {
            question: `What are ${NAME}'s best projects?`,
            answer: `${flagship.title}: ${flagship.description} ${second.title}: ${second.description} ${third.title}: ${third.description}`,
            links: [flagship, second, third].map((p) => ({ label: p.title, href: `/projects/${projectSlug(p)}` })),
        },
        {
            question: `What technologies does ${NAME} work with?`,
            answer: `AI engineering: ${skillGroup('AI Engineering').join(', ')}. Frontend: ${skillGroup('Frontend').join(', ')}. Backend: ${skillGroup('Backend').join(', ')}. Across ${PROJECTS.length} projects his most used stack is Next.js and TypeScript.`,
        },
        {
            question: `Is ${NAME} open to work?`,
            answer: `${quote ? `In his words: "${quote}"` : 'His portfolio does not list his current availability.'} The best way to reach him is email: ${PUBLIC_EMAIL}.`,
            links: [{ label: 'Email him', href: `mailto:${PUBLIC_EMAIL}` }],
        },
        {
            question: `Where is ${NAME} based?`,
            answer: `Kolkata, India (IST). He works remotely, with users and collaborators across four continents.`,
        },
        {
            question: `Where did ${NAME} study?`,
            answer: `He studied ${degree.degree} at ${degree.institution} (${degree.period}; ${degree.details}). Before ${CURRENT_ROLE.company} he worked as ${earlier.map((role) => `${role.role} at ${role.company}`).join(' and ')}.`,
        },
        {
            question: `Is ${NAME}'s work open source?`,
            answer: `${openSource.length} of the ${PROJECTS.length} projects on his portfolio are open source, including ${openSource.slice(0, 4).map((p) => p.title).join(', ')}. He has ${GITHUB_STATS.publicRepos} public repositories and ${GITHUB_STATS.totalPRs} merged pull requests on GitHub. ${PROJECTS.filter((p) => !p.repoUrl).map((p) => p.title).join(' and ')} ${PROJECTS.filter((p) => !p.repoUrl).length === 1 ? 'is a' : 'are'} ${CURRENT_ROLE.company} product${PROJECTS.filter((p) => !p.repoUrl).length === 1 ? '' : 's'}, so the code is private.`,
            links: github ? [{ label: 'GitHub profile', href: github.url }] : undefined,
        },
        {
            question: `How can I contact ${NAME}?`,
            answer: `Email ${PUBLIC_EMAIL}, use the contact form on this site, or message him on LinkedIn.`,
            links: [
                { label: 'Email', href: `mailto:${PUBLIC_EMAIL}` },
                ...(linkedin ? [{ label: 'LinkedIn', href: linkedin.url }] : []),
                { label: 'Contact form', href: '/#contact' },
            ],
        },
    ];
};

export const faqSchema = () => ({
    '@type': 'FAQPage',
    '@id': 'https://hakkan.is-a.dev/faq#faq',
    url: 'https://hakkan.is-a.dev/faq',
    mainEntity: faqEntries().map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
});
