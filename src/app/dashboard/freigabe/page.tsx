// src/app/dashboard/freigabe/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Landingpage = {
  id: number;
  url: string;
  haupt_keyword: string | null;
  weitere_keywords: string | null;
  suchvolumen: number | null;
  aktuelle_position: number | null;
  status: 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben';
  created_at: string;
};

export default function FreigabePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  
  const [landingpages, setLandingpages] = useState<Landingpage[]>([]);
  const [filteredPages, setFilteredPages] = useState<Landingpage[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('alle');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.id) {
      loadLandingpages();
      
      // Auto-Refresh alle 30 Sekunden
      const interval = setInterval(() => {
        loadLandingpages();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [authStatus, session?.user?.id]);

  useEffect(() => {
    if (filterStatus === 'alle') {
      setFilteredPages(landingpages);
    } else {
      setFilteredPages(landingpages.filter(lp => lp.status === filterStatus));
    }
  }, [filterStatus, landingpages]);

  const loadLandingpages = async () => {
    if (!session?.user?.id) return;
    
    try {
      const response = await fetch(`/api/users/${session.user.id}/landingpages`);
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data: Landingpage[] = await response.json();
      setLandingpages(data);
      setMessage('');
    } catch (error) {
      console.error('Fehler beim Laden:', error);
      setMessage('Fehler beim Laden der Landingpages');
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (landingpageId: number, newStatus: 'Freigegeben' | 'Gesperrt') => {
    try {
      const response = await fetch(`/api/landingpages/${landingpageId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Status-Update fehlgeschlagen');

      // Lokale Aktualisierung
      setLandingpages(prev => 
        prev.map(lp => lp.id === landingpageId ? { ...lp, status: newStatus } : lp)
      );

      setMessage(`Landingpage wurde ${newStatus === 'Freigegeben' ? 'freigegeben' : 'gesperrt'}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Status-Update:', error);
      setMessage('Fehler beim Ändern des Status');
    }
  };

  // Auth-Check
  if (authStatus === 'loading') {
    return <div className="p-8 text-center">Lade...</div>;
  }

  if (authStatus === 'unauthenticated' || session?.user?.role !== 'BENUTZER') {
    router.push('/');
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Offen': return 'bg-blue-100 text-blue-800';
      case 'In Prüfung': return 'bg-yellow-100 text-yellow-800';
      case 'Gesperrt': return 'bg-red-100 text-red-800';
      case 'Freigegeben': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Offen': return '📝';
      case 'In Prüfung': return '🔍';
      case 'Gesperrt': return '🚫';
      case 'Freigegeben': return '✅';
      default: return '📄';
    }
  };

  const pendingReviewCount = landingpages.filter(lp => lp.status === 'In Prüfung').length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Landingpages Freigabe</h1>
            <p className="text-gray-600 mt-2">
              Geben Sie Landingpages frei oder sperren Sie diese
            </p>
          </div>
          <Link
            href="/dashboard"
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
          >
            ← Zurück zum Dashboard
          </Link>
        </div>

        {/* Benachrichtigung für wartende Freigaben */}
        {pendingReviewCount > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md">
            <div className="flex items-center">
              <span className="text-2xl mr-3">⚠️</span>
              <div>
                <p className="font-semibold text-yellow-900">
                  {pendingReviewCount} Landingpage{pendingReviewCount > 1 ? 's' : ''} warten auf Ihre Freigabe
                </p>
                <p className="text-sm text-yellow-700">
                  Diese Seiten befinden sich in Prüfung und können freigegeben oder gesperrt werden.
                </p>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800 flex items-center">
            <span className="text-xl mr-3">ℹ️</span>
            {message}
          </div>
        )}

        {/* Filter */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus('alle')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'alle'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Alle ({landingpages.length})
          </button>
          <button
            onClick={() => setFilterStatus('In Prüfung')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'In Prüfung'
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
            }`}
          >
            🔍 In Prüfung ({landingpages.filter(lp => lp.status === 'In Prüfung').length})
          </button>
          <button
            onClick={() => setFilterStatus('Freigegeben')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'Freigegeben'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            ✅ Freigegeben ({landingpages.filter(lp => lp.status === 'Freigegeben').length})
          </button>
          <button
            onClick={() => setFilterStatus('Gesperrt')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'Gesperrt'
                ? 'bg-red-600 text-white'
                : 'bg-red-100 text-red-800 hover:bg-red-200'
            }`}
          >
            🚫 Gesperrt ({landingpages.filter(lp => lp.status === 'Gesperrt').length})
          </button>
          <button
            onClick={() => setFilterStatus('Offen')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'Offen'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
            }`}
          >
            📝 Offen ({landingpages.filter(lp => lp.status === 'Offen').length})
          </button>
        </div>

        {/* Landingpages-Liste */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Lade Landingpages...</p>
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow-md text-center">
            <p className="text-gray-500 text-lg">
              {landingpages.length === 0 
                ? '📭 Noch keine Landingpages vorhanden.'
                : `Keine Landingpages mit Status "${filterStatus}".`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPages.map((lp) => (
              <div 
                key={lp.id} 
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex items-start justify-between">
                  {/* Links: Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{getStatusIcon(lp.status)}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {lp.haupt_keyword || 'Kein Keyword'}
                        </h3>
                        <a
                          href={lp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900 text-sm break-all"
                        >
                          {lp.url}
                        </a>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                      {lp.suchvolumen && (
                        <div>
                          <span className="text-gray-500">Suchvolumen:</span>
                          <p className="font-semibold text-gray-900">
                            {lp.suchvolumen.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {lp.aktuelle_position && (
                        <div>
                          <span className="text-gray-500">Position:</span>
                          <p className="font-semibold text-gray-900">
                            {lp.aktuelle_position}
                          </p>
                        </div>
                      )}
                      {lp.weitere_keywords && (
                        <div>
                          <span className="text-gray-500">Weitere Keywords:</span>
                          <p className="font-semibold text-gray-900 truncate" title={lp.weitere_keywords}>
                            {lp.weitere_keywords}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rechts: Status & Aktionen */}
                  <div className="ml-6 text-right">
                    <div className="mb-4">
                      <span className={`px-4 py-2 text-sm font-semibold rounded-full ${getStatusColor(lp.status)}`}>
                        {lp.status}
                      </span>
                    </div>

                    {/* Aktions-Buttons nur bei "In Prüfung" oder bereits Freigegeben/Gesperrt */}
                    {lp.status === 'In Prüfung' && (
                      <div className="space-y-2">
                        <button
                          onClick={() => updateStatus(lp.id, 'Freigegeben')}
                          className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          ✅ Freigeben
                        </button>
                        <button
                          onClick={() => updateStatus(lp.id, 'Gesperrt')}
                          className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          🚫 Sperren
                        </button>
                      </div>
                    )}

                    {lp.status === 'Freigegeben' && (
                      <button
                        onClick={() => updateStatus(lp.id, 'Gesperrt')}
                        className="w-full bg-red-100 text-red-700 px-4 py-2 rounded-md hover:bg-red-200 font-medium transition-colors"
                      >
                        Sperren
                      </button>
                    )}

                    {lp.status === 'Gesperrt' && (
                      <button
                        onClick={() => updateStatus(lp.id, 'Freigegeben')}
                        className="w-full bg-green-100 text-green-700 px-4 py-2 rounded-md hover:bg-green-200 font-medium transition-colors"
                      >
                        Freigeben
                      </button>
                    )}

                    {lp.status === 'Offen' && (
                      <p className="text-sm text-gray-500 italic">
                        Wartet auf Bearbeitung
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info-Box unten */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <span>ℹ️</span> Hinweis zur Freigabe
          </h3>
          <ul className="text-sm text-blue-800 space-y-1 ml-6 list-disc">
            <li><strong>Offen:</strong> Die Landingpage wurde angelegt, aber noch nicht zur Prüfung freigegeben.</li>
            <li><strong>In Prüfung:</strong> Die Landingpage wartet auf Ihre Freigabe oder Sperrung.</li>
            <li><strong>Freigegeben:</strong> Sie haben die Landingpage freigegeben und sie kann veröffentlicht werden.</li>
            <li><strong>Gesperrt:</strong> Sie haben die Landingpage gesperrt. Sie wird nicht veröffentlicht.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
