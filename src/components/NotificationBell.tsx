// src/components/NotificationBell.tsx
'use client';

import { useState, useEffect, useCallback } from 'react'; // useCallback hinzugefügt
import { useSession } from 'next-auth/react';

// Icons importiert (ersetzt Emojis)
import {
  Bell,
  CheckCircleFill,
  ExclamationTriangleFill,
  InfoCircleFill,
  X,
  Check,
  ArrowRepeat,
  BellFill,
} from 'react-bootstrap-icons';

type Notification = {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
  created_at: string;
  related_landingpage_id: number | null;
};

export default function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Benachrichtigungen laden
  // KORREKTUR: Mit useCallback umschlossen
  const loadNotifications = useCallback(async () => {
    if (!session?.user?.id) return;

    // Nur beim ersten Öffnen laden, nicht beim Interval-Refresh
    if (notifications.length === 0) setIsLoading(true);
    
    try {
      const response = await fetch('/api/notifications');
      if (!response.ok) throw new Error('Fehler beim Laden');
      
      const data = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('Fehler beim Laden der Benachrichtigungen:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, notifications.length]); // Abhängigkeiten für useCallback

  // Initial und alle 30 Sekunden neu laden
  useEffect(() => {
    if (session?.user?.id) {
      loadNotifications();
      
      const interval = setInterval(() => {
        loadNotifications();
      }, 30000); // Alle 30 Sekunden
      
      return () => clearInterval(interval);
    }
  }, [session?.user?.id, loadNotifications]); // KORREKTUR: loadNotifications hinzugefügt

  const markAsRead = async (notificationId: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      });
      
      // Lokales Update
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Fehler beim Markieren:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true })
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Fehler:', error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE'
      });
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      // Prüfen, ob die gelöschte Notification ungelesen war
      const deletedWasUnread = notifications.find(n => n.id === notificationId)?.read === false;
      if (deletedWasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircleFill className="text-green-500" size={20}/>;
      case 'warning': return <ExclamationTriangleFill className="text-yellow-500" size={20}/>;
      default: return <InfoCircleFill className="text-blue-500" size={20}/>;
    }
  };

  // KORREKTUR: Unnötige Funktion getNotificationColor entfernt

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
    
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  if (!session?.user?.id) return null;

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        aria-label="Benachrichtigungen anzeigen"
      >
        <Bell size={24} />
        
        {/* Badge mit Anzahl ungelesener Benachrichtigungen */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">
              Benachrichtigungen {unreadCount > 0 && `(${unreadCount})`}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Alle als gelesen markieren
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
                <ArrowRepeat size={18} className="animate-spin" /> Lade...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <BellFill className="text-4xl text-gray-300 mx-auto" />
                <p className="text-gray-500 mt-2">Keine Benachrichtigungen</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    // KORREKTUR: getNotificationColor() entfernt, da minimalistisch
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notification.read ? 'font-semibold' : ''} text-gray-900`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-100"
                            title="Als gelesen markieren"
                          >
                            <Check size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100"
                          title="Löschen"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer (Optional, Link zu einer Übersichtsseite) */}
          {/*
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Alle Benachrichtigungen anzeigen
              </button>
            </div>
          )}
          */}
        </div>
      )}

      {/* Overlay zum Schließen */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
