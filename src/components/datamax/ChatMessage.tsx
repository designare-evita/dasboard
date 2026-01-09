// src/components/datamax/ChatMessage.tsx
'use client';

import { motion } from 'framer-motion';
import { Robot, Person } from 'react-bootstrap-icons';
import type { ChatMessage as ChatMessageType } from '@/hooks/useDataMaxChat';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`
        w-8 h-8 rounded-full shrink-0
        flex items-center justify-center
        ${isUser 
          ? 'bg-gray-200 text-gray-600' 
          : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
        }
      `}>
        {isUser ? <Person size={14} /> : <Robot size={14} />}
      </div>

      {/* Bubble */}
      <div className={`
        max-w-[80%] px-4 py-2.5 rounded-2xl
        ${isUser 
          ? 'bg-indigo-600 text-white rounded-br-md' 
          : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
        }
      `}>
        {/* Content */}
        <div className={`
          text-sm leading-relaxed whitespace-pre-wrap
          ${message.isStreaming ? 'animate-pulse' : ''}
        `}>
          {message.content || (
            <span className="text-gray-400">Denke nach...</span>
          )}
        </div>

        {/* Timestamp */}
        <div className={`
          text-[10px] mt-1
          ${isUser ? 'text-white/60' : 'text-gray-400'}
        `}>
          {message.timestamp.toLocaleTimeString('de-DE', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </motion.div>
  );
}

export default ChatMessage;
