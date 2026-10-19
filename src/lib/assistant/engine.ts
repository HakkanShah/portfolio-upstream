/**
 * Assistant engine
 *
 * Single entry point for a user message:
 *   1. tight utility patterns (maths, time, date) answer instantly
 *   2. the on-device brain answers anything about the portfolio
 *   3. personality replies catch compliments, flirting and insults
 *   4. anything left over is admitted honestly, and flagged for the
 *      optional Groq fallback
 */

import { respond, createMemory, type BrainMemory } from './brain/brain';
import { processUtilityQuery } from './utility-engine';
import { handlePersonalityQuery } from './personality-engine';
import { optimizeForSpeech } from './speech-utils';

export interface AssistantReply {
    text: string;
    speak: string;
    chips: string[];
    action?: { type: 'navigate'; target: string };
    confidence: number;
    /** The local engine could not answer; the caller may try the LLM fallback. */
    needsLLM: boolean;
    /** Grounding snippets for that fallback. */
    context: string[];
    /** Which handler produced this, for debugging and evals. */
    handler: string;
}

export interface AssistantTurn {
    reply: AssistantReply;
    memory: BrainMemory;
}

export { createMemory, type BrainMemory };

// ============ Utility patterns ============

const MATH_SHAPE = /^[\s\d+\-*/%^().]+$/;
const MATH_PHRASE =
    /^(?:what(?:'?s| is| are)?|calculate|compute|solve|evaluate|how\s+much\s+is)\s+[\d(][\d\s+\-*/%^().]*[-+*/%^][\d\s+\-*/%^().]*\d\s*\??$/i;
const MATH_WORDS =
    /^(?:what(?:'?s| is)\s+)?\d+(?:\.\d+)?\s*(?:plus|minus|times|multiplied\s+by|divided\s+by|into|percent\s+of)\s*\d+(?:\.\d+)?\s*\??$/i;

const TIME_ASK = /^(?:what(?:'?s| is)\s+(?:the\s+)?(?:current\s+)?time|what\s+time\s+is\s+it|time\s+(?:now|please)|current\s+time)\s*\??$/i;
const DATE_ASK =
    /^(?:what(?:'?s| is)\s+(?:the\s+|today'?s?\s+)?(?:current\s+)?date|what\s+(?:day|date)\s+is\s+(?:it|today)|today'?s?\s+date|current\s+date|what\s+day\s+of\s+the\s+week)\s*\??$/i;

const isMath = (input: string): boolean => {
    const trimmed = input.trim();
    if (!trimmed) return false;
    // A bare expression needs at least one operator between two numbers.
    if (MATH_SHAPE.test(trimmed)) return /\d\s*[-+*/%^]\s*\(*\s*\d/.test(trimmed);
    return MATH_PHRASE.test(trimmed) || MATH_WORDS.test(trimmed);
};

const utilityReply = (input: string): AssistantReply | null => {
    const subtype = isMath(input)
        ? 'math'
        : TIME_ASK.test(input.trim())
            ? 'time'
            : DATE_ASK.test(input.trim())
                ? 'date'
                : null;

    if (!subtype) return null;

    const result = processUtilityQuery(input, subtype);
    return {
        text: result.text,
        speak: result.speakText ?? optimizeForSpeech(result.text),
        chips: ['Show his projects', 'His tech stack', 'Is he open to work?'],
        confidence: 0.95,
        needsLLM: false,
        context: [],
        handler: `utility:${subtype}`,
    };
};

const personalityReply = (input: string): AssistantReply | null => {
    const result = handlePersonalityQuery(input);
    if (!result) return null;

    return {
        text: result.text,
        speak: result.speakText ?? optimizeForSpeech(result.text),
        chips: ['Show his projects', 'His tech stack', 'Contact him'],
        confidence: 0.9,
        needsLLM: false,
        context: [],
        handler: 'personality',
    };
};

// ============ Entry point ============

export const ask = (input: string, memory: BrainMemory = createMemory()): AssistantTurn => {
    const utility = utilityReply(input);
    if (utility) return { reply: utility, memory: { ...memory, turn: memory.turn + 1 } };

    const brain = respond(input, memory);

    if (brain.answer.needsLLM) {
        const personality = personalityReply(input);
        if (personality) return { reply: personality, memory: brain.memory };
    }

    return {
        reply: {
            text: brain.answer.text,
            speak: brain.answer.speak,
            chips: brain.answer.chips,
            action: brain.answer.action,
            confidence: brain.answer.confidence,
            needsLLM: brain.answer.needsLLM,
            context: brain.answer.context,
            handler: brain.answer.handler,
        },
        memory: brain.memory,
    };
};

export default ask;
