'use client';

/**
 * Assistant Chat Component
 * Chat interface with text input and voice controls
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Volume2, VolumeX, Loader2, Sparkles, Briefcase, Code2, GraduationCap, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAssistant, speak } from '@/lib/assistant';
import ChatMessage from './chat-message';
import { cn } from '@/lib/utils';

type ChatMode = 'text' | 'voice';

interface AssistantChatProps {
    className?: string;
    mode?: ChatMode;
}

const AssistantChat: React.FC<AssistantChatProps> = ({ className, mode = 'text' }) => {
    const {
        messages,
        state,
        voiceEnabled,
        voiceSupported,
        sendMessage,
        startVoiceInput,
        startVoiceToText,
        stopVoiceInput,
        setVoiceEnabled,
        stopSpeaking,
        suggestions: followUps,
    } = useAssistant();

    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when chat opens
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            sendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    // Voice toggle for voice mode (auto-send)
    const handleVoiceToggle = () => {
        if (state === 'listening') {
            stopVoiceInput();
        } else {
            startVoiceInput();
        }
    };

    // Voice-to-text for text mode (fills input box)
    const handleTextModeVoice = () => {
        if (state === 'listening') {
            stopVoiceInput();
        } else {
            startVoiceToText((transcript) => {
                setInputValue(transcript);
            });
        }
    };

    const isListening = state === 'listening';
    const isSpeaking = state === 'speaking';

    const isThinking = state === 'thinking';

    // Starter chips shown on the empty state
    const suggestions = [
        { icon: Sparkles, label: 'Who is Hakkan?', query: 'Who is Hakkan?' },
        { icon: Code2, label: 'His tech stack', query: 'What is his tech stack?' },
        { icon: Briefcase, label: 'Show his projects', query: 'Show me his projects' },
        { icon: GraduationCap, label: 'Is he open to work?', query: 'Is he open to work?' },
    ];

    const lastMessage = messages[messages.length - 1];
    const showFollowUps = !isThinking && !isListening && lastMessage?.role === 'assistant' && followUps.length > 0;

    return (
        <div className={cn('flex flex-col h-full', className)}>
            {/* Voice Mode UI - Compact controls at bottom, 3D bot is main focus in parent */}
            {mode === 'voice' ? (
                <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4 border-t border-border bg-background/50 backdrop-blur-sm">
                    {/* Control bar */}
                    <div className="flex items-center justify-center gap-4">
                        {/* Status */}
                        <div className="text-sm min-w-[104px] text-right" aria-live="polite">
                            {isListening ? (
                                <span className="text-primary font-medium">Listening…</span>
                            ) : isSpeaking ? (
                                <span className="text-accent font-medium">Speaking…</span>
                            ) : isThinking ? (
                                <span className="text-amber-500 font-medium">Thinking…</span>
                            ) : (
                                <span className="text-muted-foreground">Ready</span>
                            )}
                        </div>

                        {/* Mic */}
                        <Button
                            onClick={handleVoiceToggle}
                            size="lg"
                            disabled={!voiceSupported}
                            aria-label={isListening ? 'Stop listening and send' : 'Start voice input'}
                            title={isListening ? 'Stop and send' : 'Ask by voice'}
                            className={cn(
                                'rounded-full w-16 h-16 transition-all duration-300',
                                isListening
                                    ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/40 scale-110'
                                    : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30'
                            )}
                        >
                            {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                        </Button>

                        {/* Stop the answer, or toggle audio when nothing is playing */}
                        <div className="min-w-[104px] flex justify-start">
                            {isSpeaking ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={stopSpeaking}
                                    aria-label="Stop speaking"
                                    className="text-xs gap-1.5 rounded-full text-accent hover:text-accent"
                                >
                                    <Square className="w-3.5 h-3.5 fill-current" />
                                    Stop
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                                    aria-label={voiceEnabled ? 'Mute answers' : 'Unmute answers'}
                                    className={cn(
                                        'text-xs gap-1.5 rounded-full',
                                        voiceEnabled ? 'text-primary' : 'text-muted-foreground'
                                    )}
                                >
                                    {voiceEnabled ? (
                                        <>
                                            <Volume2 className="w-4 h-4" />
                                            Voice On
                                        </>
                                    ) : (
                                        <>
                                            <VolumeX className="w-4 h-4" />
                                            Voice Off
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Hint */}
                    <p className="text-xs text-muted-foreground text-center mt-3 min-h-[16px]">
                        {!voiceSupported
                            ? 'Voice input needs Chrome, Edge or Safari — switch to Text mode.'
                            : isListening
                                ? 'Speak naturally — I stop automatically when you pause.'
                                : isSpeaking
                                    ? 'Tap the mic to interrupt me.'
                                    : isThinking
                                        ? ' '
                                        : 'Tap the mic and ask about his projects, stack or experience.'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Text Mode: Messages Area */}
                    <div
                        className="flex-1 overflow-y-auto py-4 space-y-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent overscroll-contain"
                        role="log"
                        aria-live="polite"
                        aria-label="Conversation"
                    >
                        {/* Welcome Screen when no messages */}
                        {messages.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col items-center justify-center h-full px-4 py-8"
                            >
                                {/* Animated greeting */}
                                <motion.div
                                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 border-2 border-primary/30"
                                    animate={{ rotate: [0, 5, -5, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                                >
                                    <Sparkles className="w-8 h-8 text-primary" />
                                </motion.div>

                                <h3 className="text-lg font-bold mb-1">Hi there! 👋</h3>
                                <p className="text-sm text-muted-foreground text-center mb-6 max-w-[250px]">
                                    I&apos;m Hakkan&apos;s AI assistant. Ask me anything about his work!
                                </p>

                                {/* Suggestion chips */}
                                <div className="w-full space-y-2">
                                    <p className="text-xs text-muted-foreground text-center mb-3">Try asking:</p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {suggestions.map((suggestion, i) => (
                                            <motion.button
                                                key={i}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.1 }}
                                                onClick={() => sendMessage(suggestion.query)}
                                                className={cn(
                                                    'flex items-center gap-1.5 px-4 py-2.5 rounded-full',
                                                    'bg-muted/50 hover:bg-muted border border-border/50',
                                                    'text-xs font-medium transition-all duration-200',
                                                    'hover:scale-105 hover:border-primary/30',
                                                    'active:scale-95'
                                                )}
                                            >
                                                <suggestion.icon className="w-3.5 h-3.5 text-primary" />
                                                <span>{suggestion.label}</span>
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <AnimatePresence initial={false}>
                                {messages.map((message, index) => (
                                    <ChatMessage
                                        key={message.id}
                                        role={message.role}
                                        content={message.content}
                                        timestamp={message.timestamp}
                                        isLatest={index === messages.length - 1}
                                        messageType={message.messageType}
                                    />
                                ))}
                            </AnimatePresence>
                        )}

                        {/* Context-aware follow-ups for the latest answer */}
                        {showFollowUps && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-wrap gap-2 px-3 pt-2 pb-1"
                            >
                                {followUps.map((followUp) => (
                                    <button
                                        key={followUp}
                                        onClick={() => sendMessage(followUp)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-full text-xs font-medium',
                                            'bg-primary/10 hover:bg-primary/20 border border-primary/20',
                                            'text-foreground/90 transition-all duration-200',
                                            'hover:border-primary/40 active:scale-95'
                                        )}
                                    >
                                        {followUp}
                                    </button>
                                ))}
                            </motion.div>
                        )}

                        {/* Thinking indicator */}
                        {isThinking && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-3 px-4 py-3"
                            >
                                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center border-2 border-accent">
                                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                                </div>
                                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-muted-foreground">
                                    <span className="animate-pulse">Thinking...</span>
                                </div>
                            </motion.div>
                        )}

                        {/* Listening indicator */}
                        {isListening && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-3 px-4 py-3"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary animate-pulse">
                                    <Mic className="w-4 h-4 text-primary" />
                                </div>
                                <div className="bg-primary/10 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-primary border border-primary/30">
                                    <span>Listening... Speak now</span>
                                </div>
                            </motion.div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Text Mode: Input Area */}
                    <div className="border-t border-border bg-background/80 backdrop-blur-sm p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4">
                        {/* Voice Controls Row */}
                        {voiceSupported && (
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setVoiceEnabled(!voiceEnabled)}
                                        aria-label={voiceEnabled ? 'Mute spoken answers' : 'Unmute spoken answers'}
                                        className={cn(
                                            'text-xs gap-1.5 h-9 px-3', // Increased touch target
                                            voiceEnabled ? 'text-primary' : 'text-muted-foreground'
                                        )}
                                    >
                                        {voiceEnabled ? (
                                            <>
                                                <Volume2 className="w-4 h-4" />
                                                Voice On
                                            </>
                                        ) : (
                                            <>
                                                <VolumeX className="w-4 h-4" />
                                                Voice Off
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {/* Speaking indicator — also the stop control */}
                                {isSpeaking && (
                                    <motion.button
                                        type="button"
                                        onClick={stopSpeaking}
                                        aria-label="Stop speaking"
                                        title="Stop speaking"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex items-center gap-2 text-xs text-accent hover:opacity-80 transition-opacity"
                                    >
                                        <div className="flex gap-0.5">
                                            {[...Array(4)].map((_, i) => (
                                                <motion.div
                                                    key={i}
                                                    className="w-1 bg-accent rounded-full"
                                                    animate={{
                                                        height: ['8px', '16px', '8px'],
                                                    }}
                                                    transition={{
                                                        duration: 0.5,
                                                        repeat: Infinity,
                                                        delay: i * 0.1,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <span>Speaking — tap to stop</span>
                                    </motion.button>
                                )}
                            </div>
                        )}

                        {/* Input Form */}
                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <Input
                                ref={inputRef}
                                type="text"
                                placeholder={isListening ? 'Speak now... 🎤' : 'Ask me anything...'}
                                value={inputValue}
                                maxLength={400}
                                aria-label="Ask the assistant a question"
                                onChange={(e) => setInputValue(e.target.value)}
                                className="flex-1 border-2 border-foreground/20 focus:border-primary transition-colors text-base" // text-base prevents iOS zoom
                            />

                            {/* Microphone Button - Voice-to-Text */}
                            {voiceSupported && (
                                <Button
                                    type="button"
                                    variant={isListening ? 'default' : 'outline'}
                                    size="icon"
                                    onClick={handleTextModeVoice}
                                    className={cn(
                                        'border-2 transition-all w-10 h-10 shrink-0',
                                        isListening
                                            ? 'bg-primary border-primary animate-pulse'
                                            : 'border-foreground/20 hover:border-primary'
                                    )}
                                    title={isListening ? 'Stop listening' : 'Dictate your question'}
                                    aria-label={isListening ? 'Stop listening' : 'Dictate your question'}
                                >
                                    {isListening ? (
                                        <MicOff className="w-5 h-5" />
                                    ) : (
                                        <Mic className="w-5 h-5" />
                                    )}
                                </Button>
                            )}

                            {/* Send Button */}
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!inputValue.trim() || isListening}
                                className="border-2 border-foreground/20 w-10 h-10 shrink-0"
                            >
                                <Send className="w-5 h-5" />
                            </Button>
                        </form>

                        {/* Hint text */}
                        <p className="text-[10px] text-muted-foreground mt-2 text-center">
                            Ask about projects, skills, experience, or say &quot;help&quot; for more options
                        </p>
                    </div>
                </>
            )}
        </div>
    );
};

export default AssistantChat;
