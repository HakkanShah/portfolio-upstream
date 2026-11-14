/**
 * Knowledge graph
 *
 * Builds the assistant's retrievable knowledge from the same two sources the
 * Groq route is grounded on:
 *   1. src/lib/data.ts       — structured facts, already powering the site
 *   2. src/content/profile.ts — the prose the site doesn't render
 *
 * Nothing is hand-copied, so renaming a project or rewriting the bio updates
 * the on-device answers at the same time as the page.
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
} from '@/lib/data';
import { PROFILE_PROSE } from '@/content/profile';
import { normalize } from './nlp';
import type { AssistantAction } from '../actions';
import type { KnowledgeCard } from './types';

// ============ Identity, derived from the data ============

/**
 * Contact fields the assistant must never read out, matching the policy in
 * profile.ts: the number is on the page for humans, but a bot will hand it to
 * any scraper that asks politely.
 */
const PRIVATE_CONTACT_FIELDS = new Set(['Phone']);

const isPublicChannel = (name: string): boolean => !PRIVATE_CONTACT_FIELDS.has(name);

/**
 * Every contact lookup goes through here, so the private-field policy is
 * enforced at the one point of access rather than remembered at each card.
 */
const contactEntry = (name: string) =>
    isPublicChannel(name) ? CONTACT_INFO.find((entry) => entry.name === name) : undefined;

const contactHref = (name: string): string => contactEntry(name)?.href ?? '';

const contactValue = (name: string): string => contactEntry(name)?.value ?? '';

export const OWNER = {
    firstName: 'Hakkan',
    fullName: 'Hakkan Shah',
    /** Derived, so a new job title doesn't need editing here. */
    headline: `${EXPERIENCE[0].role} at ${EXPERIENCE[0].company}`,
    location: 'India, working remotely',
    email: contactValue('Email'),
    emailHref: contactHref('Email'),
    github: contactHref('GitHub'),
    linkedin: contactHref('LinkedIn'),
    googleDev: contactHref('G.Dev Profile'),
    persist: contactHref('Persist'),
    resumePath: '/Hakkan_Parbej_Shah_Resume.pdf',
};

/** The current role, straight from the top of the experience list. */
const CURRENT_ROLE = EXPERIENCE[0];

/** Re-exported so the composer has one import for everything it renders. */
export { GITHUB_STATS };

// ============ Helpers ============

const slug = (value: string): string =>
    normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Words too generic to use as a standalone tech alias. */
const GENERIC_TECH_WORDS = new Set([
    'web', 'api', 'apis', 'app', 'design', 'modern', 'real', 'time', 'cloud', 'data',
    'performance', 'counters', 'generation', 'integration', 'restful', 'communication',
    'setup', 'windows', 'speech', 'agent', 'system', 'engine',
]);

/**
 * Keys a technology can be looked up by.
 *
 * `identity` keys name this exact technology: "react.js", "reactjs", "react".
 * `aliases` are a convenience — the first word of a longer name — and must
 * never be treated as identity: "React Native" and "Firebase Studio" also
 * start with "react" and "firebase", and merging on that made the assistant
 * answer "does he know React?" with "Yes — React Native".
 */
const techKeys = (label: string): { identity: string[]; aliases: string[] } => {
    const base = normalize(label);
    const compact = base.replace(/[\s.-]/g, '');
    const identity = new Set<string>([base, compact]);

    // "React.js" is "React", "Node.js" is "Node".
    if (/[a-z]{3,}js$/.test(compact)) identity.add(compact.replace(/js$/, ''));

    const aliases = new Set<string>();
    const words = base.split(' ').filter(Boolean);
    if (words.length > 1 && !GENERIC_TECH_WORDS.has(words[0]) && words[0].length > 2 && !identity.has(words[0])) {
        aliases.add(words[0]);
    }
    return { identity: Array.from(identity).filter(Boolean), aliases: Array.from(aliases) };
};

// ============ Technology index ============

export interface TechEntry {
    label: string;
    keys: string[];
    groups: string[];
    projects: string[];
    roles: string[];
    listedSkill: boolean;
}

let techIndexCache: Map<string, TechEntry> | null = null;

const upsertTech = (
    index: Map<string, TechEntry>,
    /** Keys currently held only as a first-word alias, which identity outranks. */
    borrowed: Set<string>,
    label: string,
    patch: Partial<Omit<TechEntry, 'label' | 'keys'>>
): void => {
    const { identity, aliases } = techKeys(label);
    const existing = identity
        .map((key) => (borrowed.has(key) ? undefined : index.get(key)))
        .find(Boolean);

    const entry: TechEntry = existing ?? {
        label,
        keys: [],
        groups: [],
        projects: [],
        roles: [],
        listedSkill: false,
    };

    if (patch.listedSkill) entry.label = label;
    entry.listedSkill = entry.listedSkill || Boolean(patch.listedSkill);

    for (const key of identity) {
        if (!entry.keys.includes(key)) entry.keys.push(key);
        index.set(key, entry);
        borrowed.delete(key);
    }
    for (const key of aliases) {
        if (index.has(key)) continue;
        index.set(key, entry);
        borrowed.add(key);
    }
    for (const group of patch.groups ?? []) {
        if (!entry.groups.includes(group)) entry.groups.push(group);
    }
    for (const project of patch.projects ?? []) {
        if (!entry.projects.includes(project)) entry.projects.push(project);
    }
    for (const role of patch.roles ?? []) {
        if (!entry.roles.includes(role)) entry.roles.push(role);
    }
};

export const getTechIndex = (): Map<string, TechEntry> => {
    if (techIndexCache) return techIndexCache;

    const index = new Map<string, TechEntry>();
    const borrowed = new Set<string>();

    for (const group of SKILLS) {
        for (const skill of group.skills) {
            upsertTech(index, borrowed, skill.name, { groups: [group.name], listedSkill: true });
        }
    }
    for (const project of PROJECTS) {
        for (const tag of project.tags) {
            upsertTech(index, borrowed, tag, { projects: [project.title] });
        }
    }
    for (const role of EXPERIENCE) {
        for (const tech of role.details.technologies) {
            upsertTech(index, borrowed, tech, { roles: [`${role.role} at ${role.company}`] });
        }
    }

    techIndexCache = index;
    return index;
};

export const lookupTech = (term: string): TechEntry | null => {
    const index = getTechIndex();
    const key = normalize(term);
    return index.get(key) ?? index.get(key.replace(/[\s.-]/g, '')) ?? null;
};

// ============ Skill groups ============

export interface SkillGroup {
    name: string;
    names: string[];
    keys: string[];
}

let skillGroupsCache: SkillGroup[] | null = null;

export const getSkillGroups = (): SkillGroup[] => {
    if (skillGroupsCache) return skillGroupsCache;

    skillGroupsCache = SKILLS.map((group) => {
        const base = normalize(group.name);
        const keys = new Set<string>([base, base.replace(/\s+/g, '')]);
        if (base.includes('ui')) keys.add('uiux');
        if (base.includes('programming')) keys.add('languages');
        if (base.includes('soft')) keys.add('softskills');
        return { name: group.name, names: group.skills.map((skill) => skill.name), keys: Array.from(keys) };
    });

    return skillGroupsCache;
};

export const lookupSkillGroup = (term: string): SkillGroup | null => {
    const key = normalize(term);
    const compact = key.replace(/[\s.-]/g, '');
    return getSkillGroups().find((group) => group.keys.includes(key) || group.keys.includes(compact)) ?? null;
};

// ============ Projects ============

export interface ProjectEntry {
    title: string;
    slug: string;
    aliases: string[];
    description: string;
    longDescription: string;
    why: string;
    tags: string[];
    liveUrl: string;
    repoUrl: string;
    category: string;
}

/** Readable buckets, derived so a new project is categorised on its own. */
const categoryOf = (tags: string[], description: string): string => {
    const stack = tags.map((tag) => tag.toLowerCase()).join(' ');
    const text = description.toLowerCase();

    if (/wpf|dotnet|\.net|electron|desktop/.test(stack)) return 'Desktop apps';
    if (/\bgame\b|puzzle|whack/.test(text) || /three\.js/.test(stack)) return 'Games & 3D';
    if (/gemini|openai|tensorflow|genkit|llm|agent|\bai\b/.test(`${stack} ${text}`)) return 'AI apps';
    if (/github api|developer|automation|yt-dlp|cli/.test(`${stack} ${text}`)) return 'Developer tools';
    return 'Web apps';
};

let projectsCache: ProjectEntry[] | null = null;

export const getProjects = (): ProjectEntry[] => {
    if (projectsCache) return projectsCache;

    projectsCache = PROJECTS.map((project) => {
        const normalizedTitle = normalize(project.title);
        const aliases = new Set<string>([
            normalizedTitle,
            normalizedTitle.replace(/\s+/g, ''),
            normalizedTitle.replace(/\s+/g, '-'),
            // "MockHick" is typed as "mock hick", and "OHMSchool" as "ohm
            // school" — the second needs an acronym-aware split, which the
            // plain camelCase one misses entirely.
            normalize(
                project.title
                    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
                    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            ),
            normalize(project.aiHint),
        ]);

        return {
            title: project.title,
            slug: slug(project.title),
            aliases: Array.from(aliases).filter(Boolean),
            description: project.description,
            longDescription: project.longDescription,
            why: project.why,
            tags: project.tags,
            liveUrl: project.liveUrl,
            repoUrl: project.repoUrl,
            category: categoryOf(project.tags, `${project.description} ${project.longDescription}`),
        };
    });

    return projectsCache;
};

export const findProjectByText = (text: string): ProjectEntry | null => {
    const normalized = normalize(text);
    if (!normalized) return null;

    const candidates: Array<{ project: ProjectEntry; length: number }> = [];

    for (const project of getProjects()) {
        for (const alias of project.aliases) {
            if (alias.length < 4) continue;
            const pattern = new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
            if (pattern.test(normalized)) candidates.push({ project, length: alias.length });
        }
    }

    // Nothing matched as a phrase: try again ignoring spacing entirely, so
    // "ohm school", "ohmschool" and "ohm-school" all find the same project.
    if (!candidates.length) {
        const compactQuery = normalized.replace(/[\s-]/g, '');

        for (const project of getProjects()) {
            for (const alias of project.aliases) {
                const compactAlias = alias.replace(/[\s-]/g, '');
                // Short names would collide with ordinary words once spacing
                // is thrown away, so only distinctive ones qualify.
                if (compactAlias.length < 5) continue;
                if (compactQuery.includes(compactAlias)) {
                    candidates.push({ project, length: compactAlias.length });
                }
            }
        }
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0].project;
};

// ============ Card builders ============

const bullets = (items: string[]): string => items.map((item) => `• ${item}`).join('\n');

const projectCards = (): KnowledgeCard[] =>
    getProjects().map((project) => ({
        id: `project:${project.slug}`,
        kind: 'project' as const,
        title: project.title,
        aliases: project.aliases,
        keywords: [...project.tags, project.category, 'project', 'built', 'portfolio'],
        body: [
            `**${project.title}** — ${project.description}`,
            '',
            project.longDescription,
            '',
            `**Stack:** ${project.tags.join(', ')}`,
        ].join('\n'),
        speak: `${project.title}. ${project.description} It's built with ${project.tags.slice(0, 4).join(', ')}.`,
        section: 'projects',
        chips: [`Why did he build ${project.title}?`, `Open ${project.title}`, 'Show another project'],
        actions: [
            project.liveUrl ? { type: 'open_url', url: project.liveUrl, label: `Open ${project.title}` } : null,
            project.repoUrl ? { type: 'open_url', url: project.repoUrl, label: 'Source code' } : null,
        ].filter(Boolean) as AssistantAction[],
        weight: 1.1,
        data: { project },
    }));

const skillCards = (): KnowledgeCard[] => {
    const cards: KnowledgeCard[] = SKILLS.map((group) => {
        const names = group.skills.map((skill) => skill.name);
        return {
            id: `skills:${slug(group.name)}`,
            kind: 'skillset' as const,
            title: `${group.name} skills`,
            aliases: [normalize(group.name), `${normalize(group.name)} skills`],
            keywords: [...names, 'skills', 'technology', 'stack'],
            body: `**${group.name}:** ${names.join(', ')}`,
            speak: `For ${group.name.toLowerCase()}, he works with ${names.join(', ')}.`,
            section: 'skills',
            chips: ['His full tech stack', 'Which project uses React?', 'Show his projects'],
            data: { group: group.name, names },
        };
    });

    cards.push({
        id: 'skills:overview',
        kind: 'skillset',
        title: 'Tech stack overview',
        aliases: ['skills', 'tech stack', 'technology', 'stack', 'what he knows', 'skillset'],
        keywords: ['skills', 'technology', 'tools', 'languages', 'frameworks', 'expertise'],
        body: [
            `Here's ${OWNER.firstName}'s full stack:`,
            '',
            ...SKILLS.map((group) => `**${group.name}:** ${group.skills.map((s) => s.name).join(', ')}`),
        ].join('\n'),
        speak: `His stack covers ${SKILLS.slice(0, 4).map((group) => `${group.name.toLowerCase()}: ${group.skills.slice(0, 3).map((s) => s.name).join(', ')}`).join('. ')}.`,
        section: 'skills',
        chips: ['His strongest skills?', 'Does he know Python?', 'Show his projects'],
        weight: 1.15,
    });

    return cards;
};

const experienceCards = (): KnowledgeCard[] => {
    const cards: KnowledgeCard[] = EXPERIENCE.map((role) => ({
        id: `experience:${slug(role.company)}`,
        kind: 'experience' as const,
        title: `${role.role} — ${role.company}`,
        aliases: [normalize(role.company), normalize(role.company).split(' ')[0], normalize(role.role)],
        keywords: [...role.details.technologies, 'experience', 'work', 'job', 'company', 'role'],
        body: [
            `**${role.role}** at **${role.company}** (${role.period})`,
            '',
            role.details.overview,
            '',
            '**What he did:**',
            bullets(role.details.responsibilities.slice(0, 5)),
            '',
            `**Stack:** ${role.details.technologies.join(', ')}`,
        ].join('\n'),
        speak: `${role.role} at ${role.company}, ${role.period}. ${role.details.overview}`,
        section: 'experience',
        actions: role.profileUrl
            ? [{ type: 'open_url', url: role.profileUrl, label: role.profileLabel ?? 'See the proof' }]
            : undefined,
        chips: ['His other roles', 'What tech did he use?', 'Is he open to work?'],
        weight: 1.05,
        data: { role },
    }));

    cards.push({
        id: 'experience:overview',
        kind: 'experience',
        title: 'Work experience',
        aliases: ['experience', 'work experience', 'jobs', 'career', 'work history', 'roles'],
        keywords: ['experience', 'work', 'professional', 'company', 'role', 'employment'],
        body: [
            `${OWNER.firstName}'s roles, most recent first:`,
            '',
            ...EXPERIENCE.map((role) => `• **${role.role}** at **${role.company}** (${role.period}) — ${role.description}`),
        ].join('\n'),
        speak: `${EXPERIENCE.map((role) => `${role.role} at ${role.company}, ${role.period}`).join('. ')}.`,
        section: 'experience',
        chips: [`What does he do at ${CURRENT_ROLE.company}?`, 'His projects', 'Is he open to work?'],
        weight: 1.1,
    });

    return cards;
};

const educationCards = (): KnowledgeCard[] => {
    const degree = EDUCATION[0];

    return [
        {
            id: 'education:overview',
            kind: 'education',
            title: 'Education',
            aliases: ['education', 'college', 'degree', 'studies', 'academics', 'university'],
            keywords: ['education', 'college', 'btech', 'cse', 'school', 'graduate', 'cgpa', 'marks'],
            body: EDUCATION.map(
                (entry) => `🎓 **${entry.degree}** — ${entry.institution} (${entry.period}), ${entry.details}`
            ).join('\n'),
            speak: `${degree.degree} at ${degree.institution}, ${degree.period}, ${degree.details}.`,
            section: 'education',
            chips: ['His certifications', 'His experience', 'His projects'],
            weight: 1.05,
        },
    ];
};

const certificationCards = (): KnowledgeCard[] => {
    const cards: KnowledgeCard[] = CERTIFICATIONS.map((cert) => ({
        id: `certification:${slug(cert.name)}`,
        kind: 'certification' as const,
        title: cert.name,
        aliases: [normalize(cert.name), normalize(cert.issuer)],
        keywords: ['certification', 'certificate', 'course', 'training', cert.issuer],
        body: `📜 **${cert.name}** — issued by ${cert.issuer}.`,
        speak: `${cert.name}, issued by ${cert.issuer}.`,
        section: 'certifications',
        actions: cert.url ? [{ type: 'open_url', url: cert.url, label: 'View certificate' }] : undefined,
        chips: ['All his certifications', 'His education', 'His skills'],
    }));

    cards.push({
        id: 'certification:overview',
        kind: 'certification',
        title: 'Certifications',
        aliases: ['certifications', 'certificates', 'courses', 'training'],
        keywords: ['certification', 'certificate', 'course', 'training'],
        body: [
            `${OWNER.firstName} holds ${CERTIFICATIONS.length} certifications:`,
            '',
            ...CERTIFICATIONS.map((cert) => `• **${cert.name}** — ${cert.issuer}`),
        ].join('\n'),
        speak: `He holds ${CERTIFICATIONS.length} certifications, including ${CERTIFICATIONS.slice(0, 3).map((c) => c.name).join(', ')}.`,
        section: 'certifications',
        chips: ['His education', 'His skills', 'Show his projects'],
        weight: 1.05,
    });

    return cards;
};

const contactCards = (): KnowledgeCard[] => [
    {
        id: 'contact:email',
        kind: 'contact',
        title: 'Email address',
        aliases: ['email', 'mail', 'gmail', 'email address', 'mail id'],
        keywords: ['email', 'contact', 'reach', 'write', 'hire'],
        body: `📧 **${OWNER.email}**\n\nBest route for roles, freelance work or collaboration.`,
        speak: `You can email him at ${OWNER.email.replace('@', ' at ').replace(/\./g, ' dot ')}.`,
        section: 'contact',
        actions: [{ type: 'open_url', url: OWNER.emailHref, label: 'Write an email' }],
        chips: ['His LinkedIn', 'Is he open to work?', 'Download his CV'],
        weight: 1.2,
    },
    {
        id: 'contact:github',
        kind: 'contact',
        title: 'GitHub profile',
        aliases: ['github', 'git hub', 'github profile', 'repositories', 'repos', 'his code'],
        keywords: ['github', 'code', 'repository', 'open source', 'contributions'],
        body: `💻 **GitHub:** ${GITHUB_STATS.username} — ${GITHUB_STATS.publicRepos} public repos, ${GITHUB_STATS.totalPRs} merged PRs, a ${GITHUB_STATS.longestStreak.days}-day longest streak, mostly ${GITHUB_STATS.topLanguage}.`,
        speak: `His GitHub is ${GITHUB_STATS.username}, with ${GITHUB_STATS.publicRepos} public repositories and ${GITHUB_STATS.totalPRs} merged pull requests.`,
        section: 'github',
        actions: [{ type: 'open_url', url: OWNER.github, label: 'Open GitHub' }],
        chips: ['His GitHub stats', 'Show his projects', 'His email'],
        weight: 1.1,
    },
    {
        id: 'contact:linkedin',
        kind: 'contact',
        title: 'LinkedIn profile',
        aliases: ['linkedin', 'linked in', 'linkedin profile'],
        keywords: ['linkedin', 'professional', 'network', 'connect'],
        body: `💼 **LinkedIn:** ${OWNER.linkedin.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}`,
        speak: `Connect with him on LinkedIn, at linkedin dot com slash in slash hakkan.`,
        section: 'contact',
        actions: [{ type: 'open_url', url: OWNER.linkedin, label: 'Open LinkedIn' }],
        chips: ['His email', 'His GitHub', 'Is he open to work?'],
    },
    {
        id: 'contact:overview',
        kind: 'contact',
        title: 'Contact details',
        aliases: ['contact', 'contact details', 'get in touch', 'reach him', 'socials'],
        keywords: ['contact', 'reach', 'connect', 'email', 'linkedin', 'github', 'message'],
        body: [
            `Here's how to reach ${OWNER.firstName}:`,
            '',
            `📧 ${OWNER.email}`,
            `💻 GitHub — ${GITHUB_STATS.username}`,
            `💼 LinkedIn — ${OWNER.linkedin.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}`,
            '',
            `There's a contact form in the Contact section too.`,
        ].join('\n'),
        speak: `You can email him at ${OWNER.email.replace('@', ' at ').replace(/\./g, ' dot ')}, or find him on GitHub and LinkedIn. There's a contact form at the bottom of the page.`,
        section: 'contact',
        actions: [
            { type: 'navigate', target: 'contact', label: 'Go to contact' },
            { type: 'open_url', url: OWNER.emailHref, label: 'Write an email' },
        ],
        chips: ['His email', 'Is he open to work?', 'Download his CV'],
        weight: 1.2,
    },
];

/** The sentence of his bio that says where he is, quoted rather than retyped. */
const LOCATION_LINE = ABOUT_ME.split(/(?<=[.!?])\s+/).find((sentence) => /\bbased in\b/i.test(sentence)) ?? null;

const aboutCards = (): KnowledgeCard[] => [
    {
        id: 'about:summary',
        kind: 'about',
        title: `About ${OWNER.fullName}`,
        aliases: ['about', 'about him', 'who is he', 'bio', 'introduction', 'background', 'summary'],
        keywords: ['about', 'who', 'bio', 'developer', 'engineer', 'introduce'],
        body: ABOUT_ME.trim(),
        speak: ABOUT_ME.split('. ').slice(0, 3).join('. ') + '.',
        section: 'about',
        chips: ['His projects', 'His tech stack', 'Is he open to work?'],
        weight: 1.25,
    },
    {
        id: 'about:location',
        kind: 'about',
        title: 'Where he is based',
        aliases: ['location', 'where is he based', 'where does he live', 'where is he from', 'city', 'country', 'timezone'],
        keywords: ['location', 'based', 'live', 'country', 'india', 'remote', 'timezone', 'ist', 'relocate'],
        body: [
            `📍 ${LOCATION_LINE ?? `He's based in ${OWNER.location}.`}`,
            '',
            `He works remotely as a ${OWNER.headline}, on Indian Standard Time.`,
        ].join('\n'),
        speak: `He's based in India and works remotely, as a ${OWNER.headline}.`,
        section: 'about',
        chips: ['Is he open to work?', 'His experience', 'Contact him'],
        weight: 1.1,
    },
];

/** Projects whose source is public — the open-source answer is this list. */
const publicProjects = () => PROJECTS.filter((project) => project.repoUrl && project.repoUrl !== '#');

/** What he has to show for the work, in his own words from the experience list. */
const proofCards = (): KnowledgeCard[] => {
    const openSource = publicProjects();
    const wins = CURRENT_ROLE.details.achievements;
    const badges = GITHUB_STATS.achievements.map((badge) => badge.name);
    const flagship = PROJECTS.slice(0, 2);

    return [
        {
            id: 'faq:open-source',
            kind: 'faq',
            title: 'Open source work',
            aliases: ['open source', 'opensource', 'public repos', 'source code', 'public code'],
            keywords: ['open', 'source', 'repository', 'repo', 'public', 'github', 'contribute', 'code'],
            body: [
                `🧑‍💻 **${openSource.length} of his ${PROJECTS.length} projects are open source**, out of ${GITHUB_STATS.publicRepos} public repositories on GitHub:`,
                ...openSource.slice(0, 6).map((project) => `• [${project.title}](${project.repoUrl}) — ${project.description}`),
                ...(openSource.length > 6 ? [`• …and ${openSource.length - 6} more on his GitHub.`] : []),
            ].join('\n'),
            speak: `${openSource.length} of his ${PROJECTS.length} projects are open source, including ${openSource.slice(0, 3).map((project) => project.title).join(', ')}. He has ${GITHUB_STATS.publicRepos} public repositories on GitHub.`,
            section: 'github',
            actions: [{ type: 'open_url', url: OWNER.github, label: 'Open his GitHub' }],
            chips: ['GitHub stats', `Tell me about ${openSource[0]?.title ?? 'his projects'}`, 'His skills'],
            weight: 1.1,
        },
        {
            id: 'faq:achievements',
            kind: 'faq',
            title: 'Achievements',
            aliases: ['achievements', 'accomplishments', 'awards', 'wins', 'highlights', 'what has he achieved'],
            keywords: ['achievement', 'accomplishment', 'award', 'win', 'won', 'highlight', 'proud', 'startupathon', 'badge'],
            body: [
                `🏆 **What he has to show for it**`,
                ...wins.map((win) => `• ${win}`),
                ...(badges.length ? ['', `On GitHub he has earned ${badges.join(', ')}.`] : []),
            ].join('\n'),
            speak: `${wins.slice(0, 2).join('. ')}.`,
            section: 'experience',
            actions: [{ type: 'navigate', target: 'experience', label: 'See his experience' }],
            chips: ['His experience', 'His best project', 'Is he open to work?'],
            weight: 1.1,
        },
        {
            id: 'faq:why-him',
            kind: 'faq',
            title: 'Why work with him',
            aliases: ['why hire him', 'should i hire him', 'is he good', 'what makes him different', 'his strengths', 'why him'],
            keywords: ['hire', 'strength', 'good', 'different', 'unique', 'stand', 'special', 'worth', 'talented', 'skilled'],
            // Only what the portfolio can back up — the verdict stays the visitor's.
            body: [
                `I'm his assistant, so judge the evidence rather than my opinion:`,
                ...wins.slice(0, 3).map((win) => `• ${win}`),
                `• He builds the whole product — model, backend and interface — as a ${OWNER.headline}`,
                '',
                `Start with ${flagship.map((project) => `**${project.title}**`).join(' and ')}, then ask him anything directly: **${OWNER.email}**`,
            ].join('\n'),
            speak: `I'm his assistant, so judge the evidence. ${wins[0]}. He builds the whole product, from the model to the interface. Have a look at ${flagship.map((project) => project.title).join(' and ')}.`,
            section: 'projects',
            actions: [{ type: 'navigate', target: 'projects', label: 'See his projects' }],
            chips: [`Tell me about ${flagship[0].title}`, 'Is he open to work?', 'Download his CV'],
            weight: 1.05,
        },
    ];
};

/** The prose is hard-wrapped for the editor; an answer shouldn't be. */
const unwrap = (text: string): string => text.replace(/\s*\n\s*/g, ' ').trim();

/** He wrote the prose in the first person — the assistant quotes it, never speaks as him. */
const inHisWords = (text: string): string => `In his words: "${unwrap(text)}"`;

/**
 * Sections of the prose that are instructions to the language model — how to
 * sound, what never to say. They are not facts about him, and reciting them to
 * a visitor ("Dry, confident, a little self-deprecating…") is just wrong.
 */
const INSTRUCTION_SECTIONS = /^(?:how i want the bot to sound|off-limits)$/i;

interface ProseBlock {
    /** The heading the block sits under. */
    section: string;
    text: string;
    /** True for an item of a bulleted list. */
    listed: boolean;
}

/**
 * The free prose as answerable blocks: one per paragraph, one per bullet.
 *
 * Left out: the instruction sections above, his own TODO notes, and the bullet
 * written in the model's voice ("you're talking to me right now").
 */
const proseBlocks = (): ProseBlock[] => {
    const blocks: ProseBlock[] = [];
    let section = '';

    const keep = (text: string, listed = false) => {
        const clean = text.trim();
        if (!clean || /^(?:Q:\s*)?TODO\b/i.test(clean) || /\btalking to me\b/i.test(clean)) return;
        blocks.push({ section, text: clean, listed });
    };

    for (const raw of PROFILE_PROSE.split(/\n\s*\n/)) {
        const part = raw.trim();
        if (!part) continue;

        const heading = part.match(/^#+\s*(.+)$/);
        if (heading && !part.includes('\n')) {
            section = heading[1].trim();
            continue;
        }
        if (INSTRUCTION_SECTIONS.test(section)) continue;

        const lines = part.split('\n');
        const firstBullet = lines.findIndex((line) => /^\s*-\s+/.test(line));
        if (firstBullet === -1) {
            keep(part);
            continue;
        }

        // A lead-in that only exists to introduce the list ("Things worth
        // pointing people at —") says nothing once the list is split off.
        keep(lines.slice(0, firstBullet).join('\n').replace(/[^.!?]*[—:]\s*$/, ''));

        let bullet = '';
        for (const line of lines.slice(firstBullet)) {
            if (/^\s*-\s+/.test(line)) {
                keep(bullet, true);
                bullet = line.replace(/^\s*-\s+/, '');
            } else {
                bullet += `\n${line.trim()}`;
            }
        }
        keep(bullet, true);
    }
    return blocks;
};

/**
 * The free prose as cards, so a question can pull in just the part that
 * answers it. This is where availability, opinions, the site's hidden features
 * and the "questions people actually ask" live.
 */
const proseCards = (): KnowledgeCard[] =>
    proseBlocks().flatMap(({ section, text }, index): KnowledgeCard[] => {
        const chips = ['His projects', 'Is he open to work?', 'Contact him'];

        // "Q: …\nA: …" pairs: the question is what people will type, so it is
        // the title; the answer is his, so it is quoted as his. Printing the
        // raw pair made the assistant read "Q:" and "A:" aloud.
        const qa = text.match(/^Q:\s*([\s\S]+?)\nA:\s*([\s\S]+)$/);
        if (qa) {
            const question = unwrap(qa[1]);
            const reply = unwrap(qa[2]);
            return [{
                id: `prose:${index}`,
                kind: 'faq',
                title: question,
                aliases: [normalize(question)],
                keywords: [],
                body: inHisWords(reply),
                speak: `In his words: ${reply}`,
                section: 'about',
                chips,
                weight: 1,
            }];
        }

        const body = unwrap(text);
        if (body.length <= 60) return [];

        return [{
            id: `prose:${index}`,
            kind: 'faq',
            title: body.length <= 70 ? body : `${body.slice(0, 60)}…`,
            aliases: [],
            // The heading is the only label a paragraph has ("About this site").
            keywords: normalize(section).split(' ').filter((word) => word.length > 3),
            body: inHisWords(body),
            speak: `In his words: ${body}`,
            section: 'about',
            chips,
            weight: 0.95,
        }];
    });

/** The paragraph where he says what he's open to, if he has written one. */
const availabilityProse = (): string | null =>
    proseBlocks()
        .map((block) => block.text)
        .find((text) => !/^Q:/.test(text) && /\b(open to|available for|freelance|contract work)\b/i.test(text)) ?? null;

const availabilityCard = (): KnowledgeCard => {
    const prose = availabilityProse();

    return {
        id: 'faq:availability',
        kind: 'faq',
        title: 'Open to work',
        aliases: ['availability', 'is he available', 'open to work', 'hiring', 'can i hire him', 'freelance', 'work with him'],
        keywords: ['availability', 'hire', 'freelance', 'opportunity', 'recruit', 'collaborate', 'contract'],
        // Quoted, never paraphrased into a commitment he didn't make.
        body: [
            prose ? inHisWords(prose) : `His portfolio doesn't spell out what he's available for right now.`,
            '',
            `The fastest way to ask is email: **${OWNER.email}**`,
        ].join('\n'),
        speak: prose
            ? `In his words: ${unwrap(prose).replace(/\.$/, '')}. The fastest way to ask is email.`
            : `His portfolio doesn't spell that out. The fastest way to ask is email.`,
        section: 'contact',
        actions: [{ type: 'open_url', url: OWNER.emailHref, label: 'Write an email' }],
        chips: ['His experience', 'Download his CV', 'His email'],
        weight: 1.15,
    };
};

/**
 * The things he says are worth finding on the site — the terminal, the game
 * hub, the Reality toggle — as quoted one-liners for the site tour.
 */
const siteExtras = (): string[] => {
    const extras = proseBlocks()
        .filter((block) => block.listed && /\bsite\b/i.test(block.section))
        .map((block) => unwrap(block.text).match(/^.*?[.!?](?=\s|$)/)?.[0] ?? unwrap(block.text))
        .slice(0, 4);

    return extras.length ? ['', `Worth finding, in his words:`, ...extras.map((extra) => `• "${extra}"`)] : [];
};

const featureCards = (): KnowledgeCard[] => [
    {
        id: 'faq:resume',
        kind: 'faq',
        title: 'Resume / CV',
        aliases: ['resume', 'cv', 'download cv', 'download resume', 'curriculum vitae'],
        keywords: ['resume', 'cv', 'download', 'pdf', 'hire'],
        body: `📄 His resume is on this page — I can open it for you, or use the **Resume** button in the home section.`,
        speak: `I can open his resume for you — it's also behind the resume button in the home section.`,
        section: 'home',
        actions: [{ type: 'download', url: OWNER.resumePath, label: 'Open his resume' }],
        chips: ['Is he open to work?', 'His experience', 'His email'],
        weight: 1.1,
    },
    {
        id: 'faq:github-stats',
        kind: 'faq',
        title: 'GitHub activity and stats',
        aliases: ['github stats', 'contributions', 'streak', 'commits', 'github activity'],
        keywords: ['github', 'stats', 'streak', 'contribution', 'repos', 'languages'],
        body: [
            `📊 **GitHub at a glance**`,
            `• ${GITHUB_STATS.publicRepos} public repositories`,
            `• ${GITHUB_STATS.totalPRs} merged pull requests`,
            `• ${GITHUB_STATS.longestStreak.days}-day longest streak (${GITHUB_STATS.longestStreak.period})`,
            `• Most used: ${GITHUB_STATS.languages.slice(0, 4).map((l) => `${l.name} ${l.percentage}%`).join(', ')}`,
        ].join('\n'),
        speak: `He has ${GITHUB_STATS.publicRepos} public repositories, ${GITHUB_STATS.totalPRs} merged pull requests, and a ${GITHUB_STATS.longestStreak.days} day longest streak. ${GITHUB_STATS.topLanguage} is his most used language.`,
        section: 'github',
        actions: [{ type: 'navigate', target: 'github', label: 'See the graph' }],
        chips: ['His GitHub profile', 'Show his projects', 'His skills'],
    },
    {
        id: 'faq:site-tour',
        kind: 'feature',
        title: 'What is on this site',
        aliases: ['this site', 'this page', 'what is here', 'sections', 'navigate', 'tour'],
        keywords: ['section', 'page', 'site', 'where', 'find', 'show'],
        body: [
            `This portfolio has: **Home**, **About**, **Experience**, **Projects**, **GitHub**, **Skills**, **Education**, **Certifications** and **Contact**.`,
            '',
            `Say "take me to projects" and I'll scroll you there — or ask me to open a project, his GitHub or his resume.`,
            ...siteExtras(),
        ].join('\n'),
        speak: `This site has home, about, experience, projects, GitHub, skills, education, certifications and contact. Tell me where to go and I'll take you there.`,
        // The body names every section and quotes the extras, so indexing it
        // would make this card a weak match for nearly any question.
        noBodyIndex: true,
        chips: ['Take me to projects', 'Open his GitHub', 'Download his CV'],
    },
];

const metaCards = (): KnowledgeCard[] => [
    {
        id: 'meta:identity',
        kind: 'meta',
        title: 'About this assistant',
        aliases: ['who are you', 'what are you', 'your name', 'about you', 'are you ai', 'are you a bot'],
        keywords: ['you', 'bot', 'assistant', 'ai', 'robot', 'yourself'],
        body: `I'm ${OWNER.firstName}'s portfolio assistant. I know his ${PROJECTS.length} projects, his stack, his roles and how to reach him — and I can drive this page for you: scroll to a section, open a project, pull up his resume.`,
        speak: `I'm ${OWNER.firstName}'s portfolio assistant. I know his work, and I can drive this page for you — just tell me where to go.`,
        chips: ['What can you do?', 'Show his projects', 'Is he open to work?'],
    },
    {
        id: 'meta:capabilities',
        kind: 'meta',
        title: 'What this assistant can do',
        aliases: ['what can you do', 'help', 'capabilities', 'commands', 'how to use'],
        keywords: ['help', 'can', 'do', 'capability', 'guide', 'options'],
        body: [
            `Ask me anything about ${OWNER.firstName} — and I can act on this page too:`,
            '',
            `• *"Take me to his projects"* — I'll scroll there`,
            `• *"Open OHMSchool"* — I'll open the live project`,
            `• *"Show me his GitHub"* — I'll open his profile`,
            `• *"Download his CV"* — I'll pull up his resume`,
            `• *"Does he know Python?"* · *"What does he do at ${CURRENT_ROLE.company}?"*`,
            '',
            `Tap the mic and just talk — I answer out loud.`,
        ].join('\n'),
        speak: `Ask me anything about his work, and I can act on this page too. I can scroll to a section, open a project, open his GitHub, or pull up his resume. Just tell me what you want.`,
        chips: ['Take me to projects', 'Open his GitHub', 'Is he open to work?'],
        noBodyIndex: true,
    },
];

// ============ Public API ============

let cardsCache: KnowledgeCard[] | null = null;

export const getCards = (): KnowledgeCard[] => {
    if (cardsCache) return cardsCache;

    cardsCache = [
        ...aboutCards(),
        ...projectCards(),
        ...skillCards(),
        ...experienceCards(),
        ...educationCards(),
        ...certificationCards(),
        ...contactCards(),
        availabilityCard(),
        ...featureCards(),
        ...proofCards(),
        ...proseCards(),
        ...metaCards(),
    ];

    return cardsCache;
};

export const getCardById = (id: string): KnowledgeCard | undefined =>
    getCards().find((card) => card.id === id);
