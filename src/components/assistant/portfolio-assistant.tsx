'use client';

/**
 * Portfolio Assistant Main Component
 * Floating button with expandable chat panel
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { MessageCircle, X, Minimize2, Sparkles, MessageSquareText, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssistantProvider, useAssistant, speak } from '@/lib/assistant';
import { AssistantState } from '@/lib/assistant/assistant-context'; // Import type for state override
import AssistantChat from './assistant-chat';
import { cn } from '@/lib/utils';

// Lazy load 3D bot to avoid SSR issues
const Assistant3DBot = dynamic(() => import('./assistant-3d-bot'), {
    ssr: false,
    loading: () => (
        <div className="w-32 h-32 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 animate-pulse" />
        </div>
    ),
});

// ============ Inner Component (uses context) ============

type ChatMode = 'text' | 'voice';

const CHAT_MODE_KEY = 'hakkan_assistant_chat_mode';
const NUDGE_DISMISSED_KEY = 'hakkan_assistant_nudge_dismissed';
const NUDGE_SHOWN_KEY = 'hakkan_assistant_nudge_shown';

/** Two questions worth a single tap, shown on the nudge. */
const NUDGE_CHIPS = ['Show his projects', 'Is he open to work?'];

const readChatMode = (): ChatMode => {
    if (typeof window === 'undefined') return 'voice';
    try {
        return window.localStorage.getItem(CHAT_MODE_KEY) === 'text' ? 'text' : 'voice';
    } catch {
        return 'voice';
    }
};

const AssistantInner: React.FC = () => {
    const { isOpen, setIsOpen, state, voiceEnabled, messages, caption, sendMessage } = useAssistant();
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [chatMode, setChatModeState] = useState<ChatMode>('voice');

    // Remember how this visitor prefers to talk to the assistant.
    useEffect(() => {
        setChatModeState(readChatMode());
    }, []);

    const setChatMode = useCallback((mode: ChatMode) => {
        setChatModeState(mode);
        try {
            window.localStorage.setItem(CHAT_MODE_KEY, mode);
        } catch {
            // Private mode — the preference just won't persist.
        }
    }, []);
    const dragControls = useDragControls();
    const constraintsRef = useRef(null);

    // Local state to override global state for easter eggs (animating without chat context)
    const [overrideState, setOverrideState] = useState<AssistantState | null>(null);

    // Easter Egg: Shake Detection
    const lastMousePos = useRef({ x: 0, y: 0 });
    const shakeDistance = useRef(0);
    const lastShakeCheck = useRef(Date.now());
    const lastEasterEggTime = useRef(0);
    const shakeThreshold = 700; // Pixels moved in 700ms
    const shakeCheckInterval = 500;

    const handleBotMouseMove = (e: React.MouseEvent) => {
        // Don't process mouse events during speaking/thinking to prevent interruptions
        if (state === 'speaking' || state === 'thinking' || overrideState === 'speaking') {
            return;
        }

        // Track movement
        const currentPos = { x: e.clientX, y: e.clientY };
        const dist = Math.abs(currentPos.x - lastMousePos.current.x) + Math.abs(currentPos.y - lastMousePos.current.y);
        shakeDistance.current += dist;
        lastMousePos.current = currentPos;

        const now = Date.now();
        if (now - lastShakeCheck.current > shakeCheckInterval) {
            // Check if shaken enough
            if (shakeDistance.current > shakeThreshold) {
                triggerShakeEasterEgg();
            }
            // Reset window
            shakeDistance.current = 0;
            lastShakeCheck.current = now;
        }
    };

    const triggerShakeEasterEgg = () => {
        if (!voiceEnabled) return;

        const now = Date.now();
        // Cooldown: 5 seconds
        if (now - lastEasterEggTime.current < 5000) return;
        if (state === 'speaking' || overrideState === 'speaking') return; // Don't interrupt if already speaking

        lastEasterEggTime.current = now;

        const responses = [
            "Hey! What are you doing? I'm getting dizzy!",
            "Whoa whoa! Stop shaking me!",
            "Please stop cursor dancing on my face!",
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        // Speak without adding to chat history, but animate bot
        speak(
            randomResponse,
            () => setOverrideState(null),    // onEnd
            () => setOverrideState('speaking') // onStart
        );
    };

    // The assistant never takes over the screen on its own. Once the visitor
    // has actually engaged with the page, it offers a small, dismissible
    // nudge next to its button — tapping it is what opens the chat.
    const [showNudge, setShowNudge] = useState(false);

    const dismissNudge = useCallback((permanently: boolean) => {
        setShowNudge(false);
        if (!permanently) return;
        try {
            window.localStorage.setItem(NUDGE_DISMISSED_KEY, 'true');
        } catch {
            // Private mode — it just won't be remembered.
        }
    }, []);

    const openFromNudge = useCallback(
        (question?: string) => {
            setShowNudge(false);
            setIsOpen(true);
            if (!question) return;
            // A typed question deserves a readable answer, so land in text mode.
            setChatMode('text');
            // Let the panel mount before the question lands in it.
            setTimeout(() => sendMessage(question), 350);
        },
        [setIsOpen, sendMessage, setChatMode]
    );

    useEffect(() => {
        if (isOpen) return;

        try {
            if (window.localStorage.getItem(NUDGE_DISMISSED_KEY)) return;
            if (window.sessionStorage.getItem(NUDGE_SHOWN_KEY)) return;
        } catch {
            return;
        }

        let dwellTimer: NodeJS.Timeout;
        let hideTimer: NodeJS.Timeout;

        const show = () => {
            try {
                if (window.sessionStorage.getItem(NUDGE_SHOWN_KEY)) return;
                window.sessionStorage.setItem(NUDGE_SHOWN_KEY, 'true');
            } catch {
                return;
            }
            cleanup();
            setShowNudge(true);
            // It bows out by itself if ignored — no modal, no trap.
            hideTimer = setTimeout(() => setShowNudge(false), 13000);
        };

        const onScroll = () => {
            const scrollable = document.body.scrollHeight - window.innerHeight;
            if (scrollable > 0 && window.scrollY / scrollable > 0.18) show();
        };

        const cleanup = () => {
            window.removeEventListener('scroll', onScroll);
            if (dwellTimer) clearTimeout(dwellTimer);
        };

        // Whichever comes first: they've read a bit, or they've stayed a while.
        window.addEventListener('scroll', onScroll, { passive: true });
        dwellTimer = setTimeout(show, 25000);

        return () => {
            cleanup();
            if (hideTimer) clearTimeout(hideTimer);
        };
    }, [isOpen]);

    // Opening the chat retires the nudge for good.
    useEffect(() => {
        if (!isOpen) return;
        setShowNudge(false);
        try {
            window.localStorage.setItem(NUDGE_DISMISSED_KEY, 'true');
        } catch {
            // Ignore.
        }
    }, [isOpen]);

    // A bottom sheet that lets the page scroll behind it feels broken.
    useEffect(() => {
        if (!isMobile || !isOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMobile, isOpen]);

    // Check for mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Keyboard shortcut to toggle (Ctrl/Cmd + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(!isOpen);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, setIsOpen]);

    return (
        <>
            {/* Floating Trigger Button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
                    >
                        {/* Nudge: an offer, not an interruption */}
                        <AnimatePresence>
                            {showNudge && (
                                <motion.div
                                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                                    className="w-[min(17rem,calc(100vw-3rem))] rounded-2xl border border-border bg-background/95 backdrop-blur-md p-3 shadow-2xl"
                                >
                                    <div className="flex items-start gap-2">
                                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 border border-primary/30">
                                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => openFromNudge()}
                                            className="flex-1 text-left"
                                        >
                                            <p className="text-sm font-medium leading-snug">
                                                Need a quick answer about Hakkan?
                                            </p>
                                            <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                                                I know his projects, stack and experience.
                                            </p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => dismissNudge(true)}
                                            aria-label="Dismiss assistant suggestion"
                                            className="-mt-1 -mr-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>

                                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                                        {NUDGE_CHIPS.map((chip) => (
                                            <button
                                                key={chip}
                                                type="button"
                                                onClick={() => openFromNudge(chip)}
                                                className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium transition-colors hover:border-primary/50 hover:bg-primary/20"
                                            >
                                                {chip}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex items-center gap-3">
                            {/* Speech Bubble Tooltip - slides out from button */}
                            <motion.div
                                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                                animate={{
                                    opacity: [0, 1, 1, 0],
                                    x: [20, 0, 0, 20],
                                    scale: [0.9, 1, 1, 0.9]
                                }}
                                transition={{
                                    duration: 3,
                                    times: [0, 0.1, 0.85, 1],
                                    ease: "easeOut"
                                }}
                                className={cn(
                                    'relative whitespace-nowrap bg-background/95 backdrop-blur-sm border border-border rounded-2xl px-4 py-2.5 shadow-xl',
                                    'hidden sm:block',
                                    showNudge && 'sm:hidden'
                                )}
                            >
                                <span className="flex items-center gap-2 text-sm">
                                    <Sparkles className="w-3 h-3 text-primary" />
                                    <span className="font-medium">Ask anything about Hakkan!</span>
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-1 block text-center">
                                    Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+K</kbd>
                                </span>
                                {/* Triangle pointer with border - outer (border) + inner (fill) */}
                                <div className="absolute -right-[10px] top-1/2 -translate-y-1/2">
                                    {/* Outer triangle (border color) */}
                                    <div className="w-0 h-0 border-t-[10px] border-b-[10px] border-l-[10px] border-t-transparent border-b-transparent border-l-border" />
                                    {/* Inner triangle (background fill) - positioned over outer */}
                                    <div className="absolute top-[1px] left-[-11px] w-0 h-0 border-t-[9px] border-b-[9px] border-l-[9px] border-t-transparent border-b-transparent border-l-background" />
                                </div>
                            </motion.div>

                            {/* Button */}
                            <div className="relative">
                                <Button
                                    onClick={() => setIsOpen(true)}
                                    size="icon"
                                    className={cn(
                                        'rounded-full w-12 h-12',
                                        'bg-gradient-to-br from-primary to-primary/80',
                                        'hover:from-primary/90 hover:to-primary/70',
                                        'text-primary-foreground shadow-lg',
                                        'border border-primary/50',
                                        'transition-all duration-300 hover:scale-105 hover:shadow-xl',
                                        'group'
                                    )}
                                    title="Open Hakkan's Assistant (Ctrl+K)"
                                >
                                    <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                </Button>

                                {/* Subtle glow effect */}
                                <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulse pointer-events-none" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Constraints Wrapper for Desktop Dragging */}
                        {!isMobile && (
                            <div ref={constraintsRef} className="fixed inset-4 pointer-events-none z-40" />
                        )}

                        {/* Mobile scrim — dims the page and closes on tap */}
                        {isMobile && (
                            <motion.div
                                key="assistant-scrim"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                onClick={() => setIsOpen(false)}
                                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
                                aria-hidden="true"
                            />
                        )}
                        <motion.div
                            key="assistant-panel"
                            role="dialog"
                            aria-label="Hakkan's portfolio assistant"
                            drag={isMobile ? 'y' : true}
                            dragListener={false}
                            dragControls={dragControls}
                            dragConstraints={isMobile ? { top: 0, bottom: 0 } : constraintsRef}
                            dragElastic={isMobile ? { top: 0, bottom: 0.4 } : 0.05}
                            dragMomentum={false}
                            onDragEnd={(_event, info) => {
                                // A flick or a decent pull down dismisses the sheet.
                                if (isMobile && (info.offset.y > 110 || info.velocity.y > 650)) {
                                    setIsOpen(false);
                                }
                            }}
                            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.9, x: 20 }}
                            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, x: 0 }}
                            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.9, x: 20 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 24 }} // Smoother spring for mobile sheet
                            className={cn(
                                'fixed z-50 shadow-2xl overflow-hidden flex flex-col no-click-effect',
                                isMobile
                                    // Opaque: a translucent sheet lets the page bleed through and looks broken.
                                    ? 'bottom-0 left-0 right-0 h-[86dvh] max-h-[86dvh] rounded-t-3xl border-t border-border bg-background'
                                    : isMinimized
                                        ? 'bottom-6 right-6 w-80 h-16 rounded-2xl border-2 border-foreground bg-background/95 backdrop-blur-xl'
                                        : 'bottom-6 right-6 w-[400px] h-[600px] max-h-[80vh] rounded-2xl border-2 border-foreground bg-background/95 backdrop-blur-xl'
                            )}
                        >
                            {/* Mobile Drag Handle Visual */}
                            {isMobile && (
                                <div
                                    className="w-full flex justify-center pt-3 pb-1.5 touch-none cursor-grab active:cursor-grabbing"
                                    onPointerDown={(event) => dragControls.start(event)}
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Drag down to close"
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') setIsOpen(false);
                                    }}
                                >
                                    <div className="w-10 h-1.5 rounded-full bg-muted-foreground/40" />
                                </div>
                            )}

                            {/* Header */}
                            <div
                                onPointerDown={(e) => {
                                    if (!isMobile) dragControls.start(e);
                                }}
                                className={cn(
                                    "flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 select-none",
                                    isMobile && "pt-1", // Adjust padding since we have the handle
                                    !isMobile && "cursor-move"
                                )}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    {/* 3D Bot mini avatar with online indicator */}
                                    <div className="relative shrink-0">
                                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/30 flex items-center justify-center">
                                            <Assistant3DBot state={state} size="sm" className="w-12 h-12 scale-110" />
                                        </div>
                                        {/* Online indicator dot */}
                                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background">
                                            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-semibold flex items-center gap-2 truncate">
                                            <span className="truncate">Hakkan&apos;s Assistant</span>
                                            <span className="hidden sm:inline text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-md border border-amber-500/20 whitespace-nowrap">
                                                In Development
                                            </span>
                                        </h3>
                                        <p className="text-[10px] text-muted-foreground capitalize">
                                            {state === 'idle' ? 'Online' : state}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    {!isMobile && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setIsMinimized(!isMinimized)}
                                            className="h-8 w-8"
                                            title={isMinimized ? 'Expand' : 'Minimize'}
                                            aria-label={isMinimized ? 'Expand assistant' : 'Minimize assistant'}
                                        >
                                            <Minimize2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsOpen(false)}
                                        className="h-8 w-8"
                                        title="Close (Esc)"
                                        aria-label="Close assistant"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Mode Tabs */}
                            {!isMinimized && (
                                <div className="flex border-b border-border bg-muted/10" role="tablist" aria-label="Assistant mode">
                                    <button
                                        onClick={() => setChatMode('voice')}
                                        role="tab"
                                        aria-selected={chatMode === 'voice'}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all',
                                            chatMode === 'voice'
                                                ? 'text-primary border-b-2 border-primary bg-primary/5'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                                        )}
                                    >
                                        <Mic className="w-4 h-4" />
                                        <span>Voice</span>
                                    </button>
                                    <button
                                        onClick={() => setChatMode('text')}
                                        role="tab"
                                        aria-selected={chatMode === 'text'}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all',
                                            chatMode === 'text'
                                                ? 'text-primary border-b-2 border-primary bg-primary/5'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                                        )}
                                    >
                                        <MessageSquareText className="w-4 h-4" />
                                        <span>Text</span>
                                    </button>
                                </div>
                            )}

                            {/* Content */}
                            {!isMinimized && (
                                <div className="flex flex-1 overflow-hidden">
                                    {/* Voice Mode: 3D Bot as centerpiece */}
                                    {chatMode === 'voice' ? (
                                        <div className="flex-1 flex flex-col">
                                            {/* 3D Bot - Main Attraction */}
                                            <div
                                                className={cn(
                                                    "flex-1 min-h-0 flex items-center justify-center bg-gradient-to-b from-muted/10 to-background relative overflow-hidden",
                                                    // Disable pointer events during active states
                                                    (state === 'speaking' || state === 'thinking' || state === 'listening') && 'cursor-default'
                                                )}
                                                onMouseMove={(state === 'speaking' || state === 'thinking' || state === 'listening') ? undefined : handleBotMouseMove}
                                            >
                                                {/* Interaction blocker overlay during active states */}
                                                {(state === 'speaking' || state === 'thinking' || state === 'listening' || overrideState === 'speaking') && (
                                                    <div
                                                        className="absolute inset-0 z-50"
                                                        style={{ pointerEvents: 'all' }}
                                                        onMouseMove={(e) => e.stopPropagation()}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onMouseUp={(e) => e.stopPropagation()}
                                                    />
                                                )}

                                                {/* Background glow effect */}
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <div className={cn(
                                                        'w-48 h-48 rounded-full blur-3xl transition-all duration-500',
                                                        state === 'listening' ? 'bg-primary/20' :
                                                            state === 'speaking' ? 'bg-accent/20' :
                                                                state === 'thinking' ? 'bg-amber-500/20' :
                                                                    'bg-primary/10'
                                                    )} />
                                                </div>

                                                {/* 3D Bot - Shifts up when caption appears */}
                                                <div className={cn(
                                                    "relative z-10 pointer-events-none transition-transform duration-500 ease-out",
                                                    caption ? "-translate-y-10 md:-translate-y-12" : ""
                                                )}>
                                                    <Assistant3DBot
                                                        state={overrideState || state}
                                                        size="xl"
                                                        className="w-64 h-64 md:w-72 md:h-72"
                                                    />
                                                </div>

                                                {/* Live Caption / Subtitles */}
                                                <AnimatePresence>
                                                    {caption && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 20 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 10 }}
                                                            className="absolute bottom-2 left-0 right-0 flex justify-center z-40 px-4 pointer-events-none"
                                                        >
                                                            <div className={cn(
                                                                "bg-black/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/5 shadow-lg max-w-[90%] md:max-w-[70%] text-center transform transition-all",
                                                                caption.source === 'user' ? "border-emerald-500/30" : "border-yellow-500/30"
                                                            )}>
                                                                <p className={cn(
                                                                    "text-sm md:text-base font-medium leading-relaxed tracking-wide drop-shadow-md",
                                                                    // Movie subtitle font style
                                                                    caption.source === 'user' ? "text-emerald-200 italic" : "text-yellow-50 font-semibold"
                                                                )}
                                                                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                                                                >
                                                                    {caption.source === 'assistant' && (
                                                                        <span className="text-yellow-400 mr-2 text-xs">●</span>
                                                                    )}
                                                                    "{caption.text}"
                                                                </p>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                            </div>

                                            {/* Voice Controls Section */}
                                            <div className="shrink-0">
                                                <AssistantChat mode={chatMode} />
                                            </div>
                                        </div>
                                    ) : (
                                        /* Text Mode: Full-width chat */
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <AssistantChat mode={chatMode} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Backdrop for mobile */}
            <AnimatePresence>
                {isOpen && isMobile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/50 z-40"
                    />
                )}
            </AnimatePresence>
        </>
    );
};

// ============ Main Export (with Provider) ============

const PortfolioAssistant: React.FC = () => {
    return (
        <AssistantProvider>
            <AssistantInner />
        </AssistantProvider>
    );
};

export default PortfolioAssistant;
