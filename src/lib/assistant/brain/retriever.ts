/**
 * Retriever
 *
 * BM25 ranking over the knowledge cards with field boosts, synonym expansion
 * and typo tolerance. The index is built once, lazily, and reused for the rest
 * of the session — a query costs well under a millisecond.
 */

import { getCards } from './knowledge';
import { analyzeTokens, indexTerms, nearestTerm } from './nlp';
import type { KnowledgeCard, ScoredCard } from './types';

// BM25 parameters. b is a little low because our "documents" vary a lot in length.
const K1 = 1.4;
const B = 0.65;

const FIELD_BOOST = {
    title: 4,
    alias: 4,
    keyword: 2,
    body: 1,
};

interface Posting {
    cardIndex: number;
    weight: number;
}

interface Index {
    cards: KnowledgeCard[];
    postings: Map<string, Posting[]>;
    docWeight: number[];
    averageWeight: number;
    vocabulary: Set<string>;
}

let indexCache: Index | null = null;

const addTerms = (
    bucket: Map<string, number>,
    text: string,
    boost: number,
    phraseToo = false
): void => {
    for (const term of indexTerms(text)) {
        bucket.set(term, (bucket.get(term) ?? 0) + boost);
    }
    if (phraseToo) {
        const phrase = text.toLowerCase().trim();
        if (phrase.includes(' ')) {
            bucket.set(phrase, (bucket.get(phrase) ?? 0) + boost * 1.5);
        }
    }
};

export const buildIndex = (): Index => {
    if (indexCache) return indexCache;

    const cards = getCards();
    const postings = new Map<string, Posting[]>();
    const docWeight: number[] = [];
    const vocabulary = new Set<string>();

    cards.forEach((card, cardIndex) => {
        const bucket = new Map<string, number>();

        addTerms(bucket, card.title, FIELD_BOOST.title, true);
        for (const alias of card.aliases) addTerms(bucket, alias, FIELD_BOOST.alias, true);
        for (const keyword of card.keywords) addTerms(bucket, keyword, FIELD_BOOST.keyword, true);
        if (!card.noBodyIndex) addTerms(bucket, card.body, FIELD_BOOST.body);

        let total = 0;
        for (const [term, weight] of bucket) {
            total += weight;
            vocabulary.add(term);
            const list = postings.get(term);
            if (list) list.push({ cardIndex, weight });
            else postings.set(term, [{ cardIndex, weight }]);
        }
        docWeight.push(total);
    });

    const averageWeight = docWeight.reduce((sum, weight) => sum + weight, 0) / (docWeight.length || 1);

    indexCache = { cards, postings, docWeight, averageWeight, vocabulary };
    return indexCache;
};

/** Warm the index ahead of the first question (called when the chat opens). */
export const warmIndex = (): void => {
    buildIndex();
};

export interface SearchOptions {
    limit?: number;
    /** Restrict results to these card kinds. */
    kinds?: KnowledgeCard['kind'][];
}

export const search = (query: string, options: SearchOptions = {}): ScoredCard[] => {
    const { limit = 5, kinds } = options;
    const index = buildIndex();
    const { terms } = analyzeTokens(query);
    if (!terms.length) return [];

    const totalDocs = index.cards.length;
    const scores = new Map<number, number>();
    const matches = new Map<number, Set<string>>();

    const scoreTerm = (term: string, termBoost: number): void => {
        const postings = index.postings.get(term);
        if (!postings) return;

        // Rare terms carry more signal than common ones.
        const idf = Math.log(1 + (totalDocs - postings.length + 0.5) / (postings.length + 0.5));
        if (idf <= 0) return;

        // Multi-word terms are strong evidence, reward them.
        const phraseBoost = term.includes(' ') ? 2.2 : 1;

        for (const { cardIndex, weight } of postings) {
            const length = index.docWeight[cardIndex] || 1;
            const normalized =
                (weight * (K1 + 1)) / (weight + K1 * (1 - B + B * (length / index.averageWeight)));
            const contribution = idf * normalized * termBoost * phraseBoost;

            scores.set(cardIndex, (scores.get(cardIndex) ?? 0) + contribution);
            const matched = matches.get(cardIndex) ?? new Set<string>();
            matched.add(term);
            matches.set(cardIndex, matched);
        }
    };

    for (const term of terms) {
        if (index.postings.has(term)) {
            scoreTerm(term, 1);
            continue;
        }
        // Unknown term: try to recover from a typo before giving up on it.
        const nearest = nearestTerm(term, index.vocabulary, 0.86);
        if (nearest) scoreTerm(nearest.term, nearest.score * 0.85);
    }

    const results: ScoredCard[] = [];
    for (const [cardIndex, rawScore] of scores) {
        const card = index.cards[cardIndex];
        if (kinds && !kinds.includes(card.kind)) continue;
        results.push({
            card,
            score: rawScore * (card.weight ?? 1),
            matched: Array.from(matches.get(cardIndex) ?? []),
        });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
};

/**
 * Maps a raw BM25 score plus the gap to the runner-up into a 0..1 confidence.
 * A high score that clearly beats the next card is what we trust.
 */
export const confidenceOf = (results: ScoredCard[]): number => {
    if (!results.length) return 0;

    const best = results[0].score;
    const runnerUp = results[1]?.score ?? 0;

    const absolute = best / (best + 7);
    const separation = best > 0 ? (best - runnerUp) / best : 0;

    return Math.max(0, Math.min(1, absolute * 0.75 + separation * 0.25));
};
