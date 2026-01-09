// src/hooks/useDataMaxChat.ts
'use client';

import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface UseDataMaxChatOptions {
  projectId?: string;
  dateRange?: string;
  onError?: (error: string) => void;
}

export function useDataMaxChat(options: UseDataMaxChatOptions = {}) {
  const { projectId, dateRange = '30d', onError } = options;
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Suggested Questions laden
  const loadSuggestedQuestions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      params.set('dateRange', dateRange);

      const response = await fetch(`/api/ai/chat?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestedQuestions(data.questions || []);
      }
    } catch (error) {
      console.warn('Konnte Suggested Questions nicht laden:', error);
    }
  }, [projectId, dateRange]);

  // Nachricht senden
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Abbrechen falls noch ein Request läuft
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          projectId,
          dateRange,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Fehler: ${response.status}`);
      }

      // Suggested Questions aus Header extrahieren
      const suggestedHeader = response.headers.get('X-Suggested-Questions');
      if (suggestedHeader) {
        try {
          setSuggestedQuestions(JSON.parse(suggestedHeader));
        } catch {}
      }

      // Stream lesen
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Kein Response-Stream');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        // Update Message Content
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content: fullContent }
              : msg
          )
        );
      }

      // Streaming beenden
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, isStreaming: false }
            : msg
        )
      );

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request wurde abgebrochen - kein Fehler
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      
      // Fehler-Nachricht anzeigen
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                content: `❌ ${errorMessage}`,
                isStreaming: false,
              }
            : msg
        )
      );

      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [projectId, dateRange, isLoading, onError]);

  // Chat zurücksetzen
  const clearChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setIsLoading(false);
  }, []);

  // Letzte Nachricht abbrechen
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    isLoading,
    suggestedQuestions,
    sendMessage,
    clearChat,
    cancelRequest,
    loadSuggestedQuestions,
  };
}
