/**
 * NLP helpers for the on-device brain
 * Normalisation, tokenising, synonym expansion and typo tolerance.
 * Everything here is pure and allocation-light so retrieval stays sub-millisecond.
 */

// ============ Normalisation ============

/** Tech names that must survive punctuation stripping. */
const PHRASE_FOLDS: Array<[RegExp, string]> = [
    [/\bc\s*\+\s*\+/g, 'cpp'],
    [/\bc\s*#/g, 'csharp'],
    [/\.net\b/g, ' dotnet'],
    [/\bdot\s*net\b/g, 'dotnet'],
    [/\bnode\s*\.?\s*js\b/g, 'nodejs'],
    [/\bnext\s*\.?\s*js\b/g, 'nextjs'],
    [/\breact\s*\.?\s*js\b/g, 'react'],
    [/\bexpress\s*\.?\s*js\b/g, 'express'],
    [/\bthree\s*\.?\s*js\b/g, 'threejs'],
    [/\bvue\s*\.?\s*js\b/g, 'vuejs'],
    [/\bsocket\s*\.?\s*io\b/g, 'socketio'],
    [/\btail\s*wind\b/g, 'tailwind'],
    [/\bshad\s*cn\b/g, 'shadcn'],
    [/\bpost\s*gres(?:ql|s)?\b/g, 'postgresql'],
    [/\bmongo\s*db\b/g, 'mongodb'],
    [/\bmy\s*sql\b/g, 'mysql'],
    [/\bweb\s*rtc\b/g, 'webrtc'],
    [/\bmachine\s+learning\b/g, 'ml'],
    [/\bartificial\s+intelligence\b/g, 'ai'],
    [/\bfull\s*-?\s*stack\b/g, 'fullstack'],
    [/\bui\s*\/?\s*ux\b/g, 'uiux'],
];

export const normalize = (input: string): string => {
    let text = input
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '');

    for (const [pattern, replacement] of PHRASE_FOLDS) {
        text = text.replace(pattern, replacement);
    }

    return text
        .replace(/[’'`]/g, '')
        .replace(/[^a-z0-9+#.\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

// ============ Stop words ============

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'so', 'as', 'at', 'by', 'for',
    'from', 'in', 'into', 'of', 'on', 'onto', 'to', 'with', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'am', 'do', 'does', 'did', 'doing', 'have', 'has', 'had', 'having', 'can',
    'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'i', 'me', 'my', 'we',
    'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them',
    'their', 'this', 'that', 'these', 'those', 'there', 'here', 'please', 'just', 'any', 'some',
    'about', 'also', 'very', 'really', 'tell', 'know', 'get', 'got', 'give', 'want', 'like',
    'hakkan', 'parbej', 'shah',
    'who', 'what', 'whats', 'which', 'when', 'whose', 'whom', 'how',
]);

export const isStopWord = (token: string): boolean => STOP_WORDS.has(token);

// ============ Synonyms ============

/**
 * Maps what people type to the canonical terms used in the index.
 * One entry can expand to several canonical tokens.
 */
const SYNONYMS: Record<string, string[]> = {
    // languages / frameworks
    js: ['javascript'], jsx: ['react'], tsx: ['react', 'typescript'], ts: ['typescript'],
    nextjs: ['nextjs', 'next', 'react'], node: ['nodejs'], py: ['python'],
    tailwindcss: ['tailwind'], postgres: ['postgresql'], psql: ['postgresql'],
    mern: ['mongodb', 'express', 'react', 'nodejs', 'fullstack'],
    sql: ['mysql', 'postgresql', 'database'], nosql: ['mongodb', 'database'],
    db: ['database'], dbs: ['database'], databases: ['database'],
    gemini: ['gemini', 'ai'], openai: ['chatgpt', 'ai'], chatgpt: ['chatgpt', 'ai'],
    llm: ['ai'], genai: ['ai'],

    // topics
    stack: ['technology'], tech: ['technology'], technologies: ['technology'],
    techstack: ['technology'], framework: ['technology'], frameworks: ['technology'],
    tool: ['tools'], toolkit: ['tools'],
    repo: ['repository', 'github'], repos: ['repository', 'github'],
    source: ['repository'], code: ['repository'],
    demo: ['live', 'link'], url: ['link'], links: ['link'], website: ['link'],
    site: ['link'], app: ['project'], apps: ['project'], build: ['project'],
    builds: ['project'], work: ['project', 'experience'], works: ['project'],
    made: ['built'], create: ['built'], created: ['built'], develop: ['built'],
    developed: ['built'], making: ['built'],

    // education
    college: ['education', 'college'], university: ['education', 'college'],
    uni: ['education', 'college'], school: ['education'], study: ['education'],
    studied: ['education'], studies: ['education'], degree: ['education', 'btech'],
    btech: ['btech', 'education'], cse: ['education', 'cse'],
    cgpa: ['cgpa', 'education'], gpa: ['cgpa', 'education'], marks: ['cgpa', 'education'],
    grade: ['cgpa', 'education'], grades: ['cgpa', 'education'],
    percentage: ['cgpa', 'education'], graduation: ['education', 'graduate'],
    graduating: ['education', 'graduate'], semester: ['education'],
    academics: ['education'], academic: ['education'],

    // career
    job: ['availability', 'experience'], jobs: ['availability'],
    hire: ['availability'], hiring: ['availability'], hired: ['availability'],
    available: ['availability'], availability: ['availability'],
    freelance: ['availability'], freelancing: ['availability'],
    opportunity: ['availability'], opportunities: ['availability'],
    recruit: ['availability'], recruiter: ['availability'], recruiting: ['availability'],
    salary: ['availability'], ctc: ['availability'], stipend: ['availability'],
    intern: ['internship', 'experience'], interning: ['internship', 'experience'],
    internship: ['internship', 'experience'], internships: ['internship', 'experience'],
    fresher: ['availability', 'experience'], career: ['experience'],
    company: ['experience', 'company'], companies: ['experience', 'company'],
    employer: ['experience', 'company'], employment: ['experience'],
    role: ['experience', 'role'], roles: ['experience', 'role'],
    position: ['experience', 'role'], resume: ['resume'], cv: ['resume'],
    curriculum: ['resume'], vitae: ['resume'],

    // contact
    mail: ['email', 'contact'], email: ['email', 'contact'], gmail: ['email', 'contact'],
    mailid: ['email', 'contact'], contact: ['contact'], reach: ['contact'],
    connect: ['contact'], phone: ['phone', 'contact'], number: ['phone', 'contact'],
    call: ['phone', 'contact'], whatsapp: ['phone', 'contact'],
    linkedin: ['linkedin', 'contact'], socials: ['contact'], social: ['contact'],
    dm: ['contact'], message: ['contact'],

    // skills
    skill: ['skills'], skillset: ['skills'], expertise: ['skills'],
    proficient: ['skills'], strength: ['skills'], strengths: ['skills'],
    strong: ['skills'], good: ['skills'], best: ['skills'], abilities: ['skills'],
    ability: ['skills'], frontend: ['frontend'], front: ['frontend'],
    backend: ['backend'], back: ['backend'], devops: ['tools'],
    design: ['uiux'], designing: ['uiux'], ux: ['uiux'], ui: ['uiux'],
    soft: ['softskills'], softskills: ['softskills'],

    // sections / meta
    section: ['section'], page: ['section'], part: ['section'],
    cert: ['certification'], certs: ['certification'], certificate: ['certification'],
    certificates: ['certification'], certification: ['certification'],
    certifications: ['certification'], course: ['certification'],
    courses: ['certification'], training: ['certification'],
    game: ['game'], games: ['game'], easter: ['easteregg'], egg: ['easteregg'],
    bio: ['about'], intro: ['about'], introduction: ['about'],
    himself: ['about'], background: ['about'], story: ['about'],
    age: ['about'], location: ['location'], based: ['location'],
    live: ['location'], lives: ['location'], where: ['location'],
    kolkata: ['location'], india: ['location'], bengal: ['location'],
};

/** Light plural/verb stemmer — conservative on purpose. */
export const stem = (token: string): string => {
    if (token.length <= 3) return token;
    if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
    if (token.endsWith('sses')) return token.slice(0, -2);
    if (token.endsWith('es') && token.length > 4 && !/[aeiou]es$/.test(token)) return token.slice(0, -2);
    if (token.endsWith('s') && !token.endsWith('ss') && !token.endsWith('us')) return token.slice(0, -1);
    return token;
};

/**
 * Full query terms: content tokens, their stems and synonym expansions.
 * Stop words are dropped but returned separately so intent detection can use them.
 */
export interface TokenizedQuery {
    raw: string;
    normalized: string;
    words: string[];      // every word, stop words included, in order
    terms: string[];      // searchable terms (expanded, deduped)
}

export const analyzeTokens = (input: string): TokenizedQuery => {
    const normalized = normalize(input);
    const words = normalized.split(' ').filter(Boolean);
    const terms = new Set<string>();

    for (const word of words) {
        if (isStopWord(word)) continue;
        terms.add(word);

        const stemmed = stem(word);
        if (stemmed !== word) terms.add(stemmed);

        const expansions = SYNONYMS[word] ?? SYNONYMS[stemmed];
        if (expansions) expansions.forEach((expansion) => terms.add(expansion));
    }

    // The whole query as one phrase, so exact alias matches ("who are you") land
    // even when every word is a stop word.
    if (words.length > 1 && words.length <= 6) terms.add(normalized);

    // Bigrams let multi-word names ("commit habit") outrank single tokens.
    for (let i = 0; i < words.length - 1; i += 1) {
        if (isStopWord(words[i]) && isStopWord(words[i + 1])) continue;
        terms.add(`${words[i]} ${words[i + 1]}`);
    }

    return { raw: input, normalized, words, terms: Array.from(terms) };
};

/** Index-side term expansion (no bigram noise, keeps synonyms symmetrical). */
export const indexTerms = (input: string): string[] => {
    const terms = new Set<string>();
    for (const word of normalize(input).split(' ')) {
        if (!word || isStopWord(word)) continue;
        terms.add(word);
        const stemmed = stem(word);
        if (stemmed !== word) terms.add(stemmed);
        const expansions = SYNONYMS[word] ?? SYNONYMS[stemmed];
        if (expansions) expansions.forEach((expansion) => terms.add(expansion));
    }
    return Array.from(terms);
};

// ============ Typo tolerance ============

export const levenshtein = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let previous = new Array<number>(b.length + 1);
    let current = new Array<number>(b.length + 1);

    for (let j = 0; j <= b.length; j += 1) previous[j] = j;

    for (let i = 1; i <= a.length; i += 1) {
        current[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
        }
        [previous, current] = [current, previous];
    }

    return previous[b.length];
};

export const similarity = (a: string, b: string): number => {
    const longest = Math.max(a.length, b.length);
    if (longest === 0) return 1;
    return 1 - levenshtein(a, b) / longest;
};

/** Nearest vocabulary term for a possibly misspelled token. */
export const nearestTerm = (
    token: string,
    vocabulary: Iterable<string>,
    threshold = 0.82
): { term: string; score: number } | null => {
    if (token.length < 4) return null;

    let best: { term: string; score: number } | null = null;
    for (const candidate of vocabulary) {
        if (candidate.includes(' ')) continue;
        if (Math.abs(candidate.length - token.length) > 3) continue;
        const score = similarity(token, candidate);
        if (score >= threshold && (!best || score > best.score)) {
            best = { term: candidate, score };
        }
    }
    return best;
};
