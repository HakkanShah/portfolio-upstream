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
    preloadVoices,
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
    sendMessage: (text: string) => void;
    startVoiceInput: () => void;
    startVoiceToText: (onTranscript: (text: string) => void) => void;
    stopVoiceInput: () => void;
    setVoiceEnabled: (enabled: boolean) => void;
    setIsOpen: (open: boolean) => void;
    clearMessages: () => void;
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
    caption: Caption | null;
}

// ============ Context ============

const AssistantContext = createContext<AssistantContextType | null>(null);

// ============ LLM fallback ============

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
    const [voiceEnabled, setVoiceEnabled] = useState(true);
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
    const captionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Check voice support on mount
    useEffect(() => {
        setVoiceSupported(isVoiceSupported());
        preloadVoices();
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
        // Safety net: if speech synthesis stalls, don't leave the bot mid-animation.
        const safetyTimeout = setTimeout(() => {
            setState((current) => {
                if (current === 'speaking') {
                    console.warn('Voice speaking timeout - resetting state');
                    cancelSpeaking();
                    return 'idle';
                }
                return current;
            });
        }, 30000);

        speak(
            speakText,
            () => {
                clearTimeout(safetyTimeout);
                if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
                setState('idle');
                setCaption(null);
            },
            () => {
                setState('speaking');
                if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);

                const words = speakText.split(' ');
                const chunkSize = 10;

                if (words.length <= chunkSize) {
                    setCaption({ text: speakText, source: 'assistant' });
                    return;
                }

                let index = 0;
                const showNextChunk = () => {
                    if (index >= words.length) return;
                    const chunk = words.slice(index, index + chunkSize).join(' ');
                    setCaption({ text: chunk, source: 'assistant' });
                    const duration = chunk.split(' ').length * 300 + 500;
                    index += chunkSize;
                    captionTimeoutRef.current = setTimeout(showNextChunk, duration);
                };
                showNextChunk();
            },
            {}
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

    const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const startVoiceInput = useCallback(() => {
        if (!voiceSupported) {
            addSystemMessage(
                "Voice isn't supported in this browser! 🔇\n\n💡 *Try using Chrome, Edge, or Safari for voice features, or use text mode.*",
                'error'
            );
            return;
        }

        cancelSpeaking();
        setState('listening');
        interimTranscriptRef.current = '';

        if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
        listeningTimeoutRef.current = setTimeout(() => {
            setState((current) => {
                if (current === 'listening') {
                    console.warn('Listening timeout - resetting state');
                    stopListening();
                    return 'idle';
                }
                return current;
            });
        }, 20000);

        startListening(
            (transcript, isFinal) => {
                setCaption({ text: transcript, source: 'user' });

                if (isFinal) {
                    if (listeningTimeoutRef.current) {
                        clearTimeout(listeningTimeoutRef.current);
                        listeningTimeoutRef.current = null;
                    }
                    void processInput(transcript);
                    setTimeout(() => setCaption(null), 1500);
                } else {
                    interimTranscriptRef.current = transcript;
                }
            },
            (errorMessage, voiceError) => {
                setCaption(null);
                if (listeningTimeoutRef.current) {
                    clearTimeout(listeningTimeoutRef.current);
                    listeningTimeoutRef.current = null;
                }
                handleVoiceError(errorMessage, voiceError);
            },
            () => {
                if (listeningTimeoutRef.current) {
                    clearTimeout(listeningTimeoutRef.current);
                    listeningTimeoutRef.current = null;
                }
                setState('idle');
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
                    if (isFinal) setState('idle');
                },
                handleVoiceError,
                () => setState('idle')
            );
        },
        [voiceSupported, handleVoiceError, addSystemMessage]
    );

    const stopVoiceInput = useCallback(() => {
        stopListening();
        setState('idle');

        const pendingTranscript = interimTranscriptRef.current.trim();
        const wasVoiceToText = transcriptCallbackRef.current !== null;
        transcriptCallbackRef.current = null;

        if (pendingTranscript && !wasVoiceToText) {
            void processInput(pendingTranscript);
            interimTranscriptRef.current = '';
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
        sendMessage,
        startVoiceInput,
        startVoiceToText,
        stopVoiceInput,
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
