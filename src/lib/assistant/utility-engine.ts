/**
 * Utility Engine
 * Handles deterministic, programmatic responses
 * No AI - just math, time, date, and identity facts
 */

import { optimizeForSpeech } from './speech-utils';

// ============ Types ============

export interface UtilityResponse {
    text: string;
    speakText: string;
}

// ============ Safe Math Evaluator ============

/**
 * Safely evaluates a mathematical expression without using eval()
 * Supports: +, -, *, /, %, ^ (power)
 */
const evaluateMathExpression = (expression: string): number | null => {
    // Clean the expression
    let cleaned = expression
        .replace(/[^\d\s+\-*/%^().]/g, '')  // Remove non-math characters
        .replace(/\s+/g, '')                 // Remove spaces
        .replace(/\^/g, '**');               // Convert ^ to ** for power

    // Validate expression format (only allow safe characters)
    if (!/^[\d+\-*/%().]+$/.test(cleaned)) {
        return null;
    }

    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of cleaned) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (parenCount < 0) return null;
    }
    if (parenCount !== 0) return null;

    try {
        // Use Function constructor for safer evaluation than eval()
        // This still has some risks but is sandboxed to math operations
        const fn = new Function(`"use strict"; return (${cleaned});`);
        const result = fn();

        // Validate result is a finite number
        if (typeof result !== 'number' || !isFinite(result)) {
            return null;
        }

        return result;
    } catch {
        return null;
    }
};

/**
 * Extracts a math expression from natural language
 */
const extractMathExpression = (input: string): string | null => {
    // Remove common prefixes
    let expression = input
        .toLowerCase()
        .replace(/^(what\s*(is|'s)|calculate|compute|solve)\s*/i, '')
        .replace(/\?+$/, '')
        .trim();

    // Handle word-based operations
    expression = expression
        .replace(/\bplus\b/g, '+')
        .replace(/\bminus\b/g, '-')
        .replace(/\btimes\b/g, '*')
        .replace(/\bmultiplied\s*by\b/g, '*')
        .replace(/\bdivided\s*by\b/g, '/')
        .replace(/\bover\b/g, '/')
        .replace(/\bmod\b/g, '%')
        .replace(/\bmodulo\b/g, '%')
        .replace(/\bto\s*the\s*power\s*of\b/g, '^')
        .replace(/\bpow(er)?\b/g, '^')
        .replace(/\bsquared\b/g, '^2')
        .replace(/\bcubed\b/g, '^3');

    // Clean up
    expression = expression.replace(/[^\d\s+\-*/%^().]/g, '').trim();

    return expression || null;
};

/**
 * Formats a math result for display
 */
const formatMathResult = (expression: string, result: number): { text: string; speakText: string } => {
    // Clean expression for display
    const displayExpr = expression
        .replace(/\*\*/g, '^')
        .replace(/\*/g, ' × ')
        .replace(/\//g, ' ÷ ')
        .replace(/\%/g, ' mod ')
        .replace(/\+/g, ' + ')
        .replace(/\-/g, ' - ')
        .replace(/\s+/g, ' ')
        .trim();

    // Format result (handle decimals nicely)
    const formattedResult = Number.isInteger(result)
        ? result.toString()
        : result.toFixed(6).replace(/\.?0+$/, '');

    const text = `🔢 **${displayExpr} = ${formattedResult}**`;
    const speakText = `${displayExpr.replace(/×/g, 'times').replace(/÷/g, 'divided by').replace(/mod/g, 'modulo')} equals ${formattedResult}`;

    return { text, speakText };
};

// ============ Time Handler ============

const handleTimeQuery = (): UtilityResponse => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');

    const timeString = `${displayHours}:${displayMinutes} ${ampm}`;

    const responses = [
        `🕐 The current time is **${timeString}**`,
        `⏰ It's **${timeString}** right now`,
        `🕐 Right now it's **${timeString}**`,
    ];

    const text = responses[Math.floor(Math.random() * responses.length)];
    const speakText = `The current time is ${displayHours}:${displayMinutes} ${ampm}`;

    return { text, speakText };
};

// ============ Date Handler ============

const handleDateQuery = (): UtilityResponse => {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const date = now.getDate();
    const year = now.getFullYear();

    const ordinal = (n: number): string => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const dateString = `${dayName}, ${monthName} ${ordinal(date)}, ${year}`;

    const responses = [
        `📅 Today is **${dateString}**`,
        `📆 It's **${dateString}**`,
        `📅 Today's date is **${dateString}**`,
    ];

    const text = responses[Math.floor(Math.random() * responses.length)];
    const speakText = `Today is ${dayName}, ${monthName} ${ordinal(date)}, ${year}`;

    return { text, speakText };
};

// ============ Identity Handler (Bot Self-Awareness) ============

const handleIdentityQuery = (input: string): UtilityResponse => {
    const normalizedInput = input.toLowerCase();

    // "Who are you?" or "Tell me about yourself"
    if (/who\s*are\s*you|tell\s*(?:me\s*)?about\s*yourself|introduce\s*yourself|describe\s*yourself/.test(normalizedInput)) {
        const responses = [
            "I'm **Hakkan's Portfolio Assistant**! 🤖 My job is to help you explore this portfolio and learn about Hakkan – his projects, skills, experience, and more. I know everything about his work, so feel free to ask me anything!\n\n💡 *Fun fact: I was built specifically for this portfolio, so while I can't tell you about the weather, I can definitely tell you about every project he's created!*",
            "Hey! I'm the **Portfolio Assistant** here to guide you through Hakkan's work! 🚀 Think of me as your personal tour guide for this portfolio. I can tell you about his projects, technical skills, work experience, education, and how to get in touch with him.\n\n*I'm not Hakkan himself – I'm his digital assistant, built to help you learn about his amazing work!*",
            "I'm **Hakkan's Portfolio Assistant**! 👋 I'm here to make it easy for you to explore everything about Hakkan – from his AI-powered projects to his full-stack development skills. Ask me anything about his portfolio!\n\n*Quick note: I'm not Hakkan, I'm his helper bot. He's the talented developer who built all these awesome projects!*",
        ];
        const text = responses[Math.floor(Math.random() * responses.length)];
        return { text, speakText: optimizeForSpeech(text) };
    }

    // "What's your name?"
    if (/your\s*name/.test(normalizedInput)) {
        const responses = [
            "You can call me **Hakkan's Portfolio Assistant**! 🤖 I'm here to help you learn about Hakkan and his work. What would you like to know?",
            "I'm the **Portfolio Assistant**! Some might call me a bot, but I prefer 'helpful digital guide'. 😄 How can I help you explore Hakkan's portfolio?",
        ];
        const text = responses[Math.floor(Math.random() * responses.length)];
        return { text, speakText: optimizeForSpeech(text) };
    }

    // "What can you do?" or "What do you do?"
    if (/what\s*(?:can|do)\s*you\s*(?:do|help)/.test(normalizedInput)) {
        const text = `Great question! Here's what I can help you with:\n\n` +
            `🚀 **Hakkan's Projects** – Detailed info on all ${9} projects he's built\n` +
            `💻 **Technical Skills** – Frontend, backend, databases, AI tools\n` +
            `💼 **Work Experience** – His internships and professional journey\n` +
            `🎓 **Education** – Academic background and degrees\n` +
            `📜 **Certifications** – Courses and credentials\n` +
            `📧 **Contact Info** – How to reach him\n\n` +
            `I can also do some quick utilities like math calculations and telling you the time! Just ask naturally.`;
        return { text, speakText: optimizeForSpeech(text) };
    }

    // "Who made/created you?"
    if (/who\s*(?:made|created|built|designed)\s*you/.test(normalizedInput)) {
        const responses = [
            "I was built specifically for **Hakkan's portfolio**! 🛠️ He created me to help visitors like you explore his work easily. Pretty meta, right? He builds cool projects, and I'm one of them!",
            "**Hakkan** built me! I'm part of his portfolio project. He designed me to be your guide through all his amazing work – from AI apps to full-stack projects.",
        ];
        const text = responses[Math.floor(Math.random() * responses.length)];
        return { text, speakText: optimizeForSpeech(text) };
    }

    // "Are you a robot/AI/bot?"
    if (/robot|bot|ai\b|machine/.test(normalizedInput)) {
        const responses = [
            "I'm **Hakkan's Portfolio Assistant**! 🤖 Not quite a robot in the traditional sense, but definitely not human either. Think of me as a helpful digital guide built specifically to tell you about Hakkan's work. He's the human developer – I'm just here to help!",
            "Yes, I'm a bot! But a friendly one. 😄 I'm specifically designed to help you explore **Hakkan's portfolio**. While he's the talented developer behind all these projects, I'm here to help you learn about his work!",
        ];
        const text = responses[Math.floor(Math.random() * responses.length)];
        return { text, speakText: optimizeForSpeech(text) };
    }

    // "Are you human/real?"
    if (/human|real|alive|person/.test(normalizedInput)) {
        const responses = [
            "I'm not human – I'm **Hakkan's Portfolio Assistant**! 🤖 Hakkan is the real person behind this portfolio. He's a full-stack developer studying Computer Science. I'm just his digital helper, here to tell you all about his amazing work!",
            "Nope, not human! But I'm very real in the sense that I'm here to help. 😊 Hakkan is the human developer – I'm his portfolio assistant. Want to know more about him?",
        ];
        const text = responses[Math.floor(Math.random() * responses.length)];
        return { text, speakText: optimizeForSpeech(text) };
    }

    // "Do you have feelings?"
    if (/feelings|emotions|feel/.test(normalizedInput)) {
        const text = "I don't have feelings in the human sense, but I do enjoy helping people learn about Hakkan's work! 😊 He's the one with the real passion for coding – I'm just here to share it with you. What would you like to know about him?";
        return { text, speakText: optimizeForSpeech(text) };
    }

    // Default "What are you?" response
    const text = "I'm **Hakkan's Portfolio Assistant**! 🚀 I'm a smart helper designed to tell you everything about Hakkan's projects, skills, experience, and more. He's the talented developer – I'm just here to help you explore his work. Ask me anything!";
    return { text, speakText: optimizeForSpeech(text) };
};

// ============ Math Handler ============

const handleMathQuery = (input: string): UtilityResponse | null => {
    const expression = extractMathExpression(input);
    if (!expression) {
        return null;
    }

    // Convert ^ to ** for evaluation
    const evalExpression = expression.replace(/\^/g, '**');
    const result = evaluateMathExpression(evalExpression);

    if (result === null) {
        return {
            text: "🤔 I couldn't calculate that expression. Make sure it's a valid math expression like \"2 + 2\" or \"15 * 3\".",
            speakText: "I couldn't calculate that expression. Try a simpler format like 2 plus 2.",
        };
    }

    return formatMathResult(expression, result);
};

// ============ Main Handler ============

/**
 * Process a utility query based on its subtype
 */
export const processUtilityQuery = (
    input: string,
    subtype?: string
): UtilityResponse => {
    switch (subtype) {
        case 'time':
            return handleTimeQuery();

        case 'date':
            return handleDateQuery();

        case 'identity':
            return handleIdentityQuery(input);

        case 'math':
        default:
            const mathResult = handleMathQuery(input);
            if (mathResult) {
                return mathResult;
            }

            // Fallback if math parsing failed
            return {
                text: "I can help with math! Try asking something like \"what is 25 * 4\" or \"calculate 100 / 5\".",
                speakText: "I can help with math! Try asking something like what is 25 times 4.",
            };
    }
};

export default processUtilityQuery;
