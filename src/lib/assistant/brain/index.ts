/**
 * On-device assistant brain — public surface.
 */

export { respond, createMemory, welcomeAnswer, warmIndex, type BrainMemory, type BrainResult } from './brain';
export { analyze, type Analysis, type QueryKind } from './analyzer';
export { search, confidenceOf } from './retriever';
export { speechify } from './composer';
export {
    OWNER,
    GITHUB_STATS,
    getCards,
    getCardById,
    getProjects,
    getSkillGroups,
    getTechIndex,
    lookupTech,
    lookupSkillGroup,
    findProjectByText,
    type ProjectEntry,
    type TechEntry,
    type SkillGroup,
} from './knowledge';
export type { BrainAnswer, KnowledgeCard, CardKind, ScoredCard } from './types';
