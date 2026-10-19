/**
 * Brain types
 * Shared contracts for the on-device retrieval engine.
 */

export type CardKind =
    | 'about'
    | 'project'
    | 'skillset'
    | 'experience'
    | 'education'
    | 'certification'
    | 'contact'
    | 'section'
    | 'feature'
    | 'faq'
    | 'meta';

/**
 * A single retrievable unit of knowledge.
 * Cards are generated from `src/lib/data.ts` (facts) and the curated
 * knowledge base (prose), so the bot can never drift from the portfolio.
 */
export interface KnowledgeCard {
    id: string;
    kind: CardKind;
    /** Human readable name, also indexed with a strong boost. */
    title: string;
    /** Alternative spellings/nicknames users actually type. */
    aliases: string[];
    /** Extra terms that should match this card (tech tags, topics). */
    keywords: string[];
    /** Markdown answer shown in the chat. */
    body: string;
    /** Plain-text answer used for speech synthesis. */
    speak?: string;
    /** Section id on the page, enables "take me there" actions. */
    section?: string;
    /** Follow-up questions offered after this answer. */
    chips?: string[];
    /** Prior importance, multiplies the retrieval score. */
    weight?: number;
    /**
     * Skip the body when indexing. Used for cards whose body lists example
     * questions, which would otherwise match everything.
     */
    noBodyIndex?: boolean;
    /** Structured payload used by the composers. */
    data?: Record<string, unknown>;
}

export interface ScoredCard {
    card: KnowledgeCard;
    score: number;
    matched: string[];
}

export type AnswerSource = 'local' | 'llm' | 'cache';

export interface BrainAnswer {
    /** Markdown answer for the chat bubble. */
    text: string;
    /** Speech-optimised variant. */
    speak: string;
    /** 0..1 — how sure the engine is that this answers the question. */
    confidence: number;
    /** Suggested follow-ups rendered as chips. */
    chips: string[];
    /** Optional scroll-to action. */
    action?: { type: 'navigate'; target: string };
    /**
     * True when the local engine could not answer well and an LLM
     * fallback would help. `text` still holds a usable local reply.
     */
    needsLLM: boolean;
    /** Grounding snippets handed to the LLM fallback. */
    context: string[];
    /** Debug label for the eval harness. */
    handler: string;
}
