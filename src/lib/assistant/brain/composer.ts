/**
 * Composer
 *
 * Builds the actual replies. Every answer leads with the direct answer, then
 * supporting detail, then a relevant next step — and every fact traces back to
 * `src/lib/data.ts`. Nothing here invents information.
 */

import { CERTIFICATIONS, EDUCATION, EXPERIENCE, GITHUB_STATS, PROJECTS, SKILLS } from '@/lib/data';
import {
    OWNER,
    getProjects,
    lookupSkillGroup,
    type ProjectEntry,
    type SkillGroup,
    type TechEntry,
} from './knowledge';
import { isStopWord, normalize } from './nlp';
import type { SectionId } from '../sections';
import { sanitizeActions, type AssistantAction } from '../actions';
import type { Analysis, Aspect, ContactChannel, ExperienceEntry, Superlative } from './analyzer';
import type { BrainAnswer, KnowledgeCard } from './types';

// ============ Speech ============

/** Markdown and emoji are great to read and terrible to hear. */
export const speechify = (markdown: string): string =>
    markdown
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/[*_`#>]/g, '')
        .replace(/^\s*[•\-]\s*/gm, '')
        .replace(/^\s*\d+\.\s*/gm, '')
        .replace(/\r?\n+/g, '. ')
        .replace(/https?:\/\/\S+/g, 'the link on the page')
        .replace(/([a-z0-9._%-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi, (_match, user: string, domain: string) =>
            `${user.replace(/\./g, ' dot ')} at ${domain.replace(/\./g, ' dot ')}`
        )
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}]/gu, '')
        // "…most recent first:" followed by a list reads as ":." once joined.
        .replace(/[:;,]\s*\./g, '.')
        .replace(/\.\s*\./g, '.')
        .replace(/\s{2,}/g, ' ')
        .trim();

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const answer = (
    handler: string,
    text: string,
    options: Partial<Omit<BrainAnswer, 'text' | 'handler'>> = {}
): BrainAnswer => ({
    text,
    speak: options.speak ?? speechify(text),
    confidence: options.confidence ?? 0.9,
    chips: options.chips ?? [],
    actions: sanitizeActions(options.actions),
    needsLLM: options.needsLLM ?? false,
    context: options.context ?? [],
    handler,
});

// ============ Projects ============

/** The buttons that go with a project, so "open it" is one tap or none. */
const projectActions = (project: ProjectEntry): AssistantAction[] =>
    [
        project.liveUrl ? { type: 'open_url' as const, url: project.liveUrl, label: `Open ${project.title}` } : null,
        project.repoUrl ? { type: 'open_url' as const, url: project.repoUrl, label: 'Source code' } : null,
    ].filter(Boolean) as AssistantAction[];

/** Only the links that exist — a private repo must not render as "[Source]()". */
const projectLinks = (project: ProjectEntry): string => {
    const links = [
        project.liveUrl ? `[Live](${project.liveUrl})` : null,
        project.repoUrl ? `[Source](${project.repoUrl})` : null,
    ].filter(Boolean);

    return links.length ? `🔗 ${links.join(' · ')}` : '';
};

/**
 * "Can I see the code for AURA?" — the repo link when there is one, and a
 * straight "it isn't public" when there isn't, instead of a project summary
 * that never mentions the code.
 */
export const projectSourceAnswer = (project: ProjectEntry): BrainAnswer => {
    if (project.repoUrl) {
        return answer(
            'project:source',
            `**${project.title}** is open source: [${project.repoUrl.replace(/^https?:\/\//, '')}](${project.repoUrl})`,
            {
                speak: `${project.title} is open source. I can open the repository for you.`,
                chips: [`What is ${project.title}?`, `${project.title} tech stack`, 'Any open source work?'],
                actions: [{ type: 'open_url', url: project.repoUrl, label: 'Source code' }],
            }
        );
    }

    return answer(
        'project:source-private',
        [
            `The source for **${project.title}** isn't public.`,
            project.liveUrl ? `You can still try it: [${project.title}](${project.liveUrl})` : '',
            '',
            `His personal projects are open on [GitHub](${OWNER.github}).`,
        ].filter((line, index, lines) => line || lines[index - 1]).join('\n'),
        {
            speak: `The source for ${project.title} isn't public${project.liveUrl ? ', but you can try it live' : ''}. His personal projects are open on GitHub.`,
            chips: [`What is ${project.title}?`, 'Any open source work?', 'Show another project'],
            actions: project.liveUrl ? [{ type: 'open_url', url: project.liveUrl, label: `Open ${project.title}` }] : [],
        }
    );
};

/** "Does AURA use Python?" — a yes or no about one project's stack. */
export const projectTechAnswer = (project: ProjectEntry, tech: TechEntry): BrainAnswer => {
    const uses = tech.projects.includes(project.title);

    return answer(
        'project:tech-yesno',
        [
            uses
                ? `**Yes** — **${project.title}** uses ${tech.label}.`
                : `${tech.label} isn't in **${project.title}**'s listed stack.`,
            '',
            `**Stack:** ${project.tags.join(', ')}`,
        ].join('\n'),
        {
            speak: uses
                ? `Yes, ${project.title} uses ${tech.label}.`
                : `${tech.label} isn't in ${project.title}'s listed stack. It runs on ${project.tags.slice(0, 4).join(', ')}.`,
            chips: [`What is ${project.title}?`, `Which projects use ${tech.label}?`, 'Show another project'],
            actions: projectActions(project),
        }
    );
};

export const projectAnswer = (project: ProjectEntry, aspect: Aspect): BrainAnswer => {
    const chips = [
        aspect === 'why' ? `${project.title} tech stack` : `Why did he build ${project.title}?`,
        `Link to ${project.title}`,
        'Show another project',
    ];

    if (aspect === 'why') {
        return answer('project:why', `**Why he built ${project.title}**\n\n${project.why.trim()}`, {
            chips,
            actions: projectActions(project),
        });
    }

    if (aspect === 'tech') {
        const extra = project.why ? `\n\nWhy he built it: ${project.why}` : '';
        return answer(
            'project:tech',
            `**${project.title}** runs on: ${project.tags.join(', ')}.${extra}`,
            {
                chips: [`Why did he build ${project.title}?`, `Link to ${project.title}`, 'Show another project'],
                actions: projectActions(project),
            }
        );
    }

    if (aspect === 'link') {
        return answer(
            'project:link',
            `**${project.title}**\n\n${projectLinks(project)}`,
            {
                speak: `Opening ${project.title} for you.`,
                chips: [`What is ${project.title}?`, `Why did he build ${project.title}?`, 'Show another project'],
                actions: projectActions(project),
            }
        );
    }

    if (aspect === 'features') {
        return answer(
            'project:features',
            `${project.longDescription}\n\n${projectLinks(project)}`,
            { chips, actions: projectActions(project) }
        );
    }

    return answer(
        'project:detail',
        [
            `**${project.title}** — ${project.description}`,
            '',
            project.longDescription,
            '',
            `**Stack:** ${project.tags.join(', ')}`,
            projectLinks(project),
        ].join('\n'),
        {
            speak: `${project.title}. ${project.description} ${project.longDescription.split('. ').slice(0, 2).join('. ')}. It's built with ${project.tags.slice(0, 4).join(', ')}.`,
            chips,
            actions: projectActions(project),
        }
    );
};

export const projectListAnswer = (): BrainAnswer => {
    const projects = getProjects();
    const grouped = new Map<string, ProjectEntry[]>();
    for (const project of projects) {
        const list = grouped.get(project.category) ?? [];
        list.push(project);
        grouped.set(project.category, list);
    }

    const lines: string[] = [`${OWNER.firstName} has **${projects.length} projects** on the portfolio:`, ''];
    for (const [category, items] of grouped) {
        lines.push(`**${category}**`);
        for (const project of items) lines.push(`• **${project.title}** — ${project.description}`);
        lines.push('');
    }
    lines.push(`Ask me about any one of them for the full story.`);

    return answer('projects:list', lines.join('\n').trim(), {
        speak: `He has ${projects.length} projects: ${projects.map((project) => project.title).join(', ')}. Ask me about any one of them for details.`,
        actions: [{ type: 'navigate', target: 'projects' }],
        chips: ['Tell me about Commit Habit', 'His AI projects', 'His best project'],
    });
};

// ============ Technology ============

const whereUsed = (tech: TechEntry): string[] => {
    const lines: string[] = [];
    if (tech.projects.length) lines.push(`• **Projects:** ${tech.projects.join(', ')}`);
    if (tech.roles.length) lines.push(`• **At work:** ${tech.roles.join('; ')}`);
    if (tech.groups.length) lines.push(`• **Listed under:** ${tech.groups.join(', ')}`);
    return lines;
};

export const techYesNoAnswer = (tech: TechEntry): BrainAnswer => {
    const evidence = whereUsed(tech);
    const opener = tech.listedSkill
        ? `**Yes** — ${tech.label} is part of ${OWNER.firstName}'s stack.`
        : `**Yes** — he's shipped with ${tech.label}.`;

    const spokenWhere = tech.projects.length
        ? ` He used it in ${tech.projects.slice(0, 3).join(', ')}.`
        : tech.roles.length
            ? ` He used it at work: ${tech.roles[0]}.`
            : '';

    return answer('tech:yesno', [opener, '', ...evidence].join('\n'), {
        speak: `Yes, ${tech.label} is part of his stack.${spokenWhere}`,
        chips: tech.projects.length
            ? [`Tell me about ${tech.projects[0]}`, 'His full tech stack', 'Is he open to work?']
            : ['His full tech stack', 'Show his projects', 'Is he open to work?'],
    });
};

export const techWhichAnswer = (tech: TechEntry): BrainAnswer => {
    if (!tech.projects.length) {
        const roles = tech.roles.length ? ` He did use it at work: ${tech.roles.join('; ')}.` : '';
        return answer(
            'tech:which-none',
            `${tech.label} is in his skill set, but no project on the portfolio lists it in its stack.${roles}`,
            { chips: ['His full tech stack', 'Show his projects', 'His experience'] }
        );
    }

    const projects = getProjects().filter((project) => tech.projects.includes(project.title));
    const lines = projects.map((project) => `• **${project.title}** — ${project.description}`);

    return answer(
        'tech:which',
        [`${tech.label} shows up in ${projects.length === 1 ? 'one project' : `${projects.length} projects`}:`, '', ...lines].join('\n'),
        {
            speak: `${tech.label} is used in ${projects.map((project) => project.title).join(', ')}.`,
            chips: [`Tell me about ${projects[0].title}`, 'His full tech stack', 'Show all projects'],
        }
    );
};

export const skillGroupAnswer = (group: SkillGroup, isYesNo: boolean): BrainAnswer => {
    const projectsUsing = getProjects()
        .filter((project) =>
            project.tags.some((tag) => group.names.some((name) => normalize(name) === normalize(tag)))
        )
        .slice(0, 3)
        .map((project) => project.title);

    const opener = isYesNo
        ? `**Yes.** ${group.name} is one of his core areas.`
        : `**${group.name}**`;

    const evidence = projectsUsing.length ? `\n\nYou can see it in ${projectsUsing.join(', ')}.` : '';

    return answer(
        'skills:group',
        `${opener}\n\n${group.names.join(', ')}${evidence}`,
        {
            speak: `Yes. For ${group.name.toLowerCase()} he works with ${group.names.join(', ')}.${projectsUsing.length ? ` You can see it in ${projectsUsing.join(', ')}.` : ''}`,
            actions: [{ type: 'navigate', target: 'skills' }],
            chips: projectsUsing.length
                ? [`Tell me about ${projectsUsing[0]}`, 'His full tech stack', 'Is he open to work?']
                : ['His full tech stack', 'Show his projects', 'Is he open to work?'],
        }
    );
};

/** Pull the thing being asked about out of "does he know X" style questions. */
export const extractUnknownTech = (analysis: Analysis): string | null => {
    const match = analysis.tokens.normalized.match(
        /(?:know|knows|use|uses|used|using|worked\s+with|work\s+with|familiar\s+with|experience\s+(?:in|with)|good\s+at|proficient\s+in|build|builds|make|develop|handle|done|do)\s+(.+)$/
    );
    if (!match) return null;

    const candidate = match[1]
        .split(' ')
        .filter((word) => !isStopWord(word) && !/^(?:anything|stuff|things?|work|dev|development|coding|programming)$/.test(word))
        .join(' ')
        .trim();

    if (candidate.length < 2 || candidate.split(' ').length > 3) return null;
    // Don't call a known skill group "unknown".
    if (lookupSkillGroup(candidate)) return null;
    // Generic words aren't technologies — let retrieval handle those.
    if (/^(?:website|web\s?site|web\s?app|app|apps|application|software|project|projects|code|game|games|thing|things|site|ui|design)$/.test(candidate)) {
        return null;
    }
    return candidate;
};

export const unknownTechAnswer = (term: string): BrainAnswer => {
    const stack = SKILLS.map((group) => `**${group.name}:** ${group.skills.map((skill) => skill.name).join(', ')}`);

    return answer(
        'tech:unknown',
        [
            `**${term}** isn't listed anywhere on his portfolio, so I can't claim it either way.`,
            '',
            `Here's what he *does* work with:`,
            '',
            ...stack,
            '',
            `For anything outside this list, ask him directly: 📧 [${OWNER.email}](mailto:${OWNER.email})`,
        ].join('\n'),
        {
            speak: `${term} isn't listed on his portfolio, so I won't claim it. His stack is React, Next.js and TypeScript on the front end, Node, Express and Flask on the back end, MongoDB, PostgreSQL and Supabase for data, plus Java, C and Python. For anything else, email him directly.`,
            confidence: 0.8,
            chips: ['His full tech stack', 'Show his projects', 'His email'],
        }
    );
};

// ============ Roles ============

/**
 * His experience used to be all internships, and the wording said so
 * everywhere. It now includes a full-time job, so the label is counted from
 * the role titles instead of assumed.
 */
const isInternship = (role: { role: string }): boolean => /\bintern(?:ship)?\b/i.test(role.role);

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export const roleCountLabel = (): string => {
    const internships = EXPERIENCE.filter(isInternship).length;
    const fullTime = EXPERIENCE.length - internships;
    if (!internships) return plural(EXPERIENCE.length, 'role');
    if (!fullTime) return plural(internships, 'internship');
    return `${plural(EXPERIENCE.length, 'role')} (${fullTime} full-time, ${plural(internships, 'internship')})`;
};

/** A company name short enough to say: "UDRCRAFTS", not "UDRCRAFTS INDIA PVT. LTD." */
const shortCompany = (company: string): string => company.split(/\s+(?:india|pvt|private|ltd|inc|llc)\b/i)[0].trim();

const roleChips = (): string[] => EXPERIENCE.slice(0, 2).map((role) => `What did he do at ${shortCompany(role.company)}?`);

// ============ Counts ============

export const countAnswer = (topic: Analysis['countTopic']): BrainAnswer => {
    switch (topic) {
        case 'projects': {
            const projects = getProjects();
            const categories = new Map<string, number>();
            for (const project of projects) {
                categories.set(project.category, (categories.get(project.category) ?? 0) + 1);
            }
            const breakdown = Array.from(categories)
                .map(([category, count]) => `${count} ${category.toLowerCase()}`)
                .join(', ');

            return answer(
                'count:projects',
                `**${projects.length} projects** on the portfolio — ${breakdown}. Newest is **${projects[0].title}**.`,
                { chips: ['List all projects', `Tell me about ${projects[0].title}`, 'His AI projects'] }
            );
        }
        case 'repos':
            return answer(
                'count:repos',
                `**${GITHUB_STATS.publicRepos} public repositories** on GitHub, with ${GITHUB_STATS.totalPRs} merged pull requests and a ${GITHUB_STATS.longestStreak.days}-day longest streak. ${PROJECTS.length} of them are featured here as projects.`,
                { chips: ['His GitHub profile', 'List all projects', 'His GitHub stats'] }
            );
        case 'certifications':
            return answer(
                'count:certifications',
                `**${CERTIFICATIONS.length} certifications** — ${CERTIFICATIONS.map((cert) => cert.name).join(', ')}.`,
                { chips: ['His education', 'His skills', 'Show his projects'] }
            );
        case 'experience':
            return answer(
                'count:experience',
                `**${roleCountLabel()}** — ${EXPERIENCE.map((role) => `${role.role} at ${shortCompany(role.company)} (${role.period.toLowerCase()})`).join(', ')}.`,
                { chips: [...roleChips(), 'Is he open to work?'] }
            );
        case 'prs':
            return answer(
                'count:prs',
                `**${GITHUB_STATS.totalPRs} merged pull requests** across ${GITHUB_STATS.publicRepos} public repositories, with a ${GITHUB_STATS.longestStreak.days}-day longest streak (${GITHUB_STATS.longestStreak.period}).`,
                {
                    actions: [{ type: 'navigate', target: 'github' }],
                    chips: ['His GitHub profile', 'Any open source work?', 'List all projects'],
                }
            );
        case 'skills': {
            const total = SKILLS.reduce((sum, group) => sum + group.skills.length, 0);
            return answer(
                'count:skills',
                `**${total} skills** across ${SKILLS.length} categories: ${SKILLS.map((group) => group.name).join(', ')}.`,
                { chips: ['His full tech stack', 'His strongest skills', 'Show his projects'] }
            );
        }
        default:
            return answer(
                'count:general',
                `Quick numbers: **${PROJECTS.length} projects**, **${roleCountLabel()}**, **${CERTIFICATIONS.length} certifications**, and **${GITHUB_STATS.publicRepos} public GitHub repos**.`,
                { chips: ['List all projects', 'His experience', 'His certifications'] }
            );
    }
};

// ============ Superlatives ============

export const superlativeAnswer = (kind: Superlative, analysis: Analysis): BrainAnswer => {
    const projects = getProjects();
    const aboutSkills = /\bskill|tech|language|framework|stack|strength|strong|good\b/.test(
        analysis.tokens.normalized
    );

    if (aboutSkills) {
        return answer(
            'superlative:skills',
            [
                `His strongest areas, judging by what he actually ships:`,
                '',
                `• **Next.js + React + TypeScript** — the backbone of most of his ${projects.length} projects`,
                `• **AI integration** — Gemini powers MockHick, VerifyAI, BuildMyCV and AluChat`,
                `• **Full-stack delivery** — Node/Express APIs with MongoDB, PostgreSQL/Prisma or Supabase`,
                `• **UI craft** — Tailwind CSS, shadcn/ui and Framer Motion`,
                '',
                `TypeScript is also his most-used language on GitHub.`,
            ].join('\n'),
            {
                confidence: 0.85,
                chips: ['His full tech stack', 'His best project', 'Is he open to work?'],
            }
        );
    }

    switch (kind) {
        case 'latest': {
            const latest = projects[0];
            return answer(
                'superlative:latest',
                `His most recent build is **${latest.title}** — ${latest.description}\n\n**Stack:** ${latest.tags.join(', ')}\n${projectLinks(latest)}`,
                { chips: [`Why did he build ${latest.title}?`, 'List all projects', 'His best project'] }
            );
        }
        case 'first': {
            const earliest = projects[projects.length - 1];
            return answer(
                'superlative:first',
                `The oldest project listed is **${earliest.title}** — ${earliest.description}\n${projectLinks(earliest)}`,
                { chips: ['His latest project', 'List all projects', 'His best project'] }
            );
        }
        case 'hardest':
            return answer(
                'superlative:hardest',
                [
                    `Two stand out on difficulty:`,
                    '',
                    `• **Rubik's Cube Solver** — a CFOP solving algorithm plus a hand-rolled Three.js 3D cube with animation and a step-by-step tutor.`,
                    `• **Commit Habit** — GitHub App OAuth, JWT auth, Prisma/PostgreSQL and scheduled cron jobs, built so it never needs a Personal Access Token.`,
                ].join('\n'),
                {
                    confidence: 0.82,
                    chips: ["Tell me about Rubik's Cube Solver", 'Tell me about Commit Habit', 'List all projects'],
                }
            );
        case 'best':
        case 'biggest':
        default: {
            // data.ts is ordered newest and most prominent first, so the
            // headline project follows that rather than a name hardcoded here
            // — which is how this answer went stale and kept recommending an
            // old project after the portfolio moved on.
            const [flagship, ...rest] = projects;
            const alsoWorthIt = rest.slice(0, 2);

            return answer(
                'superlative:best',
                [
                    `**${flagship.title}** is the one to look at first — ${flagship.description}`,
                    '',
                    flagship.longDescription,
                    '',
                    projectLinks(flagship),
                    alsoWorthIt.length
                        ? `\nAlso worth your time: ${alsoWorthIt.map((project) => `**${project.title}** (${project.category.toLowerCase()})`).join(' and ')}.`
                        : '',
                ].filter(Boolean).join('\n'),
                {
                    confidence: 0.85,
                    chips: [
                        `Why did he build ${flagship.title}?`,
                        alsoWorthIt[0] ? `Tell me about ${alsoWorthIt[0].title}` : 'List all projects',
                        'List all projects',
                    ],
                    actions: projectActions(flagship),
                }
            );
        }
    }
};

// ============ Experience ============

export const experienceAnswer = (role: ExperienceEntry, aspect: Aspect): BrainAnswer => {
    if (aspect === 'tech') {
        return answer(
            'experience:tech',
            `At **${role.company}** he worked with: ${role.details.technologies.join(', ')}.`,
            { chips: ['What did he build there?', 'His other roles', 'His full tech stack'] }
        );
    }

    return answer(
        'experience:detail',
        [
            `**${role.role}** at **${role.company}** — ${role.period}`,
            '',
            role.details.overview,
            '',
            '**Key work:**',
            ...role.details.responsibilities.slice(0, 5).map((item) => `• ${item}`),
            '',
            `**Stack:** ${role.details.technologies.join(', ')}`,
        ].join('\n'),
        {
            speak: `${role.role} at ${role.company}, ${role.period}. ${role.details.overview} He worked with ${role.details.technologies.slice(0, 4).join(', ')}.`,
            actions: [{ type: 'navigate', target: 'experience' }],
            chips: ['His other roles', 'What tech did he use there?', 'Is he open to work?'],
        }
    );
};

// ============ Contact ============

const CHANNEL_TEXT: Record<Exclude<ContactChannel, null>, { text: string; speak: string }> = {
    email: {
        text: `📧 **${OWNER.email}** — [send a mail](mailto:${OWNER.email}). Best route for roles, freelance work or collaboration.`,
        speak: `His email is ${OWNER.email.replace('@', ' at ').replace(/\./g, ' dot ')}.`,
    },
    phone: {
        // The number is on the page for humans; a bot that reads it out loud
        // is a scraper's best friend. Point at email instead.
        text: `His number is on the page itself, in the Contact section — I don't read it out. 📧 **${OWNER.email}** reaches him just as fast.`,
        speak: `His number is in the contact section of the page — I don't read it out. Email reaches him just as fast.`,
    },
    github: {
        text: `💻 **GitHub:** [HakkanShah](${OWNER.github}) — ${GITHUB_STATS.publicRepos} public repos, ${GITHUB_STATS.totalPRs} merged PRs, ${GITHUB_STATS.longestStreak.days}-day longest streak.`,
        speak: `His GitHub is github dot com slash HakkanShah, with ${GITHUB_STATS.publicRepos} public repositories.`,
    },
    linkedin: {
        text: `💼 **LinkedIn:** [${OWNER.linkedin.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}](${OWNER.linkedin})`,
        speak: `His LinkedIn is linkedin dot com slash in slash hakkan.`,
    },
    googleDev: {
        text: `🌐 **Google Developer profile:** [g.dev/hakkan](${OWNER.googleDev})`,
        speak: `His Google Developer profile is g dot dev slash hakkan.`,
    },
};

const CHANNEL_ACTION: Record<Exclude<ContactChannel, null>, AssistantAction | null> = {
    email: { type: 'open_url', url: OWNER.emailHref, label: 'Write an email' },
    phone: { type: 'navigate', target: 'contact', label: 'Go to contact' },
    github: { type: 'open_url', url: OWNER.github, label: 'Open GitHub' },
    linkedin: { type: 'open_url', url: OWNER.linkedin, label: 'Open LinkedIn' },
    googleDev: { type: 'open_url', url: OWNER.googleDev, label: 'Open profile' },
};

export const contactAnswer = (channel: Exclude<ContactChannel, null>): BrainAnswer => {
    const entry = CHANNEL_TEXT[channel];
    const channelAction = CHANNEL_ACTION[channel];
    return answer('contact:channel', entry.text, {
        speak: entry.speak,
        // Open the channel itself, and offer the section as a second step.
        actions: [
            ...(channelAction ? [channelAction] : []),
            { type: 'navigate' as const, target: channel === 'github' ? ('github' as const) : ('contact' as const) },
        ],
        chips: ['All his contact details', 'Is he open to work?', 'Download his CV'],
    });
};

// ============ Navigation ============

const SECTION_LABELS: Record<string, string> = {
    home: 'Home',
    about: 'About',
    experience: 'Experience',
    projects: 'Projects',
    github: 'GitHub Activity',
    skills: 'Skills',
    education: 'Education',
    certifications: 'Certifications',
    contact: 'Contact',
};

export const navigateAnswer = (section: SectionId): BrainAnswer => {
    const label = SECTION_LABELS[section] ?? section;
    return answer('navigate', `Scrolling to **${label}** now. 👇`, {
        speak: `Taking you to the ${label} section.`,
        actions: [{ type: 'navigate', target: section }],
        chips: ['What else is here?', 'Show his projects', 'Contact him'],
    });
};

// ============ Listings ============

export const listingAnswer = (topic: Analysis['listingTopic']): BrainAnswer => {
    switch (topic) {
        case 'projects':
            return projectListAnswer();
        case 'skills':
            return answer(
                'listing:skills',
                [
                    `${OWNER.firstName}'s stack, by category:`,
                    '',
                    ...SKILLS.map((group) => `**${group.name}:** ${group.skills.map((skill) => skill.name).join(', ')}`),
                ].join('\n'),
                {
                    speak: `His stack covers React, Next.js and TypeScript on the front end, Node, Express and Flask on the back end, MongoDB, PostgreSQL, Supabase and Redis for data, Tailwind and Framer Motion for UI, plus Java, C and Python.`,
                    actions: [{ type: 'navigate', target: 'skills' }],
                    chips: ['His strongest skills', 'Does he know Python?', 'Show his projects'],
                }
            );
        case 'certifications':
            return answer(
                'listing:certifications',
                [
                    `**${CERTIFICATIONS.length} certifications:**`,
                    '',
                    ...CERTIFICATIONS.map((cert) => `• **${cert.name}** — ${cert.issuer} · [certificate](${cert.url})`),
                ].join('\n'),
                {
                    actions: [{ type: 'navigate', target: 'certifications' }],
                    chips: ['His education', 'His skills', 'Show his projects'],
                }
            );
        case 'experience':
        default:
            return answer(
                'listing:experience',
                [
                    `${OWNER.firstName}'s experience — **${roleCountLabel()}**, most recent first:`,
                    '',
                    ...EXPERIENCE.map(
                        (role) => `• **${role.role}** at **${role.company}** (${role.period}) — ${role.description}`
                    ),
                ].join('\n'),
                {
                    actions: [{ type: 'navigate', target: 'experience' }],
                    chips: [...roleChips(), 'Is he open to work?'],
                }
            );
    }
};

// ============ Education ============

export const educationAnswer = (wantsScores: boolean): BrainAnswer => {
    const degree = EDUCATION[0];

    if (wantsScores) {
        return answer(
            'education:scores',
            [
                `📊 **Academic record**`,
                `• **B.Tech CSE** — ${degree.details}, ${degree.institution} (${degree.period})`,
                ...EDUCATION.slice(1).map((entry) => `• **${entry.degree}** — ${entry.details} (${entry.period})`),
            ].join('\n'),
            {
                speak: `His B.Tech C G P A is 7.5 out of 10. He scored 85 percent in higher secondary and 80 percent in secondary.`,
                actions: [{ type: 'navigate', target: 'education' }],
                chips: ['Where does he study?', 'When does he graduate?', 'His certifications'],
            }
        );
    }

    return answer(
        'education:detail',
        [
            `🎓 **${degree.degree}** at **${degree.institution}** — ${degree.period} (${degree.details}).`,
            '',
            ...EDUCATION.slice(1).map(
                (entry) => `• **${entry.degree}** — ${entry.institution}, ${entry.period} (${entry.details})`
            ),
        ].join('\n'),
        {
            actions: [{ type: 'navigate', target: 'education' }],
            chips: ['What is his CGPA?', 'His certifications', 'His experience'],
        }
    );
};

// ============ Small talk ============

export const greetingAnswer = (turn: number): BrainAnswer => {
    const text = turn === 0
        ? pick([
            `Hey! 👋 I'm ${OWNER.firstName}'s portfolio assistant. Ask me about his projects, stack, experience or how to reach him.`,
            `Hi there! 👋 I know ${OWNER.firstName}'s ${PROJECTS.length} projects, his stack and his experience inside out. What do you want to see?`,
        ])
        : pick([
            `Hey again! What would you like to know?`,
            `Still here. 👋 Projects, skills, experience — your pick.`,
        ]);

    return answer('smalltalk:greeting', text, {
        chips: ['Show his projects', 'His tech stack', 'Is he open to work?'],
    });
};

export const farewellAnswer = (): BrainAnswer =>
    answer(
        'smalltalk:farewell',
        pick([
            `Thanks for stopping by! If you want to reach ${OWNER.firstName}: 📧 [${OWNER.email}](mailto:${OWNER.email}). 👋`,
            `See you around! His inbox is open: 📧 [${OWNER.email}](mailto:${OWNER.email}).`,
        ]),
        { chips: ['Download his CV', 'His LinkedIn', 'Show his projects'] }
    );

export const gratitudeAnswer = (): BrainAnswer =>
    answer(
        'smalltalk:gratitude',
        pick([
            `Anytime! Anything else about ${OWNER.firstName}'s work?`,
            `Happy to help! Want to see his projects or get his contact details?`,
        ]),
        { chips: ['Show his projects', 'Contact him', 'Download his CV'] }
    );

// ============ Overview / fun facts / personal details ============

export const overviewAnswer = (): BrainAnswer => {
    const projects = getProjects();

    return answer(
        'overview',
        [
            `**${OWNER.fullName}** in short:`,
            '',
            `• **Who** — ${OWNER.headline}, based in ${OWNER.location}`,
            `• **Now** — ${EXPERIENCE[0].role} at ${EXPERIENCE[0].company}`,
            `• **Built** — ${projects.length} public projects, from AI web apps (MockHick, VerifyAI) to a .NET Windows utility (Throughput)`,
            `• **Stack** — Next.js, React, TypeScript, Node/Express, PostgreSQL & MongoDB, Tailwind, plus Gemini AI integrations`,
            `• **Study** — ${EDUCATION[0].degree}, ${EDUCATION[0].period} (${EDUCATION[0].details})`,
            `• **Reach** — 📧 [${OWNER.email}](mailto:${OWNER.email})`,
        ].join('\n'),
        {
            speak: `${OWNER.fullName} is a ${OWNER.headline} from Kolkata. He's currently a ${EXPERIENCE[0].role} at ${EXPERIENCE[0].company}, has shipped ${projects.length} public projects, and works mainly with Next.js, React, TypeScript and Node, plus Gemini AI. He finishes his B.Tech in 2026.`,
            chips: ['Show his projects', 'His experience', 'Is he open to work?'],
        }
    );
};

export const funFactAnswer = (): BrainAnswer => {
    const withFacts = getProjects().filter((project) => project.why.length > 40);
    const project = withFacts.length ? pick(withFacts) : null;

    const facts = [
        project ? `**${project.title}:** ${project.why}` : null,
        `This portfolio hides a game hub — click his profile photo in the home section a few times.`,
        `His longest GitHub streak ran ${GITHUB_STATS.longestStreak.days} days, across ${GITHUB_STATS.publicRepos} public repos.`,
        `**MockHick** is named after the Hindi word "Maukhik" (मौखिक), meaning *spoken*.`,
    ].filter(Boolean) as string[];

    const text = `Here's one 👀\n\n${pick(facts)}`;

    return answer('funfact', text, {
        chips: ['Show his projects', 'His GitHub stats', 'Tell me another'],
    });
};

/** Something a visitor asked that the portfolio simply does not state. */
export const notOnPortfolioAnswer = (topic: string, pointer: string): BrainAnswer =>
    answer(
        'unlisted',
        `${topic} isn't listed on his portfolio, so I won't guess. ${pointer}`,
        {
            confidence: 0.8,
            chips: ['His education', 'Is he open to work?', 'His email'],
        }
    );

// ============ Card fallback ============

/** Where he works right now, with the earlier roles as a one-line trail. */
export const currentRoleAnswer = (): BrainAnswer => {
    const [current, ...earlier] = EXPERIENCE;
    const actions: AssistantAction[] = [{ type: 'navigate', target: 'experience' }];

    return answer(
        'experience:current',
        [
            `He's a **${current.role}** at **${current.company}** right now.`,
            '',
            current.description,
            earlier.length
                ? `\nBefore that: ${earlier.map((role) => `${role.role} at ${shortCompany(role.company)}`).join(', and ')}.`
                : '',
        ].filter(Boolean).join('\n'),
        {
            speak: `He's a ${current.role} at ${current.company} right now. ${current.description}`,
            confidence: 0.92,
            actions,
            chips: [`What did he do at ${shortCompany(current.company)}?`, 'His achievements', 'Is he open to work?'],
        }
    );
};

export const cardAnswer = (card: KnowledgeCard, confidence: number): BrainAnswer =>
    answer(`card:${card.id}`, card.body, {
        speak: card.speak ?? speechify(card.body),
        confidence,
        chips: card.chips ?? ['Show his projects', 'His tech stack', 'Contact him'],
        actions: card.actions,
    });

// ============ Easter egg ============

/**
 * "Who's the khatarnaak developer?" — the friends' joke, answered in kind.
 * The reply itself stays clean: it is spoken aloud in voice mode.
 */
export const legendAnswer = (): BrainAnswer =>
    answer(
        'easter-egg:legend',
        [
            `That's **${OWNER.fullName}**, obviously. 😎`,
            '',
            `Self-declared best developer in Kolkata, West Bengal and India — khatarnaak, bhaukaal, fatafati, the works. Certified by his friends, reviewed by nobody.`,
            '',
            `[See all his titles](/legend)`,
        ].join('\n'),
        {
            speak: `That's ${OWNER.firstName} Shah, obviously. Self-declared best developer in Kolkata, West Bengal and India. Certified by his friends, reviewed by nobody.`,
            confidence: 0.95,
            actions: [{ type: 'open_url', url: '/legend', label: 'See all his titles' }],
            chips: ['Show his projects', 'His best project', 'Is he open to work?'],
        }
    );

// ============ Graceful fallback ============

export const unsureAnswer = (candidates: KnowledgeCard[], context: string[]): BrainAnswer => {
    const suggestions = candidates.slice(0, 3).map((card) => `• ${card.title}`);

    const text = [
        `I'm not certain I've got that one — I'm built specifically around ${OWNER.firstName}'s portfolio.`,
        '',
        suggestions.length ? `Closest things I know:\n${suggestions.join('\n')}` : '',
        '',
        `I can cover his **${PROJECTS.length} projects**, his **stack**, his **experience**, **education**, **certifications** and **contact details** — or scroll you to any section.`,
    ]
        .filter(Boolean)
        .join('\n');

    return answer('fallback:unsure', text, {
        speak: `I'm not sure about that one. I'm built around ${OWNER.firstName}'s portfolio, so ask me about his projects, his stack, his experience, education, certifications or contact details.`,
        confidence: 0.3,
        needsLLM: true,
        context,
        chips: ['Show his projects', 'His tech stack', 'Is he open to work?'],
    });
};

export { answer as buildAnswer };
