/**
 * Brain
 *
 * Routes a question to a deterministic handler when the analyzer is confident,
 * and to BM25 retrieval otherwise. Runs entirely on the device: no network, no
 * API keys, no rate limits. When it genuinely cannot answer it says so and
 * flags `needsLLM`, which lets the caller optionally ask the Groq fallback.
 */

import { analyze, type Analysis } from './analyzer';
import {
    legendAnswer,
    projectTechAnswer,
    projectSourceAnswer,
    currentRoleAnswer,
    cardAnswer,
    contactAnswer,
    countAnswer,
    educationAnswer,
    experienceAnswer,
    farewellAnswer,
    gratitudeAnswer,
    greetingAnswer,
    listingAnswer,
    navigateAnswer,
    notOnPortfolioAnswer,
    overviewAnswer,
    funFactAnswer,
    projectAnswer,
    projectListAnswer,
    superlativeAnswer,
    skillGroupAnswer,
    techWhichAnswer,
    techYesNoAnswer,
    unknownTechAnswer,
    unsureAnswer,
    extractUnknownTech,
    buildAnswer,
} from './composer';
import { getCardById, getProjects, OWNER } from './knowledge';
import { confidenceOf, search, warmIndex } from './retriever';
import { getSectionId } from '../sections';
import type { Aspect } from './analyzer';
import type { BrainAnswer, KnowledgeCard } from './types';

// ============ Memory ============

export interface BrainMemory {
    turn: number;
    lastProjectSlug: string | null;
    lastAspect: Aspect;
    lastCardId: string | null;
    lastTopic: string | null;
    shownProjects: string[];
}

export const createMemory = (): BrainMemory => ({
    turn: 0,
    lastProjectSlug: null,
    lastAspect: null,
    lastCardId: null,
    lastTopic: null,
    shownProjects: [],
});

export { warmIndex };

// ============ Thresholds ============

/** Below this the engine admits it is unsure rather than guessing. */
const CONFIDENCE_FLOOR = 0.5;
const SCORE_FLOOR = 8;

// ============ Helpers ============

const CAPABILITY_ASK =
    /\b(?:know|knows|use|uses|used|using|worked\s+with|work\s+with|familiar\s+with|experience\s+(?:in|with)|good\s+at|proficient\s+in|build|builds|make|develop|handle)\b/i;

const SCORE_ASK = /\b(?:cgpa|gpa|marks|percentage|grade|grades|score|result)\b/i;
const EDUCATION_ASK =
    /\b(?:stud(?:y|ies|ied|ying)|college|university|school|degree|btech|b\.tech|graduat\w*|academics?|education|semester|cse)\b/i;

/** Questions about the owner himself, where the subject is only a pronoun. */
const ABOUT_ASK =
    /^(?:(?:so\s+)?who\s+(?:is|s)\s+(?:he|him|hakkan|this\s+guy|the\s+guy)|tell\s+me\s+about\s+(?:him|himself|hakkan|the\s+guy)|about\s+(?:him|himself|hakkan)|introduce\s+(?:him|hakkan)|his\s+(?:bio|background|story|intro|profile))\b/i;

/** "What kind of developer is he?", "What does he do?" */
const ROLE_ASK =
    /\b(?:what\s+(?:kind|sort|type)\s+of\s+(?:developer|engineer|dev|programmer)|what\s+does\s+he\s+do|what\s+is\s+he\s+(?:good\s+at|known\s+for)|what\s+is\s+his\s+(?:role|title|profession|job\s+title))\b/i;

/** "Summarise his portfolio", "give me the short version" */
const OVERVIEW_ASK =
    /\b(?:summar(?:y|ise|ize)|overview|tldr|tl;dr|in\s+short|short\s+version|elevator\s+pitch|quick\s+rundown|brief\s+me|walk\s+me\s+through\s+(?:his|the)\s+portfolio)\b/i;

/** "Tell me something interesting", "surprise me" */
const FUN_ASK =
    /\b(?:something\s+(?:interesting|cool|fun|surprising|unusual)|fun\s+fact|surprise\s+me|impress\s+me|tell\s+me\s+a\s+fact|anything\s+cool|tell\s+me\s+another)\b/i;

/** Personal details the portfolio deliberately does not publish. */
const AGE_ASK = /\b(?:how\s+old|his\s+age|date\s+of\s+birth|when\s+was\s+he\s+born|birthday)\b/i;
const SALARY_ASK = /\b(?:salary|ctc|expected\s+pay|package|notice\s+period|rate\s+per\s+hour|hourly\s+rate|charges?)\b/i;

/** "How do I reach him?" with no specific channel named. */
const CONTACT_ASK =
    /\b(?:contact|reach\s+(?:out|him)?|get\s+in\s+touch|connect\s+with|message\s+him|talk\s+to\s+him|hit\s+him\s+up|socials?)\b/i;

/** "Where does he work?", "who does he work for" — the current role. */
const EMPLOYER_ASK =
    /\b(?:where\s+(?:does|is)\s+he\s+(?:work|working|employed)|who\s+does\s+he\s+work\s+for|current\s+(?:job|role|employer|company)|where\s+is\s+he\s+now)\b/i;

/** A bare "his skills" / "tech stack" never reached the listing handler. */
const SKILLS_ASK =
    /\b(?:skills?|skillset|tech\s*stack|stack|technologies|toolset)\b/i;

/** "His achievements", "what has he won" */
const ACHIEVEMENT_ASK =
    /\b(?:achievements?|accomplishments?|awards?|highlights|what\s+(?:has|did)\s+he\s+(?:achieved?|won|win)|proudest|biggest\s+wins?)\b/i;

/** "Is he any good?", "why should I hire him", "what makes him different" */
const WHY_HIM_ASK =
    /\b(?:(?:why|should)\s+(?:should\s+)?(?:i|we|anyone|someone)\s+(?:hire|pick|choose|work\s+with)|why\s+(?:hire\s+)?him|is\s+he\s+(?:any\s+|a\s+|really\s+)?(?:good|great|talented|skilled|worth|legit|capable)|what\s+makes\s+him\s+(?:different|special|unique|stand\s+out|good)|his\s+(?:strengths?|strong\s+points?|usp)|how\s+good\s+is\s+he|what\s+sets\s+him\s+apart)\b/i;

/** "His internships", "work history", "career so far" — the whole list. */
const CAREER_ASK =
    /\b(?:internships?|experience|work\s+history|career|jobs?|employment|past\s+roles?|previous\s+(?:roles?|companies|jobs?))\b/i;

/** "AWS virtual internship" is a certificate, not a job. */
const CERTIFICATE_HINT = /\b(?:virtual|certificat\w*|certs?|course|aws)\b/i;

/** Asking for a project's code, as opposed to its live link. */
const SOURCE_ASK = /\b(?:source(?:\s+code)?|code|repo(?:sitory)?|open\s*source|github)\b/i;

const RESUME_ASK = /\b(?:resume|résumé|cv|curriculum\s+vitae)\b/i;

const GITHUB_STATS_ASK =
    /\b(?:github\s+(?:stats?|statistics|activity|numbers|streak|contributions?|graph)|(?:contribution|commit)\s+(?:streak|graph|calendar|history)|longest\s+streak|most\s+used\s+languages?)\b/i;

/**
 * The slang titles on /legend, and "best developer in Kolkata"-style
 * questions. Matched on the normalised text, so punctuation is already gone.
 */
const LEGEND_ASK =
    /\b(?:khatarn[a]{1,2}k|khotornak|gaa?n?d\s*(?:faa?d|fat(?:a|ano))|gaar\s*fat\w*|bhaukaal|bhaukal|jhakaa?s|bawaal|fatafati|jompesh|dhasu|byapok|ghyam|badass|kick\s*ass|developers?\s+ka\s+baap|ek\s+number\s+(?:developer|engineer|coder|chhele)|goat\s+(?:developer|engineer|coder)|super\s+developer|legend(?:ary)?\s+(?:developer|engineer|coder)|(?:the\s+)?best\s+(?:developer|software\s+engineer|ai\s+engineer|engineer|coder|programmer|full\s*stack\s+developer)\s+(?:in|of)\s+(?:kolkata|calcutta|west\s+bengal|bengal|india|the\s+world|the\s+universe))\b/i;

const LOCATION_ASK =
    /\b(?:where\s+(?:is|does|was)?\s*(?:he|hakkan)?\s*(?:live|lives|based|from|located|stay|stays)|location|which\s+(?:city|country)|hometown|what\s+(?:city|country)|time\s*zone|remote(?:ly)?|relocat\w*)\b/i;

const ANOTHER_ASK = /\b(?:another|other|different|next|more)\s+(?:project|app|build|one)\b|\bsomething\s+else\b/i;

/**
 * Only inherit the project from memory when the question is actually about it —
 * a pronoun, or a fragment too short to carry its own subject.
 */
const PRONOUN_REF = /\b(?:it|its)\b|\b(?:this|that|the|same)\s+(?:project|app|build|one|thing|tool)\b/;

/** Words that only name an aspect, never a subject of their own. */
const ASPECT_ONLY_TERMS = new Set([
    'tech', 'technology', 'stack', 'link', 'url', 'demo', 'live', 'repo', 'repository',
    'github', 'feature', 'features', 'why', 'reason', 'motivation', 'purpose', 'detail',
    'details', 'more', 'how', 'built', 'use',
]);

/** True when the question carries no subject of its own, only an aspect. */
const isBareAspect = (terms: string[]): boolean => {
    const content = terms.filter((term) => !term.includes(' '));
    return content.length > 0 && content.every((term) => ASPECT_ONLY_TERMS.has(term));
};

/** Cycle project aspects on repeated "tell me more". */
const nextAspect = (current: Aspect): Aspect => {
    if (current === null) return 'why';
    if (current === 'why') return 'tech';
    if (current === 'tech') return 'features';
    return 'link';
};

const topContext = (cards: KnowledgeCard[]): string[] =>
    cards.slice(0, 4).map((card) => `## ${card.title}\n${card.body}`);

/**
 * An answer from a card by id — or null when that card doesn't exist.
 *
 * These used to be `getCardById(id)!`. The non-null assertion compiled fine
 * and then threw in production for two ids the knowledge graph no longer
 * built, so "where is he based" crashed the assistant. A missing card now
 * just means the rule doesn't apply and retrieval gets its turn.
 */
const answerFromCard = (id: string, confidence: number): BrainAnswer | null => {
    const card = getCardById(id);
    return card ? cardAnswer(card, confidence) : null;
};

// ============ Main ============

export interface BrainResult {
    answer: BrainAnswer;
    memory: BrainMemory;
    analysis: Analysis;
}

export const respond = (input: string, memory: BrainMemory = createMemory()): BrainResult => {
    const analysis = analyze(input);
    const { entities, tokens } = analysis;
    const normalized = tokens.normalized;

    const next: BrainMemory = { ...memory, turn: memory.turn + 1 };
    const memoryProject = memory.lastProjectSlug
        ? getProjects().find((project) => project.slug === memory.lastProjectSlug) ?? null
        : null;

    const finish = (answer: BrainAnswer, options: { project?: string | null; aspect?: Aspect; card?: string | null; topic?: string | null } = {}): BrainResult => {
        if (options.project !== undefined) next.lastProjectSlug = options.project;
        if (options.aspect !== undefined) next.lastAspect = options.aspect;
        if (options.card !== undefined) next.lastCardId = options.card;
        if (options.topic !== undefined) next.lastTopic = options.topic;
        return { answer, memory: next, analysis };
    };

    // --- 0. Empty input ---
    if (!normalized) {
        const capabilities = answerFromCard('meta:capabilities', 0.9);
        if (capabilities) return finish(capabilities);
    }

    // --- 0b. The friends' joke: "who's the khatarnaak developer?" (see /legend) ---
    if (LEGEND_ASK.test(normalized)) {
        return finish(legendAnswer(), { topic: 'about' });
    }

    // --- 1. Questions about the assistant itself ---
    if (analysis.kind === 'identity') {
        {
            const fromCard = answerFromCard('meta:identity', 0.95);
            if (fromCard) return finish(fromCard, { card: 'meta:identity' });
        }
    }
    if (analysis.kind === 'capabilities') {
        {
            const fromCard = answerFromCard('meta:capabilities', 0.95);
            if (fromCard) return finish(fromCard, { card: 'meta:capabilities' });
        }
    }

    // --- 2. Small talk ---
    if (analysis.kind === 'greeting') return finish(greetingAnswer(memory.turn));
    if (analysis.kind === 'farewell') return finish(farewellAnswer());
    if (analysis.kind === 'gratitude') return finish(gratitudeAnswer());

    // --- 3. "show me another project" ---
    if (ANOTHER_ASK.test(normalized) && (memory.lastProjectSlug || memory.lastTopic === 'projects')) {
        const unseen = getProjects().filter((project) => !next.shownProjects.includes(project.slug));
        const pool = unseen.length ? unseen : getProjects();
        const project = pool[Math.floor(Math.random() * pool.length)];
        next.shownProjects = [...next.shownProjects, project.slug];
        return finish(projectAnswer(project, null), { project: project.slug, aspect: null, topic: 'projects' });
    }

    // --- 4. Follow-ups resolved against memory ---
    if (analysis.kind === 'followup') {
        if (memoryProject) {
            const aspect = nextAspect(memory.lastAspect);
            return finish(projectAnswer(memoryProject, aspect), { aspect, topic: 'projects' });
        }
        if (memory.lastCardId) {
            const card = getCardById(memory.lastCardId);
            if (card) {
                const results = search(`${card.title} ${card.keywords.slice(0, 4).join(' ')}`, { limit: 3 });
                const alternative = results.find((result) => result.card.id !== card.id);
                if (alternative) {
                    return finish(cardAnswer(alternative.card, 0.75), { card: alternative.card.id });
                }
            }
        }
        if (memory.lastTopic === 'projects') return finish(projectListAnswer(), { topic: 'projects' });
        {
            const fromCard = answerFromCard('meta:capabilities', 0.7);
            if (fromCard) return finish(fromCard);
        }
    }

    // --- 5. Page navigation ---
    if (analysis.kind === 'navigate' && entities.section) {
        const target = getSectionId(entities.section);
        if (target) return finish(navigateAnswer(target), { topic: target });
    }

    // --- 6. Counting ---
    if (analysis.kind === 'count') {
        return finish(countAnswer(analysis.countTopic), { topic: analysis.countTopic });
    }

    // --- 7. Technology questions ---
    if (analysis.kind === 'tech_which' && entities.tech) {
        return finish(techWhichAnswer(entities.tech), { topic: 'projects' });
    }
    if (analysis.kind === 'tech_yesno' && entities.tech) {
        return finish(techYesNoAnswer(entities.tech), { topic: 'skills' });
    }

    // --- 7b. Skill-area questions ("can he do backend?", "does he use AI tools?") ---
    if (entities.skillGroup && !entities.project && !entities.tech) {
        return finish(skillGroupAnswer(entities.skillGroup, analysis.kind === 'skill_group' && analysis.isQuestion), {
            topic: 'skills',
        });
    }

    // --- 8. A specific project was named ---
    if (entities.project) {
        next.shownProjects = Array.from(new Set([...next.shownProjects, entities.project.slug]));
        if (entities.tech && /^(?:does|do|is|was|did|has)\b/.test(normalized)) {
            return finish(projectTechAnswer(entities.project, entities.tech), {
                project: entities.project.slug,
                aspect: 'tech',
                topic: 'projects',
            });
        }
        if (SOURCE_ASK.test(normalized)) {
            return finish(projectSourceAnswer(entities.project), {
                project: entities.project.slug,
                aspect: 'link',
                topic: 'projects',
            });
        }
        return finish(projectAnswer(entities.project, analysis.aspect), {
            project: entities.project.slug,
            aspect: analysis.aspect,
            topic: 'projects',
        });
    }

    // --- 9. Pronoun follow-up about the project in memory ("its stack", "why it exists") ---
    if (
        memoryProject &&
        analysis.aspect &&
        !entities.company &&
        !entities.tech &&
        !entities.skillGroup &&
        !analysis.superlative &&
        (PRONOUN_REF.test(normalized) || isBareAspect(tokens.terms))
    ) {
        return finish(projectAnswer(memoryProject, analysis.aspect), {
            aspect: analysis.aspect,
            topic: 'projects',
        });
    }

    // --- 10. A specific internship was named ---
    if (entities.company) {
        return finish(experienceAnswer(entities.company, analysis.aspect), { topic: 'experience' });
    }

    // --- 10b. GitHub questions that are about the work, not the link ---
    // Both mention GitHub or code, so the contact rule below used to answer
    // them with a profile link.
    if (/\bopen\s*source\b/.test(normalized)) {
        const fromCard = answerFromCard('faq:open-source', 0.9);
        if (fromCard) return finish(fromCard, { card: 'faq:open-source', topic: 'github' });
    }
    if (GITHUB_STATS_ASK.test(normalized)) {
        const fromCard = answerFromCard('faq:github-stats', 0.9);
        if (fromCard) return finish(fromCard, { card: 'faq:github-stats', topic: 'github' });
    }

    // --- 11. Contact channels ---
    if (entities.channel && !analysis.superlative) {
        return finish(contactAnswer(entities.channel), { topic: 'contact' });
    }

    // --- 11b. A bare technology mention ("typescript?", "next.js experience") ---
    if (
        entities.tech &&
        !entities.project &&
        !entities.company &&
        !entities.skillGroup &&
        (tokens.words.length <= 4 || CAPABILITY_ASK.test(normalized))
    ) {
        return finish(techYesNoAnswer(entities.tech), { topic: 'skills' });
    }

    // --- 11a. Where he works, and what he works with ---
    if (EMPLOYER_ASK.test(normalized) && !entities.project) {
        return finish(currentRoleAnswer(), { topic: 'experience' });
    }
    if (
        CAREER_ASK.test(normalized) &&
        !/\buser\s+experience\b/.test(normalized) &&
        !CERTIFICATE_HINT.test(normalized) &&
        !entities.project &&
        !entities.company &&
        !entities.tech
    ) {
        return finish(listingAnswer('experience'), { topic: 'experience' });
    }
    if (RESUME_ASK.test(normalized) && !entities.project) {
        const fromCard = answerFromCard('faq:resume', 0.92);
        if (fromCard) return finish(fromCard, { card: 'faq:resume', topic: 'contact' });
    }
    if (
        SKILLS_ASK.test(normalized) &&
        !entities.project &&
        !entities.tech &&
        !entities.skillGroup &&
        !entities.company
    ) {
        return finish(listingAnswer('skills'), { topic: 'skills' });
    }

    // --- 11b0. Achievements, and the "is he any good" family ---
    if (WHY_HIM_ASK.test(normalized) && !entities.project) {
        const fromCard = answerFromCard('faq:why-him', 0.9);
        if (fromCard) return finish(fromCard, { card: 'faq:why-him', topic: 'about' });
    }
    if (ACHIEVEMENT_ASK.test(normalized) && !entities.project && !entities.company) {
        const fromCard = answerFromCard('faq:achievements', 0.9);
        if (fromCard) return finish(fromCard, { card: 'faq:achievements', topic: 'experience' });
    }

    // --- 11b2. Overviews, fun facts and details the portfolio doesn't publish ---
    if (OVERVIEW_ASK.test(normalized) && !entities.project) {
        return finish(overviewAnswer(), { topic: 'about' });
    }
    if (FUN_ASK.test(normalized)) {
        return finish(funFactAnswer(), { topic: 'projects' });
    }
    if (AGE_ASK.test(normalized)) {
        return finish(
            notOnPortfolioAnswer(
                'His age',
                `What is listed: he's in the final year of his B.Tech CSE (${'2022 – 2026'}) at Greater Kolkata College of Engineering and Management.`
            ),
            { topic: 'education' }
        );
    }
    if (SALARY_ASK.test(normalized)) {
        return finish(
            notOnPortfolioAnswer(
                'Pay, package and notice period',
                `That's worth asking him directly — 📧 [${OWNER.email}](mailto:${OWNER.email}). He is open to full-time roles, internships and freelance work.`
            ),
            { topic: 'contact' }
        );
    }

    // --- 11c. "How do I reach him?" ---
    if (CONTACT_ASK.test(normalized) && !entities.project && !entities.company) {
        const fromCard = answerFromCard('contact:overview', 0.92);
        if (fromCard) return finish(fromCard, { card: 'contact:overview', topic: 'contact' });
    }

    // --- 11d. The owner himself ---
    if (ABOUT_ASK.test(normalized) || ROLE_ASK.test(normalized)) {
        {
            const fromCard = answerFromCard('about:summary', 0.92);
            if (fromCard) return finish(fromCard, { card: 'about:summary', topic: 'about' });
        }
    }
    if (LOCATION_ASK.test(normalized) && !entities.project) {
        {
            const fromCard = answerFromCard('about:location', 0.92);
            if (fromCard) return finish(fromCard, { card: 'about:location', topic: 'about' });
        }
    }

    // --- 12. Education ---
    if (SCORE_ASK.test(normalized)) {
        return finish(educationAnswer(true), { topic: 'education' });
    }
    if (EDUCATION_ASK.test(normalized) && !entities.tech) {
        return finish(educationAnswer(false), { topic: 'education' });
    }

    // --- 13. Superlatives ("best project", "strongest skills", "latest build") ---
    if (analysis.kind === 'superlative' || analysis.superlative) {
        return finish(superlativeAnswer(analysis.superlative, analysis), { topic: 'projects' });
    }

    // --- 14. Plain listings ---
    if (analysis.kind === 'listing' && analysis.listingTopic) {
        const answer = listingAnswer(analysis.listingTopic);
        return finish(answer, { topic: analysis.listingTopic });
    }

    // --- 15. Capability question about a tech we have never heard of ---
    if (CAPABILITY_ASK.test(normalized) && !entities.tech) {
        const unknown = extractUnknownTech(analysis);
        if (unknown) return finish(unknownTechAnswer(unknown), { topic: 'skills' });
    }

    // --- 16. Retrieval ---
    const results = search(input, { limit: 5 });
    const confidence = confidenceOf(results);

    const best = results[0];

    /**
     * The free prose has no aliases or keywords, just paragraphs, so a single
     * stray word ("won", "today") can pull one up for a question that has
     * nothing to do with the portfolio. Make it clear the bar before it wins.
     */
    const isProse = Boolean(best?.card.id.startsWith('prose:'));
    // `terms` also carries phrases; only the single words say how much was asked.
    const queryWords = tokens.terms.filter((term) => !term.includes(' '));
    // Two ways to clear it: a strong multi-word match, or a decent match that
    // accounts for at least half of what was asked ("is he self taught").
    const coversTheQuestion =
        Boolean(best) && best.score >= 6 && best.matched.length >= Math.ceil(queryWords.length / 2);
    const proseIsConvincing =
        !isProse || (best.matched.length >= 2 && best.score >= 10) || coversTheQuestion;

    if (
        results.length &&
        proseIsConvincing &&
        (confidence >= CONFIDENCE_FLOOR || results[0].score >= SCORE_FLOOR)
    ) {
        const bestCard = results[0].card;
        const answer = cardAnswer(bestCard, Math.max(confidence, 0.6));

        if (bestCard.kind === 'project' && bestCard.data?.project) {
            const project = bestCard.data.project as { slug: string };
            return finish(answer, { project: project.slug, aspect: null, topic: 'projects' });
        }
        return finish(answer, { card: bestCard.id, topic: bestCard.section ?? null });
    }

    // --- 17. Honest fallback (and a cue for the optional LLM layer) ---
    return finish(unsureAnswer(results.map((result) => result.card), topContext(results.map((result) => result.card))));
};

/**
 * Welcome message shown when the chat opens.
 */
export const welcomeAnswer = (): BrainAnswer =>
    buildAnswer(
        'welcome',
        `Hey! 👋 I'm ${OWNER.firstName}'s portfolio assistant. I know his **${getProjects().length} projects**, his stack, his experience and how to reach him — ask me anything, or tap a suggestion below.`,
        {
            // Deliberately silent: nobody expects a website to start talking at
            // them. Answers are spoken; the greeting is not.
            speak: '',
            chips: ['Show his projects', 'His tech stack', 'Is he open to work?'],
        }
    );

export default respond;
