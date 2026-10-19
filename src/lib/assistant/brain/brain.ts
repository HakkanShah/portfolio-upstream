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
const CONFIDENCE_FLOOR = 0.42;
const SCORE_FLOOR = 6;

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

const LOCATION_ASK =
    /\b(?:where\s+(?:is|does|was)?\s*(?:he|hakkan)?\s*(?:live|lives|based|from|located|stay|stays)|location|which\s+city|hometown|what\s+city)\b/i;

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
        const card = getCardById('meta:capabilities')!;
        return finish(cardAnswer(card, 0.9));
    }

    // --- 1. Questions about the assistant itself ---
    if (analysis.kind === 'identity') {
        return finish(cardAnswer(getCardById('meta:identity')!, 0.95), { card: 'meta:identity' });
    }
    if (analysis.kind === 'capabilities') {
        return finish(cardAnswer(getCardById('meta:capabilities')!, 0.95), { card: 'meta:capabilities' });
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
        return finish(cardAnswer(getCardById('meta:capabilities')!, 0.7));
    }

    // --- 5. Page navigation ---
    if (analysis.kind === 'navigate' && entities.section) {
        return finish(navigateAnswer(entities.section), { topic: entities.section });
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

    // --- 11b1. Open source ---
    if (/\bopen\s*source\b/.test(normalized) && !entities.project) {
        return finish(cardAnswer(getCardById('faq:open-source')!, 0.9), {
            card: 'faq:open-source',
            topic: 'github',
        });
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
        return finish(cardAnswer(getCardById('contact:overview')!, 0.92), {
            card: 'contact:overview',
            topic: 'contact',
        });
    }

    // --- 11d. The owner himself ---
    if (ABOUT_ASK.test(normalized) || ROLE_ASK.test(normalized)) {
        return finish(cardAnswer(getCardById('about:summary')!, 0.92), { card: 'about:summary', topic: 'about' });
    }
    if (LOCATION_ASK.test(normalized) && !entities.project) {
        return finish(cardAnswer(getCardById('about:location')!, 0.92), { card: 'about:location', topic: 'about' });
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

    if (results.length && (confidence >= CONFIDENCE_FLOOR || results[0].score >= SCORE_FLOOR)) {
        const best = results[0].card;
        const answer = cardAnswer(best, Math.max(confidence, 0.6));

        if (best.kind === 'project' && best.data?.project) {
            const project = best.data.project as { slug: string };
            return finish(answer, { project: project.slug, aspect: null, topic: 'projects' });
        }
        return finish(answer, { card: best.id, topic: best.section ?? null });
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
        `Hey! 👋 I'm ${OWNER.firstName}'s portfolio assistant. I know his **${getProjects().length} projects**, his stack, his internships and how to reach him — ask me anything, or tap a suggestion below.`,
        {
            // Deliberately silent: nobody expects a website to start talking at
            // them. Answers are spoken; the greeting is not.
            speak: '',
            chips: ['Show his projects', 'His tech stack', 'Is he open to work?'],
        }
    );

export default respond;
