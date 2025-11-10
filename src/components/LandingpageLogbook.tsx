// src/components/LandingpageLogbook.tsx
'use client';

import useSWR from 'swr';
import { ClockHistory, PersonCircle } from 'react-bootstrap-icons';

interface LogEntry {
    id: number;
    user_email: string | null;
    action: string;
    timestamp: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LandingpageLogbookProps {
    landingpageId: number; // ID der Landingpage, für die Logs angezeigt werden sollen
}

export default function LandingpageLogbook({ landingpageId }: LandingpageLogbookProps) {
    const { data: logs, error, isLoading } = useSWR<LogEntry[]>(
        landingpageId ? `/api/landingpages/${landingpageId}/logs` : null,
        fetcher
    );

    const formatTimestamp = (ts: string) => {
        return new Date(ts).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="mt-4 border-t pt-4">
            <h4 className="text-md font-semibold mb-3 flex items-center gap-2 text-gray-700">
                <ClockHistory size={18} /> Logbuch
            </h4>
            {isLoading && <p className="text-sm text-gray-500">Lade Logs...</p>}
            {error && <p className="text-sm text-red-600">Fehler beim Laden der Logs.</p>}
            {logs && logs.length === 0 && <p className="text-sm text-gray-500 italic">Keine Einträge vorhanden.</p>}
            {logs && logs.length > 0 && (
                <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {logs.map((log) => (
                        <li key={log.id} className="text-xs border-b pb-2 last:border-b-0 last:pb-0">
                            <p className="text-gray-800">{log.action}</p>
                            <div className="flex items-center justify-between text-gray-500 mt-1">
                                <span className="flex items-center gap-1">
                                   <PersonCircle size={12}/> {log.user_email || 'System'}
                                </span>
                                <span>{formatTimestamp(log.timestamp)}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
