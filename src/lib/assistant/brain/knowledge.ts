/**
 * Knowledge graph
 *
 * Builds the assistant's retrievable knowledge from `src/lib/data.ts` — the same
 * data the portfolio renders — so the bot can never fall out of sync with the site.
 * Curated prose from `knowledge-base.ts` is joined in by project name to keep the
 * writing warm without duplicating facts.
 */

import {
    PROJECTS,
    SKILLS,
    EXPERIENCE,
    EDUCATION,
    CERTIFICATIONS,
    CONTACT_INFO,
    ABOUT_ME,
} from '@/lib/data';
import { PROJECTS_KNOWLEDGE } from '../knowledge-base';
import { normalize } from './nlp';
import type { KnowledgeCard } from './types';

// ============ Identity constants ============

export const OWNER = {
    firstName: 'Hakkan',
    fullName: 'Hakkan Parbej Shah',
    headline: 'Full-stack developer and final-year B.Tech CSE student',
    email: 'hakkanparbej@gmail.com',
    phone: '+91-7810843038',
    github: 'https://github.com/HakkanShah',
    linkedin: 'https://www.linkedin.com/in/hakkan/',
    googleDev: 'https://g.dev/hakkan',
    location: 'Kolkata, West Bengal, India',
    resumePath: 'the **Download CV** button in the home section, just below the terminal animation',
};

/** Stats shown in the GitHub Activity section of the site. */
export const GITHUB_STATS = {
    publicRepos: 27,
    longestStreak: '77 days',
    mergedPRs: 32,
    topLanguages: ['TypeScript', 'JavaScript', 'CSS', 'HTML', 'Python'],
    achievements: ['Pull Shark x2', 'YOLO', 'Quickdraw', 'Pair Extraordinaire'],
};

// ============ Helpers ============

/** Ends a sentence without doubling a full stop ("PVT. LTD." + "." = "LTD..") */
const endSentence = (text: string): string => (text.trim().endsWith('.') ? text.trim() : `${text.trim()}.`);

const slug = (value: string): string =>
    normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Words too generic to use as a standalone tech alias. */
const GENERIC_TECH_WORDS = new Set([
    'web', 'api', 'apis', 'app', 'design', 'modern', 'real', 'time', 'cloud', 'data',
    'performance', 'counters', 'generation', 'integration',
    'restful', 'communication', 'setup', 'windows', 'speech',
]);

/** Every lookup key a tech label should answer to. */
const techKeys = (label: string): string[] => {
    const base = normalize(label);
    const keys = new Set<string>([base, base.replace(/[\s.-]/g, '')]);

    const words = base.split(' ').filter(Boolean);
    if (words.length > 1 && !GENERIC_TECH_WORDS.has(words[0]) && words[0].length > 2) {
        keys.add(words[0]);
    }
    return Array.from(keys).filter(Boolean);
};

// ============ Tech index ============

export interface TechEntry {
    label: string;
    keys: string[];
    /** Skill groups from the Skills section that list this tech. */
    groups: string[];
    /** Project titles whose stack includes it. */
    projects: string[];
    /** Internship roles that used it. */
    roles: string[];
    /** True when it appears in the portfolio's own Skills section. */
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

    // Prefer the canonical Skills-section spelling for display.
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
        if (base === 'ui/ux' || base === 'uiux') keys.add('uiux');
        if (base === 'programming languages') keys.add('languages');
        if (base === 'soft skills') keys.add('softskills');
        return { name: group.name, names: group.skills.map((skill) => skill.name), keys: Array.from(keys) };
    });

    return skillGroupsCache;
};

export const lookupSkillGroup = (term: string): SkillGroup | null => {
    const key = normalize(term);
    const compact = key.replace(/[\s.-]/g, '');
    return (
        getSkillGroups().find((group) => group.keys.includes(key) || group.keys.includes(compact)) ?? null
    );
};

// ============ Project metadata ============

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
    /** Curated extras, when the knowledge base has prose for this project. */
    techHighlights?: string;
    coolFact?: string;
    detailed?: string;
}

/**
 * A small, readable set of buckets for grouping. Derived from the stack and the
 * description so new projects in data.ts are categorised automatically.
 */
const categoryOf = (tags: string[], description: string): string => {
    const stack = tags.map((tag) => tag.toLowerCase()).join(' ');
    const text = description.toLowerCase();

    if (/wpf|dotnet|\.net|windows/.test(stack)) return 'Desktop apps';
    if (/\bgame\b|puzzle|whack/.test(text) || /three\.js/.test(stack)) return 'Games & 3D';
    if (/gemini|openai|tensorflow|genkit|\bai\b/.test(stack) || /\bai[- ]powered\b/.test(text)) return 'AI apps';
    if (/github api|developer|automation|yt-dlp/.test(`${stack} ${text}`)) return 'Developer tools';
    return 'Web apps';
};

let projectsCache: ProjectEntry[] | null = null;

export const getProjects = (): ProjectEntry[] => {
    if (projectsCache) return projectsCache;

    projectsCache = PROJECTS.map((project) => {
        const curated = PROJECTS_KNOWLEDGE.find(
            (entry) => normalize(entry.name) === normalize(project.title)
        );

        const aliases = new Set<string>([
            normalize(project.title),
            normalize(project.title).replace(/\s+/g, ''),
            normalize(project.title).replace(/\s+/g, '-'),
            ...(curated?.aliases ?? []).map(normalize),
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
            techHighlights: curated?.techHighlights,
            coolFact: curated?.coolFact,
            detailed: curated?.detailedDescription,
        };
    });

    return projectsCache;
};

export const findProjectByText = (text: string): ProjectEntry | null => {
    const normalized = normalize(text);
    if (!normalized) return null;

    const projects = getProjects();
    const candidates: Array<{ project: ProjectEntry; length: number }> = [];

    for (const project of projects) {
        for (const alias of project.aliases) {
            // Alias must appear as a whole phrase, and be specific enough to trust.
            if (alias.length < 4) continue;
            const pattern = new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
            if (pattern.test(normalized)) {
                candidates.push({ project, length: alias.length });
            }
        }
    }

    if (!candidates.length) return null;
    // Longest alias wins, so "commit habit" beats a stray "habit".
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
            `🔗 [Live](${project.liveUrl}) · [Source](${project.repoUrl})`,
        ].join('\n'),
        speak: `${project.title}. ${project.description} It is built with ${project.tags.slice(0, 4).join(', ')}.`,
        section: 'projects',
        chips: [`Why did he build ${project.title}?`, `${project.title} tech stack`, 'Show other projects'],
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
            speak: `For ${group.name.toLowerCase()}, ${OWNER.firstName} works with ${names.join(', ')}.`,
            section: 'skills',
            chips: ['Full tech stack', 'Which project uses React?', 'Show his projects'],
            data: { group: group.name, names },
        };
    });

    const all = SKILLS.map((group) => `**${group.name}:** ${group.skills.map((s) => s.name).join(', ')}`);

    cards.push({
        id: 'skills:overview',
        kind: 'skillset',
        title: 'Tech stack overview',
        aliases: ['skills', 'tech stack', 'technology', 'stack', 'what he knows', 'skillset'],
        keywords: ['skills', 'technology', 'tools', 'languages', 'frameworks', 'expertise'],
        body: [`Here's ${OWNER.firstName}'s full stack:`, '', ...all].join('\n'),
        speak: `${OWNER.firstName}'s core stack is React, Next.js and TypeScript on the front end, Node.js, Express and Flask on the back end, with MongoDB, PostgreSQL and Supabase for data. He also works in Java, C and Python, and integrates AI APIs like Gemini.`,
        section: 'skills',
        chips: ['His strongest skills?', 'Does he know Python?', 'Show his projects'],
        weight: 1.15,
        data: { overview: true },
    });

    return cards;
};

const experienceCards = (): KnowledgeCard[] => {
    const cards: KnowledgeCard[] = EXPERIENCE.map((role) => ({
        id: `experience:${slug(role.company)}`,
        kind: 'experience' as const,
        title: `${role.role} — ${role.company}`,
        aliases: [normalize(role.company), normalize(role.company).split(' ')[0], normalize(role.role)],
        keywords: [...role.details.technologies, 'experience', 'internship', 'job', 'work', 'company'],
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
        chips: ['His other internship', 'What tech did he use?', 'Is he open to work?'],
        weight: 1.05,
        data: { role },
    }));

    cards.push({
        id: 'experience:overview',
        kind: 'experience',
        title: 'Work experience',
        aliases: ['experience', 'work experience', 'internships', 'jobs', 'career', 'work history'],
        keywords: ['experience', 'internship', 'work', 'professional', 'company', 'intern'],
        body: [
            `${OWNER.firstName} has done two developer internships:`,
            '',
            ...EXPERIENCE.map(
                (role) => `• **${role.role}** at **${role.company}** (${role.period}) — ${role.description}`
            ),
        ].join('\n'),
        speak: `${OWNER.firstName} has two internships. ${EXPERIENCE.map((role) => `${role.role} at ${role.company}, ${role.period}`).join('. ')}.`,
        section: 'experience',
        chips: ['What did he do at UDRCRAFTS?', 'Tell me about AIKing Solutions', 'Is he open to work?'],
        weight: 1.1,
        data: { overview: true },
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
            aliases: ['education', 'college', 'degree', 'studies', 'academics', 'cgpa', 'university'],
            keywords: ['education', 'college', 'btech', 'cse', 'cgpa', 'school', 'graduate', 'marks'],
            body: [
                `🎓 **${degree.degree}** — ${degree.institution} (${degree.period}), ${degree.details}`,
                '',
                ...EDUCATION.slice(1).map(
                    (entry) => `• **${entry.degree}** — ${entry.institution}, ${entry.period} (${entry.details})`
                ),
            ].join('\n'),
            speak: `${OWNER.firstName} is doing his ${degree.degree} at ${degree.institution}, from ${degree.period}, with a ${degree.details}. Before that, higher secondary with 85 percent and secondary with 80 percent.`,
            section: 'education',
            chips: ['What is his CGPA?', 'When does he graduate?', 'His certifications'],
            weight: 1.05,
            data: { degrees: EDUCATION },
        },
        {
            id: 'education:cgpa',
            kind: 'education',
            title: 'CGPA and academic scores',
            aliases: ['cgpa', 'gpa', 'marks', 'percentage', 'grades', 'score'],
            keywords: ['cgpa', 'marks', 'percentage', 'grade', 'result', 'academic'],
            body: [
                `📊 **Academic record**`,
                `• B.Tech CSE — ${degree.details} (${degree.institution})`,
                ...EDUCATION.slice(1).map((entry) => `• ${entry.degree} — ${entry.details}`),
            ].join('\n'),
            speak: `His B.Tech CGPA is 7.5 out of 10. He scored 85 percent in higher secondary and 80 percent in secondary.`,
            section: 'education',
            chips: ['Where does he study?', 'When does he graduate?', 'His skills'],
            data: { cgpa: degree.details },
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
        body: `📜 **${cert.name}** — issued by ${cert.issuer}. [View certificate](${cert.url})`,
        speak: `${cert.name}, issued by ${cert.issuer}.`,
        section: 'certifications',
        chips: ['All his certifications', 'His education', 'His skills'],
        data: { cert },
    }));

    cards.push({
        id: 'certification:overview',
        kind: 'certification',
        title: 'Certifications',
        aliases: ['certifications', 'certificates', 'courses', 'training'],
        keywords: ['certification', 'certificate', 'course', 'aws', 'cybersecurity', 'training'],
        body: [
            `${OWNER.firstName} holds ${CERTIFICATIONS.length} certifications:`,
            '',
            ...CERTIFICATIONS.map((cert) => `• **${cert.name}** — ${cert.issuer}`),
        ].join('\n'),
        speak: `He holds ${CERTIFICATIONS.length} certifications: ${CERTIFICATIONS.map((cert) => cert.name).join(', ')}.`,
        section: 'certifications',
        chips: ['His education', 'His skills', 'Show his projects'],
        weight: 1.05,
        data: { overview: true },
    });

    return cards;
};

const contactCards = (): KnowledgeCard[] => {
    const byName = (name: string) => CONTACT_INFO.find((entry) => entry.name === name);
    const email = byName('Email');
    const phone = byName('Phone');

    const cards: KnowledgeCard[] = [
        {
            id: 'contact:email',
            kind: 'contact',
            title: 'Email address',
            aliases: ['email', 'mail', 'gmail', 'email address', 'mail id'],
            keywords: ['email', 'contact', 'reach', 'write', 'hire'],
            body: `📧 **Email:** [${email?.value}](mailto:${email?.value})\n\nBest route for jobs, freelance work or collaboration.`,
            speak: `You can email him at ${email?.value?.replace('@', ' at ').replace(/\./g, ' dot ')}.`,
            section: 'contact',
            chips: ['His LinkedIn', 'His phone number', 'Is he open to work?'],
            weight: 1.2,
        },
        {
            id: 'contact:phone',
            kind: 'contact',
            title: 'Phone number',
            aliases: ['phone', 'phone number', 'mobile number', 'whatsapp', 'his number'],
            keywords: ['phone', 'call', 'contact', 'text', 'whatsapp'],
            body: `📱 **Phone:** [${phone?.value}](tel:+917810843038)\n\nA text first is appreciated.`,
            speak: `His number is plus 91 7 8 1 0 8 4 3 0 3 8. A text first is appreciated.`,
            section: 'contact',
            chips: ['His email', 'His LinkedIn', 'Contact section'],
            weight: 1.1,
        },
        {
            id: 'contact:github',
            kind: 'contact',
            title: 'GitHub profile',
            aliases: ['github', 'git hub', 'github profile', 'repositories', 'repos'],
            keywords: ['github', 'code', 'repository', 'open source', 'contributions'],
            body: `💻 **GitHub:** [HakkanShah](${OWNER.github})\n\n${GITHUB_STATS.publicRepos} public repos, a ${GITHUB_STATS.longestStreak} longest streak and ${GITHUB_STATS.mergedPRs} merged PRs — the live graph is in the GitHub section.`,
            speak: `His GitHub is github dot com slash HakkanShah, with ${GITHUB_STATS.publicRepos} public repositories and a ${GITHUB_STATS.longestStreak} longest streak.`,
            section: 'github',
            chips: ['His GitHub stats', 'Show his projects', 'His email'],
            weight: 1.1,
        },
        {
            id: 'contact:linkedin',
            kind: 'contact',
            title: 'LinkedIn profile',
            aliases: ['linkedin', 'linked in', 'linkedin profile'],
            keywords: ['linkedin', 'professional', 'network', 'connect'],
            body: `💼 **LinkedIn:** [linkedin.com/in/hakkan](${OWNER.linkedin})`,
            speak: `Connect with him on LinkedIn at linkedin dot com slash in slash hakkan.`,
            section: 'contact',
            chips: ['His email', 'His GitHub', 'Is he open to work?'],
        },
        {
            id: 'contact:overview',
            kind: 'contact',
            title: 'Contact details',
            aliases: ['contact', 'contact details', 'get in touch', 'reach him', 'socials'],
            keywords: ['contact', 'reach', 'connect', 'email', 'phone', 'linkedin', 'github', 'message'],
            body: [
                `Here's how to reach ${OWNER.firstName}:`,
                '',
                `📧 [${email?.value}](mailto:${email?.value})`,
                `📱 ${phone?.value}`,
                `💻 [GitHub](${OWNER.github})`,
                `💼 [LinkedIn](${OWNER.linkedin})`,
                `🌐 [g.dev/hakkan](${OWNER.googleDev})`,
                '',
                `There's also a contact form in the Contact section of this page.`,
            ].join('\n'),
            speak: `You can email him at ${email?.value?.replace('@', ' at ').replace(/\./g, ' dot ')}, call plus 91 7 8 1 0 8 4 3 0 3 8, or find him on GitHub and LinkedIn. There is a contact form at the bottom of the page too.`,
            section: 'contact',
            chips: ['His email', 'Is he open to work?', 'Download his CV'],
            weight: 1.2,
        },
    ];

    return cards;
};

const aboutCards = (): KnowledgeCard[] => [
    {
        id: 'about:summary',
        kind: 'about',
        title: `About ${OWNER.fullName}`,
        aliases: ['about', 'about him', 'who is he', 'bio', 'introduction', 'background', 'summary'],
        keywords: ['about', 'who', 'bio', 'developer', 'student', 'introduce', 'fullstack'],
        body: [
            `**${OWNER.fullName}** — ${OWNER.headline} based in ${OWNER.location}.`,
            '',
            ABOUT_ME.trim(),
            '',
            `Right now he's a Full Stack Developer Intern at ${EXPERIENCE[0].company} and has shipped ${PROJECTS.length} public projects.`,
        ].join('\n'),
        speak: `${OWNER.fullName} is a full-stack developer and final-year B.Tech Computer Science student from Kolkata. He builds web apps with React, Next.js and TypeScript, integrates AI APIs, and has shipped ${PROJECTS.length} public projects. He's currently a full stack developer intern at ${endSentence(EXPERIENCE[0].company)}`,
        section: 'about',
        chips: ['His projects', 'His skills', 'Is he open to work?'],
        weight: 1.25,
    },
    {
        id: 'about:location',
        kind: 'about',
        title: 'Where he is based',
        aliases: ['location', 'where he lives', 'city', 'based', 'hometown'],
        keywords: ['location', 'city', 'kolkata', 'india', 'based', 'remote'],
        body: `📍 ${OWNER.firstName} is based in **${OWNER.location}**, and studies at ${EDUCATION[0].institution}.`,
        speak: `He's based in Kolkata, West Bengal, India.`,
        section: 'about',
        chips: ['His education', 'Is he open to work?', 'Contact him'],
    },
];

const faqCards = (): KnowledgeCard[] => {
    const aiProjects = getProjects().filter((project) =>
        project.tags.some((tag) => /gemini|openai|tensorflow|genkit|ai/i.test(tag))
    );

    return [
        {
            id: 'faq:availability',
            kind: 'faq',
            title: 'Open to work',
            aliases: ['availability', 'is he available', 'open to work', 'hiring', 'can i hire him', 'freelance'],
            keywords: ['availability', 'hire', 'job', 'freelance', 'opportunity', 'recruit', 'fresher', 'intern'],
            body: [
                `Yes — ${OWNER.firstName} is open to **full-time roles, internships and freelance work**.`,
                '',
                `He graduates in ${EDUCATION[0].period.split('–')[1]?.trim() ?? '2026'} and is currently interning as a ${EXPERIENCE[0].role} at ${endSentence(EXPERIENCE[0].company)}`,
                '',
                `Fastest route: 📧 [${OWNER.email}](mailto:${OWNER.email}) — or use the contact form below.`,
            ].join('\n'),
            speak: `Yes, he's open to full-time roles, internships and freelance work. He graduates in 2026 and is currently interning at ${endSentence(EXPERIENCE[0].company)} The fastest way to reach him is email.`,
            section: 'contact',
            chips: ['His experience', 'Download his CV', 'His email'],
            weight: 1.15,
        },
        {
            id: 'faq:why-hire',
            kind: 'faq',
            title: 'Why hire him',
            aliases: ['why hire him', 'why should i hire him', 'what makes him good', 'his strengths'],
            keywords: ['hire', 'why', 'strength', 'good', 'value', 'stand out', 'best'],
            body: [
                `A few concrete reasons:`,
                '',
                `• **Ships end to end** — ${PROJECTS.length} public projects, from a Windows utility in .NET to AI web apps.`,
                `• **Real production experience** — two internships, including payment-gateway and e-commerce work at ${endSentence(EXPERIENCE[0].company)}`,
                `• **Modern stack, done properly** — Next.js, TypeScript, Postgres/Prisma, Tailwind, deployed on Vercel.`,
                `• **AI integration is routine for him** — Gemini powers MockHick, VerifyAI, BuildMyCV and AluChat.`,
                `• **Consistent** — ${GITHUB_STATS.publicRepos} public repos and a ${GITHUB_STATS.longestStreak} GitHub streak.`,
            ].join('\n'),
            speak: `He ships end to end: ${PROJECTS.length} public projects, two internships with real production work including payment integration, a modern Next.js and TypeScript stack, and hands-on AI integration with Gemini across several apps.`,
            section: 'projects',
            chips: ['His best projects', 'Download his CV', 'Is he open to work?'],
        },
        {
            id: 'faq:resume',
            kind: 'faq',
            title: 'Resume / CV',
            aliases: ['resume', 'cv', 'download cv', 'download resume', 'curriculum vitae'],
            keywords: ['resume', 'cv', 'download', 'pdf', 'hire'],
            body: `📄 His resume is on this page — ${OWNER.resumePath}. Click it to preview or download the PDF.`,
            speak: `His resume is in the home section. Look for the Download CV button just below the terminal animation.`,
            section: 'home',
            chips: ['Is he open to work?', 'His experience', 'His email'],
            weight: 1.1,
        },
        {
            id: 'faq:ai-projects',
            kind: 'faq',
            title: 'AI projects',
            aliases: ['ai projects', 'ai work', 'machine learning projects', 'gemini projects'],
            keywords: ['ai', 'ml', 'gemini', 'openai', 'tensorflow', 'llm', 'project'],
            body: [
                `${OWNER.firstName} has built ${aiProjects.length} AI-powered projects:`,
                '',
                ...aiProjects.map((project) => `• **${project.title}** — ${project.description}`),
            ].join('\n'),
            speak: `His AI projects are ${aiProjects.map((project) => project.title).join(', ')}.`,
            section: 'projects',
            chips: ['Tell me about MockHick', 'Does he use Gemini?', 'All his projects'],
        },
        {
            id: 'faq:open-source',
            kind: 'faq',
            title: 'Open source',
            aliases: ['open source', 'opensource', 'public code', 'contributions'],
            keywords: ['open', 'source', 'github', 'repository', 'public', 'license', 'contribute'],
            body: `Every project on this portfolio is public — all ${PROJECTS.length} have a **Source** link straight to GitHub, and **Commit Habit** is explicitly free and open-source. His profile: [github.com/HakkanShah](${OWNER.github}) (${GITHUB_STATS.publicRepos} public repos, ${GITHUB_STATS.mergedPRs} merged PRs).`,
            speak: `All of his projects are public on GitHub, and Commit Habit is explicitly free and open source. His profile has ${GITHUB_STATS.publicRepos} public repositories and ${GITHUB_STATS.mergedPRs} merged pull requests.`,
            section: 'github',
            chips: ['Tell me about Commit Habit', 'His GitHub profile', 'List all projects'],
        },
        {
            id: 'faq:github-stats',
            kind: 'faq',
            title: 'GitHub activity and stats',
            aliases: ['github stats', 'contributions', 'streak', 'commits', 'github activity'],
            keywords: ['github', 'stats', 'streak', 'contribution', 'repos', 'languages', 'activity'],
            body: [
                `📊 **GitHub at a glance**`,
                `• ${GITHUB_STATS.publicRepos} public repositories`,
                `• ${GITHUB_STATS.longestStreak} longest contribution streak`,
                `• ${GITHUB_STATS.mergedPRs} merged pull requests`,
                `• Top languages: ${GITHUB_STATS.topLanguages.join(', ')}`,
                `• Badges: ${GITHUB_STATS.achievements.join(', ')}`,
                '',
                `The contribution graph in the GitHub section updates live.`,
            ].join('\n'),
            speak: `He has ${GITHUB_STATS.publicRepos} public repositories, a ${GITHUB_STATS.longestStreak} longest streak, and ${GITHUB_STATS.mergedPRs} merged pull requests. TypeScript is his most used language.`,
            section: 'github',
            chips: ['His GitHub profile', 'Show his projects', 'His skills'],
        },
        {
            id: 'faq:easter-eggs',
            kind: 'feature',
            title: 'Hidden games and Easter eggs',
            aliases: ['easter egg', 'hidden game', 'minigames', 'games', 'secrets'],
            keywords: ['game', 'easteregg', 'hidden', 'fun', 'click', 'snake', 'pong'],
            body: `🎮 This portfolio hides a game hub — click ${OWNER.firstName}'s profile photo in the home section a few times and you'll find Snake, Pong, Flappy, Tic-Tac-Toe, Memory Match and a jigsaw puzzle. Shaking your cursor over my head gets a reaction too.`,
            speak: `There are hidden games. Click his profile photo in the home section a few times to find Snake, Pong, Flappy, Tic Tac Toe and more. Try shaking your cursor over my head as well.`,
            section: 'home',
            chips: ['What else is hidden here?', 'Show his projects', 'Download his CV'],
        },
        {
            id: 'faq:portfolio-tech',
            kind: 'feature',
            title: 'How this portfolio was built',
            aliases: ['this portfolio', 'this site', 'this website', 'how was this built', 'portfolio stack'],
            keywords: ['portfolio', 'site', 'website', 'built', 'stack', 'nextjs', 'technology'],
            body: `🛠️ This site is **Next.js 16 + React 19 + TypeScript**, styled with Tailwind CSS and shadcn/ui, animated with Framer Motion, with a Three.js bot (that's me), Firebase for the visitor counter and Resend for the contact form. Deployed on Vercel.`,
            speak: `This portfolio is built with Next.js, React and TypeScript, Tailwind CSS and shadcn UI, Framer Motion for animation, and Three.js for me, the 3D bot. It's deployed on Vercel.`,
            section: 'home',
            chips: ['His skills', 'Show his projects', 'His GitHub'],
        },
    ];
};

const sectionCards = (): KnowledgeCard[] => {
    const sections: Array<{ id: string; title: string; body: string; speak: string; aliases: string[] }> = [
        {
            id: 'home',
            title: 'Home section',
            aliases: ['home', 'hero', 'top', 'landing', 'terminal'],
            body: `🏠 The **Home** section has the terminal-style intro animation, ${OWNER.firstName}'s profile photo (with hidden games), and the **Download CV** button.`,
            speak: `The home section has a terminal intro animation, his profile photo with hidden games, and the Download CV button.`,
        },
        {
            id: 'about',
            title: 'About section',
            aliases: ['about section'],
            body: `👤 The **About** section covers who ${OWNER.firstName} is: a full-stack developer and final-year B.Tech CSE student who builds web apps and integrates AI.`,
            speak: `The about section covers who he is as a developer and student.`,
        },
        {
            id: 'experience',
            title: 'Experience section',
            aliases: ['experience section'],
            body: `💼 The **Experience** section lists his two internships — ${EXPERIENCE.map((role) => role.company).join(' and ')} — each with a detailed breakdown and the offer letter.`,
            speak: `The experience section lists his internships at ${EXPERIENCE.map((role) => role.company).join(' and ')}, with details and offer letters.`,
        },
        {
            id: 'projects',
            title: 'Projects section',
            aliases: ['projects section', 'all projects', 'project list'],
            body: `🚀 The **Projects** section showcases all ${PROJECTS.length} builds with stacks, live demos and source links.`,
            speak: `The projects section has all ${PROJECTS.length} of his builds with live demos and source links.`,
        },
        {
            id: 'github',
            title: 'GitHub section',
            aliases: ['github section', 'activity section'],
            body: `📊 The **GitHub** section shows his live contribution graph, repo count, streak, merged PRs and most-used languages.`,
            speak: `The GitHub section shows his live contribution graph and stats.`,
        },
        {
            id: 'skills',
            title: 'Skills section',
            aliases: ['skills section'],
            body: `🧰 The **Skills** section groups his stack into ${SKILLS.length} categories: ${SKILLS.map((group) => group.name).join(', ')}.`,
            speak: `The skills section groups his stack into ${SKILLS.length} categories.`,
        },
        {
            id: 'education',
            title: 'Education section',
            aliases: ['education section'],
            body: `🎓 The **Education** section lists his B.Tech CSE (${EDUCATION[0].period}, ${EDUCATION[0].details}) plus his higher secondary and secondary results.`,
            speak: `The education section lists his B.Tech and school results.`,
        },
        {
            id: 'certifications',
            title: 'Certifications section',
            aliases: ['certifications section'],
            body: `📜 The **Certifications** section holds ${CERTIFICATIONS.length} verifiable certificates, each linked to the original document.`,
            speak: `The certifications section holds ${CERTIFICATIONS.length} verifiable certificates.`,
        },
        {
            id: 'contact',
            title: 'Contact section',
            aliases: ['contact section', 'contact form'],
            body: `✉️ The **Contact** section has a working contact form plus his email, phone, GitHub, LinkedIn and Google Developer profile.`,
            speak: `The contact section has a working form plus all his contact links.`,
        },
    ];

    return sections.map((section) => ({
        id: `section:${section.id}`,
        kind: 'section' as const,
        title: section.title,
        aliases: [section.id, ...section.aliases],
        keywords: ['section', 'page', section.id, 'navigate', 'where'],
        body: section.body,
        speak: section.speak,
        section: section.id,
        chips: ['Take me there', 'Show his projects', 'His skills'],
        weight: 0.9,
    }));
};

const metaCards = (): KnowledgeCard[] => [
    {
        id: 'meta:identity',
        kind: 'meta',
        title: 'About this assistant',
        aliases: ['who are you', 'what are you', 'your name', 'about you', 'are you ai', 'are you a bot'],
        keywords: ['you', 'bot', 'assistant', 'ai', 'robot', 'yourself'],
        body: `I'm ${OWNER.firstName}'s portfolio assistant — a small on-device engine (no cloud round-trip for most answers) that knows his ${PROJECTS.length} projects, skills, internships, education, certifications and contact details. Ask me anything about his work.`,
        speak: `I'm ${OWNER.firstName}'s portfolio assistant. I run on your device and I know his projects, skills, experience, education and contact details.`,
        chips: ['What can you do?', 'Show his projects', 'Is he open to work?'],
    },
    {
        id: 'meta:capabilities',
        kind: 'meta',
        title: 'What this assistant can do',
        aliases: ['what can you do', 'help', 'capabilities', 'commands', 'how to use'],
        keywords: ['help', 'can', 'do', 'capability', 'guide', 'options'],
        body: [
            `Try things like:`,
            '',
            `• *"Tell me about Commit Habit"* — any project, in depth`,
            `• *"Does he know PostgreSQL?"* — any tech, with where he used it`,
            `• *"What did he do at UDRCRAFTS?"* — internship details`,
            `• *"What's his CGPA?"* · *"Is he open to work?"* · *"His email?"*`,
            `• *"Take me to projects"* — I'll scroll the page for you`,
            '',
            `I also answer by voice — tap the mic.`,
        ].join('\n'),
        speak: `Ask me about any project, any technology, his internships, education, certifications or contact details. I can also scroll the page for you, and I work by voice.`,
        chips: ['Show his projects', 'His tech stack', 'Is he open to work?'],
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
        ...faqCards(),
        ...sectionCards(),
        ...metaCards(),
    ];

    return cardsCache;
};

export const getCardById = (id: string): KnowledgeCard | undefined =>
    getCards().find((card) => card.id === id);
