/**
 * Analyzer
 *
 * Turns raw user text into a structured read of what was asked: the kind of
 * question, the entities mentioned (project, technology, company, section,
 * contact channel) and the aspect of interest (why, stack, link, ...).
 * Deterministic handlers use this so high-value questions never depend on
 * ranking luck.
 */

import { EXPERIENCE } from '@/lib/data';
import {
    findProjectByText,
    getTechIndex,
    lookupSkillGroup,
    type ProjectEntry,
    type SkillGroup,
    type TechEntry,
} from './knowledge';
import { analyzeTokens, normalize, type TokenizedQuery } from './nlp';

export type QueryKind =
    | 'greeting'
    | 'farewell'
    | 'gratitude'
    | 'identity'
    | 'capabilities'
    | 'navigate'
    | 'count'
    | 'tech_yesno'
    | 'tech_which'
    | 'skill_group'
    | 'superlative'
    | 'listing'
    | 'followup'
    | 'detail';

export type Aspect = 'why' | 'tech' | 'link' | 'features' | 'duration' | 'summary' | null;

export type Superlative = 'latest' | 'best' | 'hardest' | 'first' | 'biggest' | null;

export type ContactChannel = 'email' | 'phone' | 'github' | 'linkedin' | 'googleDev' | null;

export type CountTopic = 'projects' | 'repos' | 'certifications' | 'experience' | 'skills' | null;

export interface ExperienceEntry {
    role: string;
    company: string;
    period: string;
    description: string;
    details: {
        overview: string;
        responsibilities: string[];
        technologies: string[];
        achievements: string[];
    };
}

export interface Analysis {
    kind: QueryKind;
    tokens: TokenizedQuery;
    isQuestion: boolean;
    aspect: Aspect;
    superlative: Superlative;
    countTopic: CountTopic;
    listingTopic: 'projects' | 'skills' | 'certifications' | 'experience' | null;
    entities: {
        project: ProjectEntry | null;
        tech: TechEntry | null;
        techTerm: string | null;
        company: ExperienceEntry | null;
        section: string | null;
        channel: ContactChannel;
        skillGroup: SkillGroup | null;
    };
}

// ============ Section ids on the page ============

const SECTION_ALIASES: Record<string, string[]> = {
    home: ['home', 'top', 'hero', 'start', 'beginning', 'landing'],
    about: ['about'],
    experience: ['experience', 'work', 'internship', 'internships', 'job', 'jobs', 'career'],
    projects: ['projects', 'project', 'portfolio', 'builds', 'work samples'],
    github: ['github', 'activity', 'contributions', 'commits'],
    skills: ['skills', 'skill', 'stack', 'tech stack', 'technologies'],
    education: ['education', 'college', 'degree', 'academics', 'studies'],
    certifications: ['certifications', 'certificates', 'certs', 'courses'],
    contact: ['contact', 'get in touch', 'reach out', 'socials'],
};

// ============ Pattern groups ============

const PATTERNS = {
    greeting: /^(?:hi|hii+|hey+|hello+|yo|sup|hola|namaste|salaam|assalam|howdy|greetings|good\s+(?:morning|afternoon|evening|day))\b/i,
    farewell: /^(?:bye|goodbye|good\s*night|cya|see\s+(?:ya|you)|later|take\s+care|catch\s+you|peace\s+out)\b/i,
    gratitude: /^(?:thanks?|thank\s+you|thx|ty|tysm|appreciate|much\s+appreciated|great\s+(?:thanks|work))\b/i,
    identity:
        /^(?:who\s+are\s+you|what\s+are\s+you|are\s+you\s+(?:a\s+)?(?:bot|robot|ai|human|real|alive|chatgpt|gpt)|whats?\s+your\s+name|introduce\s+yourself|tell\s+me\s+about\s+yourself|who\s+(?:made|built|created)\s+you|are\s+you\s+human)\b/i,
    capabilities:
        /^(?:what\s+can\s+you\s+(?:do|help)|how\s+(?:do\s+i\s+use|can\s+you\s+help)|help\s*(?:me)?$|what\s+do\s+you\s+(?:do|know)|options|commands|menu)\b/i,
    /** Unambiguous "move the page" verbs. */
    navigateExplicit: /\b(?:take\s+me|bring\s+me|scroll|jump\s+to|navigate)\b/i,
    /** Weaker verbs that only mean navigation outside a content question. */
    navigateSoft: /\b(?:go\s+to|goto|open\s+the|show\s+me\s+the)\b/i,
    /** A question about content, even when it contains a navigation-ish verb. */
    contentQuestion: /^(?:which|what|whats|who|whose|why|how|does|do|did|is|are|was|were|can|could|has|have|had)\b/i,
    count: /\bhow\s+many\b|\bnumber\s+of\b|\bcount\s+of\b/i,
    question:
        /^(?:what|who|where|when|why|how|which|whose|is|are|was|were|do|does|did|can|could|would|should|has|have|had|will|tell|show|list|give|any)\b|\?\s*$/i,
    followup:
        /^(?:tell\s+me\s+more|more|more\s+(?:details|info|please)|go\s+on|carry\s+on|continue|and\?*$|what\s+else|anything\s+else|elaborate|explain|details?|expand)\b/i,
    yesno: /^(?:does|do|did|has|have|had|is|are|was|can|could|will|would|any)\b/i,
};

const ASPECT_PATTERNS: Array<[Aspect, RegExp]> = [
    ['why', /\bwhy\b|\bmotivation\b|\breason\b|\bpurpose\b|\binspired?\b|\bidea\s+behind\b/i],
    ['tech', /\b(?:tech|technology|technologies|stack|built\s+with|made\s+with|tools?|framework|language)s?\b/i],
    ['link', /\b(?:link|url|demo|live|website|site|repo|repository|source|github\s+link|try\s+it|visit)\b/i],
    ['features', /\b(?:features?|what\s+(?:does|can)\s+it\s+do|how\s+does\s+it\s+work|capabilit)/i],
    ['duration', /\b(?:how\s+long|duration|period|when|timeline|years?|months?)\b/i],
];

const SUPERLATIVE_PATTERNS: Array<[Superlative, RegExp]> = [
    ['latest', /\b(?:latest|newest|recent|most\s+recent|last|current|new)\b/i],
    ['best', /\b(?:best|favou?rite|favorite|top|flagship|coolest|most\s+impressive|proudest|standout|showcase|strongest|recommend)\b/i],
    ['hardest', /\b(?:hardest|toughest|most\s+(?:complex|difficult|challenging|technical)|challenging|complex)\b/i],
    ['first', /\b(?:first|earliest|oldest|started\s+with)\b/i],
    ['biggest', /\b(?:biggest|largest|most\s+ambitious|main)\b/i],
];

const CHANNEL_PATTERNS: Array<[Exclude<ContactChannel, null>, RegExp]> = [
    ['email', /\b(?:e-?mail|mail\s*id|gmail|mail)\b/i],
    // "mobile" alone usually means mobile apps, not his phone number
    ['phone', /\bphone\b|\bwhatsapp\b|\bmobile\s*(?:number|no\.?)\b|\b(?:his|the)\s+number\b|\bcontact\s+number\b|\bcall\s+him\b/i],
    ['github', /\bgit\s*hub\b|\brepos?\b|\brepositor(?:y|ies)\b|\b(?:his|the)\s+code\b|\bsource\s+code\b/i],
    ['linkedin', /\blinked\s*in\b/i],
    ['googleDev', /\bg\.?dev\b|\bgoogle\s+developer\b/i],
];

// ============ Entity extraction ============

/** Candidate terms for a tech lookup, longest phrase first. */
const techCandidates = (tokens: TokenizedQuery): string[] => {
    const { words } = tokens;
    const candidates: string[] = [];

    for (let size = 3; size >= 1; size -= 1) {
        for (let i = 0; i + size <= words.length; i += 1) {
            candidates.push(words.slice(i, i + size).join(' '));
        }
    }
    return candidates;
};

const detectTech = (tokens: TokenizedQuery): { tech: TechEntry | null; term: string | null } => {
    const index = getTechIndex();

    for (const candidate of techCandidates(tokens)) {
        // Single letters are too ambiguous, except the C language in a short query.
        if (candidate.length < 2 && !(candidate === 'c' && tokens.words.length <= 5)) continue;

        const direct = index.get(candidate) ?? index.get(candidate.replace(/[\s.-]/g, ''));
        if (direct) return { tech: direct, term: candidate };
    }
    return { tech: null, term: null };
};

const detectSkillGroup = (tokens: TokenizedQuery): SkillGroup | null => {
    for (const candidate of techCandidates(tokens)) {
        const group = lookupSkillGroup(candidate);
        if (group) return group;
    }
    return null;
};

const detectCompany = (tokens: TokenizedQuery): ExperienceEntry | null => {
    const normalized = tokens.normalized;

    for (const role of EXPERIENCE as unknown as ExperienceEntry[]) {
        const company = normalize(role.company);
        const firstWord = company.split(' ')[0];
        if (firstWord.length >= 4 && normalized.includes(firstWord)) return role;
    }
    return null;
};

const detectSection = (tokens: TokenizedQuery): string | null => {
    const normalized = tokens.normalized;
    let best: { id: string; length: number } | null = null;

    for (const [id, aliases] of Object.entries(SECTION_ALIASES)) {
        for (const alias of aliases) {
            const pattern = new RegExp(`(^|\\s)${alias}(\\s|$)`);
            if (pattern.test(normalized) && (!best || alias.length > best.length)) {
                best = { id, length: alias.length };
            }
        }
    }
    return best?.id ?? null;
};

const detectChannel = (input: string): ContactChannel => {
    for (const [channel, pattern] of CHANNEL_PATTERNS) {
        if (pattern.test(input)) return channel;
    }
    return null;
};

const detectCountTopic = (normalized: string): CountTopic => {
    if (/\brepo|repositor/.test(normalized)) return 'repos';
    if (/\bproject|app|build/.test(normalized)) return 'projects';
    if (/\bcertif|course|training/.test(normalized)) return 'certifications';
    if (/\binternship|job|compan|experience|role/.test(normalized)) return 'experience';
    if (/\bskill|tech|language|framework/.test(normalized)) return 'skills';
    return null;
};

const detectListingTopic = (normalized: string): Analysis['listingTopic'] => {
    if (/\b(?:projects?|apps?|builds?|portfolio)\b/.test(normalized)) return 'projects';
    if (/\b(?:built|build|made|make|created|developed|shipped|worked\s+on)\b/.test(normalized)) return 'projects';
    if (/\b(?:skills|stack|technologies|tech)\b/.test(normalized)) return 'skills';
    if (/\b(?:certifications|certificates|certs|courses)\b/.test(normalized)) return 'certifications';
    if (/\b(?:experience|internships|jobs|work)\b/.test(normalized)) return 'experience';
    return null;
};

// ============ Main entry ============

export const analyze = (input: string): Analysis => {
    const tokens = analyzeTokens(input);
    const normalized = tokens.normalized;
    const trimmed = input.trim();

    const project = findProjectByText(normalized);
    const { tech, term: techTerm } = detectTech(tokens);
    const company = detectCompany(tokens);
    const skillGroup = detectSkillGroup(tokens);
    const section = detectSection(tokens);
    const channel = detectChannel(normalized);

    let aspect: Aspect = null;
    for (const [candidate, pattern] of ASPECT_PATTERNS) {
        if (pattern.test(normalized)) {
            aspect = candidate;
            break;
        }
    }

    let superlative: Superlative = null;
    for (const [candidate, pattern] of SUPERLATIVE_PATTERNS) {
        if (pattern.test(normalized)) {
            superlative = candidate;
            break;
        }
    }

    const isQuestion = PATTERNS.question.test(trimmed) || trimmed.endsWith('?');

    // --- kind resolution, most specific first ---
    let kind: QueryKind = 'detail';

    if (PATTERNS.identity.test(trimmed)) {
        kind = 'identity';
    } else if (PATTERNS.capabilities.test(trimmed)) {
        kind = 'capabilities';
    } else if (PATTERNS.greeting.test(trimmed) && tokens.words.length <= 4) {
        kind = 'greeting';
    } else if (PATTERNS.farewell.test(trimmed)) {
        kind = 'farewell';
    } else if (PATTERNS.gratitude.test(trimmed)) {
        kind = 'gratitude';
    } else if (PATTERNS.followup.test(trimmed) && tokens.words.length <= 4) {
        kind = 'followup';
    } else if (
        section &&
        (PATTERNS.navigateExplicit.test(normalized) ||
            (PATTERNS.navigateSoft.test(normalized) && !PATTERNS.contentQuestion.test(trimmed)))
    ) {
        kind = 'navigate';
    } else if (PATTERNS.count.test(normalized)) {
        kind = 'count';
    } else if (tech && /\bwhich|what\b/.test(normalized) && /\bproject|app|one|build\b/.test(normalized)) {
        kind = 'tech_which';
    } else if (tech && PATTERNS.yesno.test(trimmed) && !project) {
        kind = 'tech_yesno';
    } else if (skillGroup && !project && !tech) {
        kind = 'skill_group';
    } else if (superlative && !project) {
        kind = 'superlative';
    } else if (
        !project &&
        !tech &&
        detectListingTopic(normalized) &&
        /\b(?:list|show|all|what|whats|which|any|see)\b/i.test(trimmed)
    ) {
        kind = 'listing';
    }

    return {
        kind,
        tokens,
        isQuestion,
        aspect,
        superlative,
        countTopic: kind === 'count' ? detectCountTopic(normalized) : null,
        listingTopic: detectListingTopic(normalized),
        entities: { project, tech, techTerm, company, section, channel, skillGroup },
    };
};
