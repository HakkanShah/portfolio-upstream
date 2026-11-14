/**
 * Assistant engine
 *
 * The visitor always gets an answer. The on-device brain answers from the
 * portfolio's own data in about a millisecond, with no network call and no
 * rate limit; the Groq route is asked only for the questions the brain admits
 * it cannot answer, and if that call fails the brain's answer still stands.
 *
 * That ordering is deliberate: the model route is the part that can be down,
 * decommissioned or rate limited, and none of those should leave a visitor
 * talking to a bot that says nothing.
 */

import { respond, createMemory, type BrainMemory } from './brain/brain';
import { sanitizeActions, type AssistantAction } from './actions';
import { getSectionId } from './sections';
import type { AssistantResponse } from './types';

export interface AssistantReply {
    text: string;
    speak: string;
    chips: string[];
    actions: AssistantAction[];
    confidence: number;
    /** The brain could not answer; the caller may try the model. */
    needsLLM: boolean;
    /** Which handler produced this, for debugging and the eval suite. */
    handler: string;
}

export interface LocalTurn {
    reply: AssistantReply;
    memory: BrainMemory;
}

export { createMemory, type BrainMemory };

/** Answer from the device. Never throws, never waits on the network. */
export const askLocal = (input: string, memory: BrainMemory = createMemory()): LocalTurn => {
    const result = respond(input, memory);

    return {
        reply: {
            text: result.answer.text,
            speak: result.answer.speak,
            chips: result.answer.chips,
            actions: result.answer.actions,
            confidence: result.answer.confidence,
            needsLLM: result.answer.needsLLM,
            handler: result.answer.handler,
        },
        memory: result.memory,
    };
};

/**
 * Fold a model answer into the local one: the model's words, the brain's
 * actions. The brain knows which project was named and what its links are;
 * the model only ever returns a section to scroll to.
 */
export const mergeModelAnswer = (
    model: AssistantResponse,
    local: AssistantReply
): AssistantReply => {
    const modelAction = model.action?.target ? getSectionId(model.action.target) : null;

    return {
        text: model.text,
        speak: model.speakText?.trim() || model.text,
        chips: local.chips,
        actions: sanitizeActions([
            ...(modelAction ? [{ type: 'navigate' as const, target: modelAction }] : []),
            ...local.actions,
        ]),
        confidence: 0.9,
        needsLLM: false,
        handler: 'model',
    };
};

/**
 * What to say when the model was needed and could not be reached. The brain's
 * best effort still goes out — a visitor should never hit a dead end just
 * because an upstream API is having a bad day.
 */
export const degradeToLocal = (local: AssistantReply): AssistantReply => ({
    ...local,
    text: local.text,
    speak: local.speak,
    handler: `${local.handler}+offline`,
});

export default askLocal;
