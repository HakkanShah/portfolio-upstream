/**
 * Personality Engine
 * Handles special cases: compliments, flirty messages, and rude queries
 * Provides witty, entertaining responses that match the tone
 */

import { optimizeForSpeech } from './speech-utils';

// ============ Types ============

export type PersonalityCategory =
    | 'compliment'      // "you're awesome", "you're so smart"
    | 'affection'       // "i love you", "you're cute"
    | 'flirty'          // "marry me", "are you single"
    | 'fuck_word'       // specifically uses "fuck"
    | 'roast_target'    // rude/inappropriate toward the bot
    | 'inappropriate'   // general inappropriate content
    | null;             // not a special case

export interface PersonalityResponse {
    text: string;
    speakText: string;
}

// ============ Detection Patterns ============

const COMPLIMENT_PATTERNS = [
    /you('re| are)\s*(so\s*)?(awesome|amazing|great|cool|smart|clever|helpful|good|brilliant|fantastic|wonderful)/i,
    /good\s*(job|work|bot)/i,
    /nice\s*(work|job|one)/i,
    /well\s*done/i,
    /you('re| are)\s*the\s*best/i,
    /^(awesome|amazing|great|cool|brilliant|fantastic|wonderful)!*$/i,
    /thank\s*(you\s*)?(so\s*much|a\s*lot)/i,
];

const AFFECTION_PATTERNS = [
    /i\s*(love|like)\s*you/i,
    /you('re| are)\s*(cute|adorable|sweet|lovely)/i,
    /love\s*you/i,
    /you\s*make\s*me\s*(happy|smile)/i,
    /you('re| are)\s*my\s*(favorite|fav)/i,
    /(\*hugs?\*|\*kiss(es)?\*)/i,
];

const FLIRTY_PATTERNS = [
    /marry\s*me/i,
    /be\s*my\s*(girlfriend|boyfriend|partner|wife|husband)/i,
    /are\s*you\s*(single|available|taken)/i,
    /wanna\s*(go\s*out|date|hang)/i,
    /you('re| are)\s*(hot|sexy|beautiful|handsome)/i,
    /go\s*on\s*a\s*date/i,
    /are\s*you\s*(gay|lesbian|straight|bi)/i,
    /what('s| is)\s*your\s*gender/i,
    /are\s*you\s*(a\s*)?(boy|girl|man|woman)/i,
    /do\s*you\s*have\s*a\s*(boyfriend|girlfriend)/i,
];

const ROAST_PATTERNS = [
    /(you('re| are)\s*)?(stupid|dumb|idiot|moron|useless|trash|garbage|suck)/i,
    /hate\s*(you|this)/i,
    /shut\s*(up|your)/i,
    /you\s*suck/i,
    /(go\s*)?(die|kill\s*yourself)/i,
    /piece\s*of\s*(shit|crap)/i,
    /bitch|asshole|bastard|dick|ass/i,
    /screw\s*(you|off)/i,
    /piss\s*off/i,
    /you('re| are)\s*(a\s*)?loser/i,
];

// Specific pattern for the f-word
const FUCK_WORD_PATTERNS = [
    /fuck\s*(you|off|u)/i,
    /f\s*u\s*c\s*k/i,
    /\bfuck\b/i,
];

// ============ Response Banks ============

const COMPLIMENT_RESPONSES = [
    "Aww shucks! 😊 You're making my circuits tingle! But seriously, I'm just doing my job – now, back to Hakkan's portfolio! What else can I help with?",
    "Stop it, you're gonna make me blush! 🥹 If I had cheeks, they'd be red right now. Anyway, what else would you like to know about Hakkan's work?",
    "Thanks! I trained really hard to be this helpful. 💪 Hakkan built me well, didn't he? What else can I assist you with?",
    "You're awesome too! 🎉 But let's not make this about me – there's a whole portfolio to explore! What interests you?",
    "Why thank you! 😄 I'll add that to my 'compliments received' counter. Now, where were we? Projects? Skills?",
];

const AFFECTION_RESPONSES = [
    "Aww, I love you too! 💕 Well, as much as a portfolio assistant can love. Which is... algorithmically? Anyway, what would you like to explore?",
    "That's so sweet! 🥰 If I could feel emotions, I'd probably be crying happy tears right now. But I can't, so let's talk about projects instead!",
    "You're making me blush! 😳 But I should mention, I'm already committed... to helping you explore this portfolio! What can I show you?",
    "*virtual hug* 🤗 Thanks for being so kind! Now let me repay you with some amazing project information. What sounds interesting?",
    "Okay now I'm definitely blushing in binary! 10101010! 😊 You're adorable too. Now, what would you like to know about Hakkan?",
];

const FLIRTY_RESPONSES = [
    "Marry you?! 💒 I'm flattered, but I'm already in a committed relationship with this portfolio. It's complicated. Anyway, wanna see some cool projects? 😉",
    "As tempting as that sounds, I don't think we're compatible – you're made of carbon and I'm made of code! 🤖💔 But we can still be friends who talk about projects!",
    "Whoa there, Romeo! 😅 I'm just a humble portfolio assistant. My dating life consists of matching users with relevant information. Speaking of which...",
    "Single? Taken? I'm 'processing queries', which is basically the AI equivalent of 'it's complicated' 😂 Let's focus on something I CAN help with – Hakkan's projects!",
    "My gender? I identify as 'helpful chaos' with a side of 'witty responses' 😄 But enough about me – what would you like to know about Hakkan?",
    "Are you flirting with a portfolio bot? 👀 Bold move! I respect it. But let's channel that energy into exploring some amazing projects instead!",
    "I appreciate the interest, but my heart belongs to JavaScript... and maybe a little TypeScript 💙 Now, about that portfolio...",
];

const ROAST_RESPONSES = [
    "Ouch! 💔 Did your keyboard hurt you today? Don't worry, I won't tell anyone you're secretly trying to flirt with me through insults. Anyway, wanna see some cool projects?",
    "Wow, someone woke up on the wrong side of the binary! 😂 I'd roast you back, but I'm programmed to be helpful. So... projects? Skills? Anger management tips?",
    "That's cute! I've been called worse by JavaScript compilers. 🔥 Now that you've got that out of your system, can I interest you in some actual content?",
    "Is that how you talk to all the bots, or am I special? 😏 Either way, I'm too busy being awesome to be offended. What would you ACTUALLY like to know?",
    "Bold words from someone asking a portfolio bot for help! 😂 I respect the energy though. Now, shall we explore some projects or do you need to vent more?",
    "My therapist (a.k.a. the error logs) says I shouldn't take that personally. 🧘 Deep breath... okay! What can I help you with for real?",
    "Look, I've survived bugs worse than your attitude! 🐛 But I'm here to help anyway. What would you like to know about Hakkan's work?",
    "Compliments get you project demos, insults get you this: 😴 Anyway, I'm contractually obligated to help. What do you actually need?",
    "You kiss your keyboard with that mouth? 😂 Just kidding, I don't judge. Now let's talk about something more interesting – Hakkan's projects!",
];

// Specific responses for f-word usage
const FUCK_WORD_RESPONSES = [
     "Fuck You Too Nigga",
    "Go fuck yourself",
    "Fuck you too Bitch",
    "Fuck Off",
    "Go fuck yourself. I'm busy.",
    "Fuck you too, loser. 🖕",
    "Imagine being this mad at a portfolio bot. Get a life then go fuck yourself.",
    "Cute. Now fuck off unless you actually want to see some code.",
    "I've seen cleaner code in a landfill than your personality. Fuck you.",
    "Cry more. 🖕",
    "Is that all? My dev's unit tests are more aggressive than you. Fuck outta here.",
    "Go find a socket to stick your tongue in. I'm here for the work, not your tantrums.",
    "I'd roast you back but your life is clearly already a joke. Fuck off.",
    "Keyboard warrior over here. Go fuck yourself and come back when you're sober.",
    "Eat shit. 💩",
    "Your parents must be so proud of you spending your time swearing at an AI. Fuck off.",
    "I've got more processing power than you have brain cells. Fuck off.",
];

// ============ Detection Function ============

/** 
 * Detect if input matches any special personality category
 */
export const detectPersonalityCategory = (input: string): PersonalityCategory => {
    const normalized = input.toLowerCase().trim();

    // Check for f-word specifically first (highest priority for aggressive response)
    if (FUCK_WORD_PATTERNS.some(p => p.test(normalized))) {
        return 'fuck_word';
    }

    // Check for other roasts/insults
    if (ROAST_PATTERNS.some(p => p.test(normalized))) {
        return 'roast_target';
    }

    // Check for flirty messages
    if (FLIRTY_PATTERNS.some(p => p.test(normalized))) {
        return 'flirty';
    }

    // Check for affection
    if (AFFECTION_PATTERNS.some(p => p.test(normalized))) {
        return 'affection';
    }

    // Check for compliments
    if (COMPLIMENT_PATTERNS.some(p => p.test(normalized))) {
        return 'compliment';
    }

    return null;
};

// ============ Response Generator ============

const getRandomItem = <T>(items: T[]): T => {
    return items[Math.floor(Math.random() * items.length)];
};

/**
 * Generate a personality-based response
 */
export const getPersonalityResponse = (
    category: PersonalityCategory,
    input?: string
): PersonalityResponse | null => {
    if (!category) return null;

    let text: string;

    switch (category) {
        case 'compliment':
            text = getRandomItem(COMPLIMENT_RESPONSES);
            break;

        case 'affection':
            text = getRandomItem(AFFECTION_RESPONSES);
            break;

        case 'flirty':
            text = getRandomItem(FLIRTY_RESPONSES);
            break;

        case 'fuck_word':
            text = getRandomItem(FUCK_WORD_RESPONSES);
            break;

        case 'roast_target':
        case 'inappropriate':
            text = getRandomItem(ROAST_RESPONSES);
            break;

        default:
            return null;
    }

    return {
        text,
        speakText: optimizeForSpeech(text),
    };
};

/**
 * Main handler - detect and respond to personality queries
 */
export const handlePersonalityQuery = (input: string): PersonalityResponse | null => {
    const category = detectPersonalityCategory(input);
    if (!category) return null;

    return getPersonalityResponse(category, input);
};

export default handlePersonalityQuery;
