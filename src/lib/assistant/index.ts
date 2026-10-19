// Assistant module exports

export { AssistantProvider, useAssistant } from './assistant-context';
export type { AssistantState, Message, Caption } from './assistant-context';

// Engine entry point
export { ask, createMemory, type AssistantReply, type AssistantTurn, type BrainMemory } from './engine';

// On-device brain
export {
    respond,
    welcomeAnswer,
    warmIndex,
    analyze,
    search,
    confidenceOf,
    speechify,
    getCards,
    getCardById,
    getProjects,
    getSkillGroups,
    getTechIndex,
    lookupTech,
    lookupSkillGroup,
    findProjectByText,
    OWNER,
    GITHUB_STATS,
    type Analysis,
    type BrainAnswer,
    type KnowledgeCard,
    type ProjectEntry,
    type TechEntry,
    type SkillGroup,
} from './brain';

// Voice
export {
    startListening,
    stopListening,
    speak,
    cancelSpeaking,
    isVoiceSupported,
    isSpeechRecognitionSupported,
    isSpeechSynthesisSupported,
} from './voice-service';

export { optimizeForSpeech } from './speech-utils';

// Curated prose used by the knowledge graph
export {
    ABOUT_KNOWLEDGE,
    PROJECTS_KNOWLEDGE,
    SKILLS_KNOWLEDGE,
    EXPERIENCE_KNOWLEDGE,
    EDUCATION_KNOWLEDGE,
    CERTIFICATIONS_KNOWLEDGE,
    CONTACT_KNOWLEDGE,
} from './knowledge-base';

// Personality + utility replies
export {
    handlePersonalityQuery,
    detectPersonalityCategory,
    type PersonalityCategory,
    type PersonalityResponse,
} from './personality-engine';
export { processUtilityQuery, type UtilityResponse } from './utility-engine';
