'use client';

/**
 * Chat Message Component
 * Individual message bubble for the assistant chat
 * Supports user, assistant, and system (error/info) messages
 */

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { User, Bot, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
    isLatest?: boolean;
    messageType?: 'normal' | 'error' | 'info';
}

const ChatMessage: React.FC<ChatMessageProps> = ({
    role,
    content,
    timestamp,
    isLatest = false,
    messageType = 'normal',
}) => {
    const isUser = role === 'user';
    const isSystem = role === 'system';
    const isError = messageType === 'error';

    // Lightweight markdown: links, bold and italic
    const formatContent = (text: string) => {
        const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
        const nodes: ReactNode[] = [];
        let cursor = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(text)) !== null) {
            if (match.index > cursor) nodes.push(text.slice(cursor, match.index));

            const [token, linkLabel, linkHref, boldText, italicText] = match;

            if (linkLabel && linkHref) {
                // Only allow schemes that make sense in a chat bubble
                const isSafe = /^(?:https?:|mailto:|tel:|#|\/)/i.test(linkHref);
                const isExternal = /^https?:/i.test(linkHref);
                nodes.push(
                    isSafe ? (
                        <a
                            key={`${match.index}-link`}
                            href={linkHref}
                            target={isExternal ? '_blank' : undefined}
                            rel={isExternal ? 'noopener noreferrer' : undefined}
                            className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                        >
                            {linkLabel}
                        </a>
                    ) : (
                        linkLabel
                    )
                );
            } else if (boldText) {
                nodes.push(
                    <strong key={`${match.index}-b`} className="font-semibold text-primary">
                        {boldText}
                    </strong>
                );
            } else if (italicText) {
                nodes.push(
                    <em key={`${match.index}-i`} className="italic opacity-80">
                        {italicText}
                    </em>
                );
            } else {
                nodes.push(token);
            }

            cursor = match.index + token.length;
        }

        if (cursor < text.length) nodes.push(text.slice(cursor));
        return nodes;
    };

    // System message (error/info)
    if (isSystem) {
        return (
            <motion.div
                initial={isLatest ? { opacity: 0, y: 10 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex gap-3 px-4 py-3"
            >
                {/* Icon */}
                <div
                    className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2',
                        isError
                            ? 'bg-destructive/10 text-destructive border-destructive/30'
                            : 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                    )}
                >
                    {isError ? (
                        <AlertCircle className="w-4 h-4" />
                    ) : (
                        <Info className="w-4 h-4" />
                    )}
                </div>

                {/* Message Bubble */}
                <div
                    className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm rounded-bl-sm border',
                        isError
                            ? 'bg-destructive/5 text-foreground border-destructive/20'
                            : 'bg-blue-500/5 text-foreground border-blue-500/20'
                    )}
                >
                    {/* Content with line breaks and formatting */}
                    <div className="whitespace-pre-wrap">
                        {content.split('\n').map((line, i) => {
                            const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                            const isEmoji = /^[\p{Emoji}]/u.test(line.trim());
                            return (
                                <span key={i} className={cn(isBullet ? 'block pl-1' : '', isEmoji && i === 0 ? 'text-base' : '')}>
                                    {formatContent(line)}
                                    {i < content.split('\n').length - 1 && <br />}
                                </span>
                            );
                        })}
                    </div>

                    {/* Timestamp */}
                    {timestamp && (
                        <div className="text-[10px] mt-1 opacity-60 text-left">
                            {new Date(timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        );
    }

    // User or Assistant message
    return (
        <motion.div
            initial={isLatest ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
                'flex gap-3 px-4 py-3',
                isUser ? 'flex-row-reverse' : 'flex-row'
            )}
        >
            {/* Avatar */}
            <div
                className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2',
                    isUser
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-accent/20 text-accent-foreground border-accent'
                )}
            >
                {isUser ? (
                    <User className="w-4 h-4" />
                ) : (
                    <Bot className="w-4 h-4" />
                )}
            </div>

            {/* Message Bubble */}
            <div
                className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
                    isUser
                        ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-sm'
                        : 'bg-muted/80 text-foreground rounded-bl-sm border border-border/50'
                )}
            >
                {/* Content with line breaks and formatting */}
                <div className="whitespace-pre-wrap">
                    {content.split('\n').map((line, i) => {
                        // Check for bullet points
                        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                        // Check for numbered lists
                        const isNumbered = /^\d+\./.test(line.trim());
                        return (
                            <span key={i} className={cn(isBullet || isNumbered ? 'block pl-1' : '')}>
                                {formatContent(line)}
                                {i < content.split('\n').length - 1 && <br />}
                            </span>
                        );
                    })}
                </div>

                {/* Timestamp */}
                {timestamp && (
                    <div
                        className={cn(
                            'text-[10px] mt-1 opacity-60',
                            isUser ? 'text-right' : 'text-left'
                        )}
                    >
                        {new Date(timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default ChatMessage;
