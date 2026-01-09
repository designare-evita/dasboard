// src/components/datamax/DataMaxChat.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Send, 
  ArrowClockwise, 
  StopFill,
  Robot
} from 'react-bootstrap-icons';
import { useDataMaxChat } from '@/hooks/useDataMaxChat';
import { ChatMessage } from './ChatMessage';
import { SuggestedQuestions } from './SuggestedQuestions';

interface DataMaxChatProps {
  projectId?: string;
  dateRange?: string;
  className?: string;
}

export function DataMaxChat({ projectId, dateRange = '30d', className = '' }: DataMaxChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isLoading,
    suggestedQuestions,
    sendMessage,
    clearChat,
    cancelRequest,
    loadSuggestedQuestions,
  } = useDataMaxChat({ projectId, dateRange });

  // Auto-scroll zu neuen Nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Suggested Questions beim Öffnen laden
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadSuggestedQuestions();
    }
  }, [isOpen, messages.length, loadSuggestedQuestions]);

  // Focus auf Input beim Öffnen
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleSuggestedClick = (question: string) => {
    sendMessage(question);
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full
          bg-gradient-to-br from-indigo-600 to-purple-600
          text-white shadow-lg shadow-indigo-500/30
          flex items-center justify-center
          hover:scale-110 hover:shadow-xl hover:shadow-indigo-500/40
          transition-all duration-200
          ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
          ${className}
        `}
        whileHover={{ rotate: [0, -10, 10, -10, 0] }}
        whileTap={{ scale: 0.95 }}
        aria-label="DataMax Chat öffnen"
      >
        <Robot size={24} />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="
              fixed bottom-6 right-6 z-50
              w-[420px] max-w-[calc(100vw-2rem)]
              h-[600px] max-h-[calc(100vh-6rem)]
              bg-white rounded-2xl shadow-2xl
              flex flex-col overflow-hidden
              border border-gray-200
            "
          >
            {/* Header */}
            <div className="
              px-4 py-3 
              bg-gradient-to-r from-indigo-600 to-purple-600
              text-white
              flex items-center justify-between
              shrink-0
            ">
              <div className="flex items-center gap-3">
                <div className="
                  w-10 h-10 rounded-full 
                  bg-white/20 backdrop-blur-sm
                  flex items-center justify-center
                ">
                  <Robot size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">DataMax</h3>
                  <p className="text-xs text-white/70">SEO & Analytics Assistent</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearChat}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Chat zurücksetzen"
                >
                  <ArrowClockwise size={16} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 ? (
                <SuggestedQuestions 
                  questions={suggestedQuestions}
                  onQuestionClick={handleSuggestedClick}
                  isLoading={isLoading}
                />
              ) : (
                messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form 
              onSubmit={handleSubmit}
              className="p-3 bg-white border-t border-gray-100 shrink-0"
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Frag DataMax..."
                  disabled={isLoading}
                  className="
                    flex-1 px-4 py-2.5
                    bg-gray-100 rounded-xl
                    text-sm text-gray-900
                    placeholder:text-gray-500
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/30
                    disabled:opacity-50
                    transition-all
                  "
                />
                {isLoading ? (
                  <button
                    type="button"
                    onClick={cancelRequest}
                    className="
                      p-2.5 rounded-xl
                      bg-red-500 text-white
                      hover:bg-red-600
                      transition-colors
                    "
                  >
                    <StopFill size={18} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="
                      p-2.5 rounded-xl
                      bg-indigo-600 text-white
                      hover:bg-indigo-700
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors
                    "
                  >
                    <Send size={18} />
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default DataMaxChat;
