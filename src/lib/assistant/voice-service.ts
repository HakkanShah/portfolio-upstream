/**
 * Voice Service
 *
 * Browser-native speech recognition (STT) and synthesis (TTS).
 *
 * The Web Speech API is full of sharp edges, and this module exists to blunt
 * them:
 *   • Chrome silently stops speaking after ~15s, so long answers are split
 *     into sentence-sized utterances and spoken as a queue.
 *   • Chrome drops an utterance queued immediately after `cancel()`, so a
 *     short settle delay is enforced.
 *   • `onstart` sometimes never fires, so a watchdog releases the UI instead
 *     of leaving the bot stuck in its "speaking" animation.
 *   • Recognition can deliver a final result after the user has cancelled, so
 *     every result is gated behind a session token.
 */

import { getProjects, getTechIndex } from './brain/knowledge';

// ============ Types ============

export type VoiceState = 'idle' | 'listening' | 'speaking';

export interface VoiceServiceOptions {
    lang?: string;
    continuous?: boolean;
    interimResults?: boolean;
    voiceRate?: number;
    voicePitch?: number;
    /** Called with each spoken chunk, so captions stay in sync with the audio. */
    onCaption?: (text: string) => void;
}

export interface VoiceError {
    code: string;
    message: string;
    userFriendlyMessage: string;
    suggestion: string;
}

// ============ Error mapping ============

const VOICE_ERRORS: Record<string, VoiceError> = {
    'no-speech': {
        code: 'no-speech',
        message: 'No speech detected',
        userFriendlyMessage: "I didn't catch that! 🎤",
        suggestion: 'Try speaking a little closer to your mic, or switch to text mode.',
    },
    'audio-capture': {
        code: 'audio-capture',
        message: 'No microphone found',
        userFriendlyMessage: "I can't find a microphone! 🎙️",
        suggestion: 'Check that your mic is connected and not in use by another app.',
    },
    'not-allowed': {
        code: 'not-allowed',
        message: 'Microphone access denied',
        userFriendlyMessage: 'Microphone access is blocked! 🔒',
        suggestion: 'Allow mic access from the padlock icon in your address bar, then try again.',
    },
    network: {
        code: 'network',
        message: 'Network error during speech recognition',
        userFriendlyMessage: 'Speech recognition needs a connection! 🌐',
        suggestion: 'Check your internet, or just type your question instead.',
    },
    'service-not-allowed': {
        code: 'service-not-allowed',
        message: 'Speech recognition service not allowed',
        userFriendlyMessage: 'Voice input is unavailable here! ⚠️',
        suggestion: 'Chrome, Edge and Safari support it — or use text mode.',
    },
    'language-not-supported': {
        code: 'language-not-supported',
        message: 'Language not supported',
        userFriendlyMessage: "That language isn't supported! 🗣️",
        suggestion: 'Try speaking in English, or use text mode.',
    },
    aborted: {
        code: 'aborted',
        message: 'Recognition aborted',
        userFriendlyMessage: '',
        suggestion: '',
    },
    default: {
        code: 'unknown',
        message: 'Unknown speech recognition error',
        userFriendlyMessage: 'Voice input hit a snag! 😅',
        suggestion: 'No worries — you can type your question instead.',
    },
};

export const getVoiceError = (errorCode: string): VoiceError =>
    VOICE_ERRORS[errorCode] ?? VOICE_ERRORS.default;

// ============ Support detection ============

export const isSpeechRecognitionSupported = (): boolean => {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
};

export const isSpeechSynthesisSupported = (): boolean =>
    typeof window !== 'undefined' && Boolean(window.speechSynthesis);

export const isVoiceSupported = (): boolean =>
    isSpeechRecognitionSupported() && isSpeechSynthesisSupported();

const isAppleBrowser = (): boolean =>
    typeof navigator !== 'undefined' &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

/**
 * Recognition language. An English-speaking visitor gets their own variant
 * (accents differ a lot); everyone else gets en-IN, which handles the names
 * in this portfolio best.
 */
const recognitionLang = (override?: string): string => {
    if (override) return override;
    const preferred = typeof navigator !== 'undefined' ? navigator.language : '';
    return /^en-[A-Z]{2}$/i.test(preferred) ? preferred : 'en-IN';
};

// ============ Vocabulary (generated from the portfolio) ============

/** Generic words that must never promote a worse recognition alternative. */
const GENERIC_HINTS = new Set([
    'open', 'show', 'tell', 'next', 'react', 'tools', 'game', 'games', 'live',
    'about', 'work', 'code', 'link', 'java', 'main',
]);

let vocabularyCache: string[] | null = null;

/**
 * Distinctive words worth biasing recognition towards — project names, their
 * nicknames, and technology names. Built from the knowledge graph, so adding a
 * project to `data.ts` improves speech recognition automatically.
 */
const getVocabulary = (): string[] => {
    if (vocabularyCache) return vocabularyCache;

    const words = new Set<string>();

    for (const project of getProjects()) {
        words.add(project.title);
        for (const alias of project.aliases) {
            if (alias.length >= 4) words.add(alias);
        }
    }
    for (const tech of new Set(getTechIndex().values())) {
        if (tech.label.length >= 4) words.add(tech.label);
    }
    for (const extra of ['Hakkan', 'Hakkan Parbej Shah', 'portfolio', 'resume', 'internship', 'certification', 'LinkedIn', 'GitHub']) {
        words.add(extra);
    }

    vocabularyCache = Array.from(words).filter((word) => !GENERIC_HINTS.has(word.toLowerCase()));
    return vocabularyCache;
};

const mentionsVocabulary = (text: string, vocabulary: string[]): boolean => {
    const lower = text.toLowerCase();
    return vocabulary.some((word) => word.length >= 4 && lower.includes(word.toLowerCase()));
};

// ============ Speech recognition ============

type RecognitionInstance = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionLikeEvent) => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onend: (() => void) | null;
    onspeechstart: (() => void) | null;
};

interface SpeechRecognitionLikeEvent {
    resultIndex: number;
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean; length: number }>;
}

/** How long a pause means "they've finished speaking". */
const SILENCE_MS = 1800;
/** How long to wait for any speech at all before giving up. */
const NO_SPEECH_MS = 12000;

let recognition: RecognitionInstance | null = null;
let listening = false;
/** Invalidates callbacks from a recognition session the user already ended. */
let recognitionToken = 0;
let noSpeechTimer: ReturnType<typeof setTimeout> | null = null;
let silenceTimer: ReturnType<typeof setTimeout> | null = null;
let retriedAfterNoSpeech = false;

const clearRecognitionTimers = (): void => {
    if (noSpeechTimer) {
        clearTimeout(noSpeechTimer);
        noSpeechTimer = null;
    }
    if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
    }
};

const teardownRecognition = (mode: 'stop' | 'abort'): void => {
    clearRecognitionTimers();
    if (recognition) {
        try {
            // abort() discards pending results; stop() lets the last one through.
            if (mode === 'abort') recognition.abort();
            else recognition.stop();
        } catch {
            // Already stopped — nothing to do.
        }
        recognition = null;
    }
    listening = false;
};

const beginListening = (
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (error: string, voiceError?: VoiceError) => void,
    onEnd: (() => void) | undefined,
    options: VoiceServiceOptions,
    isRetry: boolean
): boolean => {
    if (!isSpeechRecognitionSupported()) {
        const error = getVoiceError('service-not-allowed');
        onError(error.message, error);
        return false;
    }

    // Replace any session already in flight.
    teardownRecognition('abort');
    if (!isRetry) retriedAfterNoSpeech = false;

    const token = ++recognitionToken;
    const isCurrent = () => token === recognitionToken;

    try {
        const w = window as unknown as Record<string, unknown>;
        const SpeechRecognitionCtor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as new () => RecognitionInstance;

        const instance = new SpeechRecognitionCtor();
        recognition = instance;

        instance.lang = recognitionLang(options.lang);
        // Safari handles continuous recognition poorly; one phrase at a time there.
        instance.continuous = options.continuous ?? !isAppleBrowser();
        instance.interimResults = options.interimResults ?? true;
        instance.maxAlternatives = 4;

        const vocabulary = getVocabulary();
        let latestInterim = '';
        let delivered = false;

        /** Deliver exactly one final transcript per session. */
        const deliverFinal = (transcript: string) => {
            if (delivered || !isCurrent()) return;
            const cleaned = transcript.trim();
            if (!cleaned) return;
            delivered = true;
            clearRecognitionTimers();
            onResult(cleaned, true);
            teardownRecognition('abort');
        };

        instance.onstart = () => {
            if (!isCurrent()) return;
            listening = true;
            latestInterim = '';
            noSpeechTimer = setTimeout(() => {
                if (!isCurrent() || delivered) return;

                // Chrome fires no-speech eagerly; give it one quiet retry first.
                if (!retriedAfterNoSpeech) {
                    retriedAfterNoSpeech = true;
                    teardownRecognition('abort');
                    beginListening(onResult, onError, onEnd, options, true);
                    return;
                }
                teardownRecognition('abort');
                const error = getVoiceError('no-speech');
                onError(error.message, error);
            }, NO_SPEECH_MS);
        };

        instance.onspeechstart = () => {
            if (noSpeechTimer) {
                clearTimeout(noSpeechTimer);
                noSpeechTimer = null;
            }
        };

        instance.onresult = (event) => {
            if (!isCurrent() || delivered) return;

            if (noSpeechTimer) {
                clearTimeout(noSpeechTimer);
                noSpeechTimer = null;
            }

            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const result = event.results[i];
                let transcript = result[0].transcript;

                // Speech engines mangle product names. If a lower-ranked
                // alternative names something from the portfolio and the top
                // pick doesn't, the alternative is almost always the right one.
                if (result.length > 1 && !mentionsVocabulary(transcript, vocabulary)) {
                    for (let j = 1; j < result.length; j += 1) {
                        const alternative = result[j].transcript;
                        if (mentionsVocabulary(alternative, vocabulary)) {
                            transcript = alternative;
                            break;
                        }
                    }
                }

                if (result.isFinal) finalTranscript += transcript;
                else interimTranscript += transcript;
            }

            if (finalTranscript.trim()) {
                deliverFinal(finalTranscript);
                return;
            }

            if (interimTranscript.trim()) {
                latestInterim = interimTranscript;
                onResult(interimTranscript, false);

                // Treat a pause as the end of the question, so the visitor
                // doesn't have to press stop.
                if (silenceTimer) clearTimeout(silenceTimer);
                silenceTimer = setTimeout(() => deliverFinal(latestInterim), SILENCE_MS);
            }
        };

        instance.onerror = (event) => {
            if (!isCurrent()) return;
            listening = false;
            clearRecognitionTimers();

            if (event.error === 'aborted' || delivered) return;

            // One silent retry for a premature no-speech.
            if (event.error === 'no-speech' && !retriedAfterNoSpeech) {
                retriedAfterNoSpeech = true;
                teardownRecognition('abort');
                beginListening(onResult, onError, onEnd, options, true);
                return;
            }

            const voiceError = getVoiceError(event.error);
            onError(voiceError.message, voiceError);
        };

        instance.onend = () => {
            if (!isCurrent()) return;
            listening = false;
            clearRecognitionTimers();
            onEnd?.();
        };

        instance.start();
        return true;
    } catch {
        const voiceError = getVoiceError('default');
        onError(voiceError.message, voiceError);
        return false;
    }
};

export const startListening = (
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (error: string, voiceError?: VoiceError) => void,
    onEnd?: () => void,
    options: VoiceServiceOptions = {}
): boolean => beginListening(onResult, onError, onEnd, options, false);

/** Ends the session and discards anything not already delivered. */
export const stopListening = (): void => {
    recognitionToken += 1;
    retriedAfterNoSpeech = false;
    teardownRecognition('abort');
};

export const isCurrentlyListening = (): boolean => listening;

/**
 * Best-effort microphone permission check, so the UI can explain a block
 * before the browser throws a cryptic error. Resolves 'unknown' where the
 * Permissions API isn't available (Safari, Firefox).
 */
export const checkMicrophonePermission = async (): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
    try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return status.state;
    } catch {
        return 'unknown';
    }
};

// ============ Speech synthesis ============

/**
 * Chrome stops speaking after roughly 15 seconds of a single utterance, so
 * each chunk is kept short enough to finish well inside that.
 */
const MAX_CHUNK_CHARS = 170;
/** Chrome drops an utterance queued too soon after cancel(). */
const CANCEL_SETTLE_MS = 90;
/** If speech hasn't started by now, assume it failed and release the UI. */
const START_WATCHDOG_MS = 2500;

let speechToken = 0;
let speaking = false;
let cachedVoice: SpeechSynthesisVoice | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

// Voices ordered by how natural they sound.
const PREFERRED_VOICES = [
    'Google UK English Female',
    'Google US English',
    'Google UK English Male',
    'Microsoft Aria',
    'Microsoft Zira',
    'Samantha',
    'Karen',
    'Daniel',
    'Microsoft David',
    'Alex',
];

const findBestVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    const english = voices.filter((voice) => voice.lang.startsWith('en'));
    if (!english.length) return null;

    for (const preferred of PREFERRED_VOICES) {
        const match = english.find((voice) => voice.name.includes(preferred));
        if (match) return match;
    }

    const natural = english.find((voice) => /natural|neural|premium|enhanced/i.test(voice.name));
    if (natural) return natural;

    // A local voice still works with no connection; remote ones fail silently.
    return english.find((voice) => voice.localService) ?? english[0];
};

/** Names a speech engine would otherwise mangle. */
const PRONUNCIATION_OVERRIDES: Array<[RegExp, string]> = [
    [/\bMockHick\b/gi, 'Mock Hick'],
    [/\bReelXtract\b/gi, 'Reel Extract'],
    [/\bMath-O-Matic\b/gi, 'Math o Matic'],
    [/\bAluChat\b/gi, 'Aloo Chat'],
    [/\bHit-The-Jhatu\b/gi, 'Hit The Jhatu'],
    [/\bCommitHabit\b/gi, 'Commit Habit'],
    [/\bshadcn\/ui\b/gi, 'shad c n u i'],
    [/\bg\.dev\b/gi, 'g dot dev'],
    [/\bCGPA\b/g, 'C G P A'],
    [/\bAI\b/g, 'A.I.'],
    [/\bUI\/UX\b/g, 'U.I. U.X.'],
    [/\bUI\b/g, 'U.I.'],
    [/\bUX\b/g, 'U.X.'],
    [/\bAPI\b/g, 'A.P.I.'],
    [/\bAPIs\b/g, 'A.P.I.s'],
    [/\bCSS\b/g, 'C.S.S.'],
    [/\bHTML\b/g, 'H.T.M.L.'],
    [/\bCV\b/g, 'C.V.'],
    [/\bPR\b/g, 'P.R.'],
    [/\bPRs\b/g, 'P.R.s'],
    [/\bOAuth\b/g, 'O Auth'],
    [/\bJWT\b/g, 'J.W.T.'],
    [/\bWPF\b/g, 'W.P.F.'],
    [/\.NET\b/g, 'dot net'],
];

/** Splits PascalCase project names so they're read as words, not spelled out. */
const splitCompoundNames = (text: string): string => {
    let result = text;
    for (const project of getProjects()) {
        if (!/[a-z][A-Z]/.test(project.title)) continue;
        const spaced = project.title.replace(/([a-z])([A-Z])/g, '$1 $2');
        result = result.replace(new RegExp(`\\b${project.title}\\b`, 'g'), spaced);
    }
    return result;
};

const prepareForSpeech = (text: string): string => {
    let processed = text
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/[*_`#>]/g, '')
        .replace(/^\s*[•\-]\s*/gm, '')
        .replace(/https?:\/\/\S+/g, 'the link on screen')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');

    processed = splitCompoundNames(processed);

    for (const [pattern, replacement] of PRONUNCIATION_OVERRIDES) {
        processed = processed.replace(pattern, replacement);
    }

    return processed
        .replace(/([a-z0-9._%-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi, (_m, user: string, domain: string) =>
            `${user.replace(/\./g, ' dot ')} at ${domain.replace(/\./g, ' dot ')}`
        )
        .replace(/\s*\n+\s*/g, '. ')
        .replace(/\.\s*\./g, '.')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

/** Full stops that don't end a sentence. */
const ABBREVIATION_END = /\b(?:pvt|ltd|inc|co|corp|dr|mr|mrs|ms|st|jr|sr|vs|etc|e\.g|i\.e|approx|dept|univ|no|vol)\.$/i;
/** A trailing initial, e.g. "A.I." or "C.V." */
const INITIALS_END = /(?:^|\s)(?:[A-Z]\.){1,4}$/;

/**
 * Sentence split that doesn't trip over "PVT. LTD." or "A.I.".
 * Deliberately avoids lookbehind, which older Safari can't even parse.
 */
const splitSentences = (text: string): string[] => {
    const pieces = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
    const sentences: string[] = [];

    for (const piece of pieces) {
        const previous = sentences[sentences.length - 1];
        if (previous) {
            const trimmedPrevious = previous.trimEnd();
            const continuesPrevious =
                ABBREVIATION_END.test(trimmedPrevious) ||
                INITIALS_END.test(trimmedPrevious) ||
                /^\s*[,;:)\]]/.test(piece) ||
                /^\s*[a-z]/.test(piece);

            if (continuesPrevious) {
                sentences[sentences.length - 1] = previous + piece;
                continue;
            }
        }
        sentences.push(piece);
    }

    return sentences;
};

/** Sentence-sized pieces, so no single utterance can hit Chrome's cutoff. */
export const chunkForSpeech = (text: string): string[] => {
    const sentences = splitSentences(text);
    const chunks: string[] = [];
    let current = '';

    const flush = () => {
        const trimmed = current.trim();
        if (trimmed) chunks.push(trimmed);
        current = '';
    };

    for (const sentence of sentences) {
        if (sentence.length > MAX_CHUNK_CHARS) {
            flush();
            // Break an over-long sentence on its commas, then on raw length.
            let remainder = sentence.trim();
            while (remainder.length > MAX_CHUNK_CHARS) {
                const window = remainder.slice(0, MAX_CHUNK_CHARS);
                const breakAt = Math.max(window.lastIndexOf(', '), window.lastIndexOf(' '));
                const cut = breakAt > MAX_CHUNK_CHARS * 0.5 ? breakAt + 1 : MAX_CHUNK_CHARS;
                chunks.push(remainder.slice(0, cut).trim());
                remainder = remainder.slice(cut).trim();
            }
            if (remainder) current = `${remainder} `;
            continue;
        }

        if ((current + sentence).length > MAX_CHUNK_CHARS) flush();
        current += sentence;
    }
    flush();

    return chunks.length ? chunks : [text];
};

const stopKeepAlive = (): void => {
    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
    }
};

/** Chrome occasionally self-pauses mid-queue; nudge it back awake. */
const startKeepAlive = (): void => {
    stopKeepAlive();
    keepAliveTimer = setInterval(() => {
        const synth = window.speechSynthesis;
        if (!synth.speaking) return;
        if (synth.paused) synth.resume();
    }, 5000);
};

export const speak = (
    text: string,
    onEnd?: () => void,
    onStart?: () => void,
    options: VoiceServiceOptions = {}
): boolean => {
    if (!isSpeechSynthesisSupported() || !text.trim()) {
        onEnd?.();
        return false;
    }

    cancelSpeaking();

    const token = ++speechToken;
    const isCurrent = () => token === speechToken;

    try {
        const synth = window.speechSynthesis;
        const chunks = chunkForSpeech(prepareForSpeech(text));

        const voices = synth.getVoices();
        if (!cachedVoice || !voices.includes(cachedVoice)) {
            cachedVoice = findBestVoice(voices);
        }

        // Short answers read better slightly slower; long ones slightly faster.
        const totalLength = chunks.join(' ').length;
        const rate = options.voiceRate ?? (totalLength < 60 ? 0.97 : totalLength > 320 ? 1.08 : 1.02);

        let started = false;
        let watchdog: ReturnType<typeof setTimeout> | null = null;

        const finish = () => {
            if (!isCurrent()) return;
            speaking = false;
            stopKeepAlive();
            if (watchdog) clearTimeout(watchdog);
            onEnd?.();
        };

        const speakChunk = (index: number) => {
            if (!isCurrent()) return;
            if (index >= chunks.length) {
                finish();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(chunks[index]);
            utterance.lang = options.lang ?? cachedVoice?.lang ?? 'en-US';
            utterance.rate = rate;
            utterance.pitch = options.voicePitch ?? 1.08;
            utterance.volume = 1;
            if (cachedVoice) utterance.voice = cachedVoice;

            utterance.onstart = () => {
                if (!isCurrent()) return;
                if (watchdog) {
                    clearTimeout(watchdog);
                    watchdog = null;
                }
                if (!started) {
                    started = true;
                    speaking = true;
                    startKeepAlive();
                    onStart?.();
                }
                // Caption the chunk that is actually being spoken right now.
                options.onCaption?.(chunks[index]);
            };

            utterance.onend = () => {
                if (!isCurrent()) return;
                speakChunk(index + 1);
            };

            utterance.onerror = (event) => {
                if (!isCurrent()) return;
                if (event.error === 'interrupted' || event.error === 'canceled') return;
                console.warn('Speech synthesis error:', event.error);
                // Skip the bad chunk rather than dropping the whole answer.
                speakChunk(index + 1);
            };

            synth.speak(utterance);
        };

        // If nothing starts, release the UI instead of freezing mid-animation.
        watchdog = setTimeout(() => {
            if (!isCurrent() || started) return;
            console.warn('Speech synthesis never started — continuing without audio.');
            synth.cancel();
            finish();
        }, START_WATCHDOG_MS);

        // Chrome needs a beat after cancel() or the first utterance is dropped.
        setTimeout(() => speakChunk(0), CANCEL_SETTLE_MS);
        return true;
    } catch (error) {
        console.error('Failed to speak:', error);
        speaking = false;
        onEnd?.();
        return false;
    }
};

export const cancelSpeaking = (): void => {
    speechToken += 1;
    speaking = false;
    stopKeepAlive();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};

export const isCurrentlySpeaking = (): boolean => {
    if (typeof window === 'undefined') return false;
    return speaking || window.speechSynthesis.speaking;
};

// ============ Voice list ============

export const getAvailableVoices = (): SpeechSynthesisVoice[] =>
    isSpeechSynthesisSupported() ? window.speechSynthesis.getVoices() : [];

export const preloadVoices = (): Promise<SpeechSynthesisVoice[]> =>
    new Promise((resolve) => {
        if (!isSpeechSynthesisSupported()) {
            resolve([]);
            return;
        }

        const synth = window.speechSynthesis;
        const settle = (voices: SpeechSynthesisVoice[]) => {
            if (voices.length) cachedVoice = findBestVoice(voices);
            resolve(voices);
        };

        const immediate = synth.getVoices();
        if (immediate.length) {
            settle(immediate);
            return;
        }

        // The list often arrives asynchronously, and can change later.
        synth.addEventListener('voiceschanged', () => settle(synth.getVoices()), { once: true });
        setTimeout(() => settle(synth.getVoices()), 1200);
    });

export const getCurrentVoiceInfo = (): string =>
    cachedVoice ? `${cachedVoice.name} (${cachedVoice.lang})` : 'Default system voice';
