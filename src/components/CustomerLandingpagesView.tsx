// src/components/CustomerLandingpagesView.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

type Landingpage = {
  id: number;
  url: string;
  haupt_keyword: string | null;
  weitere_keywords: string | null;
  suchvolumen: number | null;
  aktuelle_position: number | null;
  status: string;
  created_at: string;
};

export default function CustomerLandingpagesView() {
  const { data: session } = useSession();
  const [landingpages, setLandingpages] = useState<Landingpage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session?.user?.id) {
      fetchLandingpages();
    }
  }, [session]);

  const fetchLandingpages = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/users/${session?.user?.id}/landingpages`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Fehler beim Laden');
      }
      
      const data = await response.json();
      setLandingpages(data.landingpages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden des Redaktionsplans.');
      console.error('Fehler beim Laden:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md mt-8">
        <h3 className="text-xl font-bold mb-4">Mein Redaktionsplan</h3>
        <div className="flex items-center space-x-2">
          <div className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
          <p className="text-gray-600">Lade Daten...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md mt-8">
        <h3 className="text-xl font-bold mb-4">Mein Redaktionsplan</h3>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (landingpages.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md mt-8">
        <h3 className="text-xl font-bold mb-4">Mein Redaktionsplan</h3>
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-600 mb-2">Noch keine Landingpages vorhanden.</p>
          <p className="text-sm text-gray-500">
            Ihr Administrator kann über die Bearbeitungsseite einen Redaktionsplan hochladen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-md mt-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">
          Mein Redaktionsplan
        </h3>
        <span className="text-sm text-gray-500">
          {landingpages.length} {landingpages.length === 1 ? 'Landingpage' : 'Landingpages'}
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                URL
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Haupt-Keyword
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Weitere Keywords
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Suchvolumen
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktuelle Pos.
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {landingpages.map((lp) => (
              <tr key={lp.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 text-sm">
                  <a 
                    href={lp.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {lp.url.length > 50 ? lp.url.substring(0, 50) + '...' : lp.url}
                  </a>
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {lp.haupt_keyword || '-'}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                  {lp.weitere_keywords || '-'}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {lp.suchvolumen ? lp.suchvolumen.toLocaleString('de-DE') : '-'}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {lp.aktuelle_position || '-'}
                </td>
                <td className="px-4 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    lp.status === 'approved' 
                      ? 'bg-green-100 text-green-800' 
                      : lp.status === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {lp.status === 'pending' ? 'Ausstehend' : 
                     lp.status === 'approved' ? 'Genehmigt' : 
                     lp.status === 'rejected' ? 'Abgelehnt' : lp.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
