'use client';

/**
 * Assistant Context
 *
 * Owns the chat state. Answers come from the on-device engine first, which is
 * instant; only questions it admits it cannot answer are sent to the optional
 * Groq fallback, and a failure there is invisible to the visitor.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ask, createMemory, type AssistantReply, type BrainMemory } from './engine';
import { welcomeAnswer, warmIndex } from './brain/brain';
import { optimizeForSpeech } from './speech-utils';
import {
    startListening,
    stopListening,
    speak,
    cancelSpeaking,
    isVoiceSupported,
    isSpeechRecognitionSupported,
    preloadVoices,
    checkMicrophonePermission,
    VoiceError,
} from './voice-service';

// ============ Types ============

export type AssistantState = 'idle' | 'listening' | 'speaking' | 'thinking';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    messageType?: 'normal' | 'error' | 'info';
    /** Follow-up suggestions offered with this answer. */
    chips?: string[];
    action?: {
        type: 'navigate';
        target: string;
    };
}

export interface Caption {
    text: string;
    source: 'user' | 'assistant';
}

interface AssistantContextType {
    messages: Message[];
    state: AssistantState;
    isOpen: boolean;
    voiceEnabled: boolean;
    voiceSupported: boolean;
    /** Context-aware follow-ups for the most recent answer. */
    suggestions: string[];
    /** True while an answer is being read aloud. */
    isSpeaking: boolean;
    sendMessage: (text: string) => void;
    startVoiceInput: () => void;
    startVoiceToText: (onTranscript: (text: string) => void) => void;
    stopVoiceInput: () => void;
    /** Stop the current answer being read aloud, without ending the chat. */
    stopSpeaking: () => void;
    setVoiceEnabled: (enabled: boolean) => void;
    setIsOpen: (open: boolean) => void;
    clearMessages: () => void;
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
    caption: Caption | null;
}

// ============ Context ============

const AssistantContext = createContext<AssistantContextType | null>(null);

// ============ LLM fallback ============

const VOICE_PREFERENCE_KEY = 'hakkan_assistant_voice_enabled';

const readVoicePreference = (): boolean => {
    if (typeof window === 'undefined') return true;
    try {
        return window.localStorage.getItem(VOICE_PREFERENCE_KEY) !== 'false';
    } catch {
        return true;
    }
};

const REMOTE_TIMEOUT_MS = 7000;
/** Stop trying the fallback after this many consecutive failures this session. */
const REMOTE_FAILURE_BUDGET = 2;

interface RemoteResult {
    text: string | null;
    /** No key configured: never worth retrying this session. */
    disabled: boolean;
}

const askRemote = async (
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<RemoteResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);

    try {
        const response = await fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, history }),
            signal: controller.signal,
        });

        const payload = (await response.json()) as { ok?: boolean; text?: string; reason?: string };

        if (payload.ok && typeof payload.text === 'string' && payload.text.trim()) {
            return { text: payload.text.trim(), disabled: false };
        }
        return { text: null, disabled: payload.reason === 'no_key' };
    } catch {
        return { text: null, disabled: false };
    } finally {
        clearTimeout(timeout);
    }
};

// ============ Provider ============

export const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [state, setState] = useState<AssistantState>('idle');
    const [caption, setCaption] = useState<Caption | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [voiceEnabled, setVoiceEnabledState] = useState(true);
    const [voiceSupported, setVoiceSupported] = useState(false);
    const [hasShownWelcome, setHasShownWelcome] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([
        'Show his projects',
        'His tech stack',
        'Is he open to work?',
    ]);

    // Conversation memory for contextual answers ("tell me more", "its stack").
    const memoryRef = useRef<BrainMemory>(createMemory());
    const remoteFailuresRef = useRef(0);
    const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

    const interimTranscriptRef = useRef<string>('');

    // Check voice support and restore the visitor's audio preference
    useEffect(() => {
        setVoiceSupported(isVoiceSupported());
        setVoiceEnabledState(readVoicePreference());
        preloadVoices();
    }, []);

    const setVoiceEnabled = useCallback((enabled: boolean) => {
        setVoiceEnabledState(enabled);
        try {
            window.localStorage.setItem(VOICE_PREFERENCE_KEY, String(enabled));
        } catch {
            // Private mode — the preference just won't persist.
        }
        if (!enabled) cancelSpeaking();
    }, []);

    // Build the retrieval index before the first question, not during it.
    useEffect(() => {
        if (!isOpen) return;
        const idle = window.requestIdleCallback?.bind(window) ?? ((callback: () => void) => setTimeout(callback, 1));
        idle(() => warmIndex());
    }, [isOpen]);

    const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const addUserMessage = useCallback((content: string) => {
        const message: Message = {
            id: generateId(),
            role: 'user',
            content,
            timestamp: Date.now(),
            messageType: 'normal',
        };
        setMessages((prev) => [...prev, message]);
        return message;
    }, []);

    const speakReply = useCallback((speakText: string) => {
        // Backstop only: the voice service has its own start watchdog, so this
        // is scaled to the length of the answer and should never fire normally.
        const estimatedMs = Math.min(120000, (speakText.length / 12) * 1000 + 15000);
        const safetyTimeout = setTimeout(() => {
            setState((current) => {
                if (current === 'speaking' || current === 'thinking') {
                    console.warn('Speech ran past its expected duration - resetting state');
                    cancelSpeaking();
                    return 'idle';
                }
                return current;
            });
            setCaption(null);
        }, estimatedMs);

        speak(
            speakText,
            () => {
                clearTimeout(safetyTimeout);
                // 'thinking' too: speech may never have started (muted tab,
                // missing voices), and the UI must not stay stuck.
                setState((current) => (current === 'speaking' || current === 'thinking' ? 'idle' : current));
                setCaption(null);
            },
            () => setState('speaking'),
            {
                // Captions are driven by the audio itself, one spoken chunk at
                // a time, so they can never drift out of sync.
                onCaption: (chunk) => setCaption({ text: chunk, source: 'assistant' }),
            }
        );
    }, []);

    const addAssistantReply = useCallback(
        (reply: Pick<AssistantReply, 'text' | 'speak' | 'chips' | 'action'>) => {
            const message: Message = {
                id: generateId(),
                role: 'assistant',
                content: reply.text,
                timestamp: Date.now(),
                messageType: 'normal',
                chips: reply.chips,
                action: reply.action,
            };
            setMessages((prev) => [...prev, message]);
            setSuggestions(reply.chips?.length ? reply.chips : []);

            historyRef.current = [...historyRef.current, { role: 'assistant' as const, content: reply.text }].slice(-6);

            if (reply.action?.type === 'navigate') {
                const target = reply.action.target;
                setTimeout(() => {
                    const element = document.getElementById(target);
                    if (!element) return;
                    const offset = element.getBoundingClientRect().top + window.pageYOffset - 100;
                    window.scrollTo({ top: offset, behavior: 'smooth' });
                }, 400);
            }

            if (voiceEnabled && reply.speak) {
                speakReply(reply.speak);
            } else {
                setState('idle');
            }

            return message;
        },
        [voiceEnabled, speakReply]
    );

    const stopSpeaking = useCallback(() => {
        cancelSpeaking();
        setCaption(null);
        setState((current) => (current === 'speaking' ? 'idle' : current));
    }, []);

    // Leaving the chat should never leave audio playing behind it.
    useEffect(() => {
        if (isOpen) return;
        cancelSpeaking();
        stopListening();
        setCaption(null);
        setState('idle');
    }, [isOpen]);

    useEffect(() => () => {
        cancelSpeaking();
        stopListening();
    }, []);

    // Expose generic addMessage (used by the auto-greeting)
    const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
        const newMessage: Message = {
            id: generateId(),
            timestamp: Date.now(),
            ...message,
        };
        setMessages((prev) => [...prev, newMessage]);
    }, []);

    const addSystemMessage = useCallback((content: string, messageType: 'error' | 'info' = 'info') => {
        const message: Message = {
            id: generateId(),
            role: 'system',
            content,
            timestamp: Date.now(),
            messageType,
        };
        setMessages((prev) => [...prev, message]);
        return message;
    }, []);

    // Welcome message on first open
    useEffect(() => {
        if (isOpen && !hasShownWelcome) {
            const welcome = welcomeAnswer();
            addAssistantReply(welcome);
            setHasShownWelcome(true);
        }
    }, [isOpen, hasShownWelcome, addAssistantReply]);

    // ============ Core: handle a user message ============

    const processInput = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) return;

            addUserMessage(trimmed);
            historyRef.current = [...historyRef.current, { role: 'user' as const, content: trimmed }].slice(-6);
            // Local answers resolve in the same tick, so this only ever shows
            // for the rare question that goes to the network.
            setState('thinking');

            let reply: AssistantReply;
            try {
                const turn = ask(trimmed, memoryRef.current);
                memoryRef.current = turn.memory;
                reply = turn.reply;
            } catch (error) {
                console.error('Assistant engine error:', error);
                setState('idle');
                addAssistantReply({
                    text: "Something went wrong on my side. Mind asking that again?",
                    speak: 'Something went wrong on my side. Mind asking that again?',
                    chips: ['Show his projects', 'His tech stack', 'Contact him'],
                });
                return;
            }

            // Everything the local engine knows is answered immediately.
            if (!reply.needsLLM || remoteFailuresRef.current >= REMOTE_FAILURE_BUDGET) {
                addAssistantReply(reply);
                return;
            }

            // Only the leftovers reach the network.
            setState('thinking');
            const remote = await askRemote(trimmed, historyRef.current.slice(0, -1));

            if (remote.text) {
                remoteFailuresRef.current = 0;
                addAssistantReply({
                    text: remote.text,
                    speak: optimizeForSpeech(remote.text),
                    chips: reply.chips,
                });
                return;
            }

            remoteFailuresRef.current = remote.disabled ? REMOTE_FAILURE_BUDGET : remoteFailuresRef.current + 1;
            addAssistantReply(reply);
        },
        [addUserMessage, addAssistantReply]
    );

    const sendMessage = useCallback(
        (text: string) => {
            cancelSpeaking();
            void processInput(text);
        },
        [processInput]
    );

    // ============ Voice ============

    const handleVoiceError = useCallback(
        (errorMessage: string, voiceError?: VoiceError) => {
            setState('idle');

            if (voiceError?.userFriendlyMessage) {
                addSystemMessage(`${voiceError.userFriendlyMessage}\n\n💡 *${voiceError.suggestion}*`, 'error');
            } else {
                addSystemMessage(
                    "Voice input ran into an issue! 🎤\n\n💡 *No worries – you can type your message using text mode instead.*",
                    'error'
                );
            }

            console.error('Voice input error:', errorMessage);
        },
        [addSystemMessage]
    );

    const startVoiceInput = useCallback(() => {
        if (!voiceSupported) {
            addSystemMessage(
                isSpeechRecognitionSupported()
                    ? "This browser can't read answers aloud. 🔇\n\n💡 *Voice input still works, or just use text mode.*"
                    : "Voice input isn't supported in this browser! 🔇\n\n💡 *Chrome, Edge or Safari support it — or use text mode.*",
                'error'
            );
            return;
        }

        // Speaking over the visitor is rude: stop the answer when they talk.
        cancelSpeaking();
        setState('listening');
        interimTranscriptRef.current = '';

        void checkMicrophonePermission().then((permission) => {
            if (permission === 'denied') {
                stopListening();
                setState('idle');
                addSystemMessage(
                    'Microphone access is blocked! 🔒\n\n💡 *Allow it from the padlock icon in your address bar, then tap the mic again.*',
                    'error'
                );
            }
        });

        startListening(
            (transcript, isFinal) => {
                setCaption({ text: transcript, source: 'user' });

                if (isFinal) {
                    // Clear immediately so stopVoiceInput can't resend it.
                    interimTranscriptRef.current = '';
                    void processInput(transcript);
                    setTimeout(() => setCaption(null), 1200);
                } else {
                    interimTranscriptRef.current = transcript;
                }
            },
            (errorMessage, voiceError) => {
                setCaption(null);
                handleVoiceError(errorMessage, voiceError);
            },
            () => {
                // Only release the UI if we're still listening — by now the
                // answer may already be playing.
                setState((current) => (current === 'listening' ? 'idle' : current));
            }
        );
    }, [voiceSupported, processInput, handleVoiceError, addSystemMessage]);

    const transcriptCallbackRef = useRef<((text: string) => void) | null>(null);

    const startVoiceToText = useCallback(
        (onTranscript: (text: string) => void) => {
            if (!voiceSupported) {
                addSystemMessage(
                    "Voice isn't supported in this browser! 🔇\n\n💡 *Try using Chrome, Edge, or Safari for voice features.*",
                    'error'
                );
                return;
            }

            cancelSpeaking();
            setState('listening');
            interimTranscriptRef.current = '';
            transcriptCallbackRef.current = onTranscript;

            startListening(
                (transcript, isFinal) => {
                    transcriptCallbackRef.current?.(transcript);
                    if (isFinal) {
                        interimTranscriptRef.current = '';
                        transcriptCallbackRef.current = null;
                        setState('idle');
                    }
                },
                handleVoiceError,
                () => setState((current) => (current === 'listening' ? 'idle' : current))
            );
        },
        [voiceSupported, handleVoiceError, addSystemMessage]
    );

    const stopVoiceInput = useCallback(() => {
        const pendingTranscript = interimTranscriptRef.current.trim();
        const wasVoiceToText = transcriptCallbackRef.current !== null;

        stopListening();
        interimTranscriptRef.current = '';
        transcriptCallbackRef.current = null;
        setCaption(null);
        setState((current) => (current === 'listening' ? 'idle' : current));

        // In voice mode, stopping means "I'm done talking" — send it.
        if (pendingTranscript && !wasVoiceToText) {
            void processInput(pendingTranscript);
        }
    }, [processInput]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setHasShownWelcome(false);
        memoryRef.current = createMemory();
        historyRef.current = [];
        setSuggestions(['Show his projects', 'His tech stack', 'Is he open to work?']);
    }, []);

    const value: AssistantContextType = {
        messages,
        state,
        caption,
        isOpen,
        voiceEnabled,
        voiceSupported,
        suggestions,
        isSpeaking: state === 'speaking',
        sendMessage,
        startVoiceInput,
        startVoiceToText,
        stopVoiceInput,
        stopSpeaking,
        setVoiceEnabled,
        setIsOpen,
        clearMessages,
        addMessage,
    };

    return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
};

// ============ Hook ============

export const useAssistant = (): AssistantContextType => {
    const context = useContext(AssistantContext);
    if (!context) {
        throw new Error('useAssistant must be used within an AssistantProvider');
    }
    return context;
};

export default AssistantContext;
