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

const techKeys = (label: string): string[] => {
    const base = normalize(label);
    const keys = new Set<string>([base, base.replace(/[\s.-]/g, '')]);

    const words = base.split(' ').filter(Boolean);
    if (words.length > 1 && !GENERIC_TECH_WORDS.has(words[0]) && words[0].length > 2) {
        keys.add(words[0]);
    }
    return Array.from(keys).filter(Boolean);
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
    label: string,
    patch: Partial<Omit<TechEntry, 'label' | 'keys'>>
): void => {
    const keys = techKeys(label);
    const existing = keys.map((key) => index.get(key)).find(Boolean);

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

    for (const key of keys) {
        if (!entry.keys.includes(key)) entry.keys.push(key);
        index.set(key, entry);
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

    for (const group of SKILLS) {
        for (const skill of group.skills) {
            upsertTech(index, skill.name, { groups: [group.name], listedSkill: true });
        }
    }
    for (const project of PROJECTS) {
        for (const tag of project.tags) {
            upsertTech(index, tag, { projects: [project.title] });
        }
    }
    for (const role of EXPERIENCE) {
        for (const tech of role.details.technologies) {
            upsertTech(index, tech, { roles: [`${role.role} at ${role.company}`] });
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
            // "MockHick" is also typed and said as "mock hick"
            normalize(project.title.replace(/([a-z])([A-Z])/g, '$1 $2')),
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
];

/**
 * The free prose, chunked by paragraph so a question can pull in just the part
 * that answers it. This is where availability, opinions and the answers to
 * "questions people actually ask" live.
 */
const proseCards = (): KnowledgeCard[] => {
    const paragraphs = PROFILE_PROSE.split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter((part) => part.length > 60);

    return paragraphs.map((paragraph, index) => {
        // A markdown-ish heading or the first few words make a usable title.
        const firstLine = paragraph.split('\n')[0].replace(/^#+\s*/, '').trim();
        const title = firstLine.length <= 70 ? firstLine : `${firstLine.slice(0, 60)}…`;

        return {
            id: `prose:${index}`,
            kind: 'faq' as const,
            title,
            aliases: [],
            keywords: [],
            body: paragraph,
            section: 'about',
            chips: ['His projects', 'Is he open to work?', 'Contact him'],
            weight: 0.95,
        };
    });
};

/** The paragraph where he says what he's open to, if he has written one. */
const availabilityProse = (): string | null =>
    PROFILE_PROSE.split(/\n\s*\n/)
        .map((part) => part.trim())
        .find((part) => /\b(open to|available for|freelance|contract work)\b/i.test(part)) ?? null;

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
            prose ?? `His portfolio doesn't spell out what he's available for right now.`,
            '',
            `The fastest way to ask is email: **${OWNER.email}**`,
        ].join('\n'),
        speak: prose
            ? `${prose.split('. ').slice(0, 2).join('. ')}. The fastest way to ask is email.`
            : `His portfolio doesn't spell that out. The fastest way to ask is email.`,
        section: 'contact',
        actions: [{ type: 'open_url', url: OWNER.emailHref, label: 'Write an email' }],
        chips: ['His experience', 'Download his CV', 'His email'],
        weight: 1.15,
    };
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
        ].join('\n'),
        speak: `This site has home, about, experience, projects, GitHub, skills, education, certifications and contact. Tell me where to go and I'll take you there.`,
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
        ...proseCards(),
        ...metaCards(),
    ];

    return cardsCache;
};

export const getCardById = (id: string): KnowledgeCard | undefined =>
    getCards().find((card) => card.id === id);
