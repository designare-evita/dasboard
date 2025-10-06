'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { User } from '@/types';
import Link from 'next/link';

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [user, setUser] = useState<Partial<User>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (id) {
            const fetchUserData = async () => {
                const response = await fetch(`/api/users/${id}`);
                if (response.ok) {
                    const data = await response.json();
                    setUser(data);
                } else {
                    setMessage('Fehler beim Laden der Benutzerdaten.');
                }
                setIsLoading(false);
            };
            fetchUserData();
        }
    }, [id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setUser(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage('Speichere Änderungen...');

        const response = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
        });

        const result = await response.json();
        if (response.ok) {
            setMessage(`Erfolg! ${result.message}`);
            // Nach Erfolg zurück zur Admin-Übersicht navigieren
            setTimeout(() => router.push('/admin'), 1500);
        } else {
            setMessage(`Fehler: ${result.message}`);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center">Lade Benutzerdaten...</div>;
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <Header />

            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Kunden bearbeiten: {user.domain}</h2>
                    <Link href="/admin" className="text-sm text-blue-500 hover:underline">
                        &larr; Zurück zur Übersicht
                    </Link>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Kunden E-Mail</label>
                        <input name="email" type="email" value={user.email || ''} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Domain (z.B. kundendomain.at)</label>
                        <input name="domain" type="text" value={user.domain || ''} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">GSC Site URL (z.B. https://kundendomain.at/)</label>
                        <input name="gsc_site_url" type="text" value={user.gsc_site_url || ''} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">GA4 Property ID (nur die Nummer)</label>
                        <input name="ga4_property_id" type="text" value={user.ga4_property_id || ''} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <p className="text-xs text-gray-500">Das Ändern des Passworts ist auf dieser Seite nicht vorgesehen.</p>
                    <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">Änderungen speichern</button>
                </form>
                {message && <p className="mt-4 text-center">{message}</p>}
            </div>
        </div>
    );
}
