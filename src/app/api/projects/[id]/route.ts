// src/app/api/projects/[id]/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';
import { sql } from '@vercel/postgres';
import { User } from '@/types';

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    const change = ((current - previous) / previous) * 100;
    return Math.round(change * 10) / 10;
}

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const projectId = params.id;

    try {
        const { rows } = await sql<User>`
            SELECT gsc_site_url, ga4_property_id FROM users WHERE id = ${projectId}
        `;
        const project = rows[0];

        if (!project || !project.gsc_site_url || !project.ga4_property_id) {
            return NextResponse.json({ message: 'Projekt nicht gefunden oder unvollständig konfiguriert.' }, { status: 404 });
        }

        const today = new Date();
        // Daten von Google sind oft 2 Tage verzögert
        const endDateCurrent = new Date();
        endDateCurrent.setDate(today.getDate() - 2);
        const startDateCurrent = new Date(endDateCurrent);
        startDateCurrent.setDate(endDateCurrent.getDate() - 29); // Letzte 30 Tage

        // Vorheriger Zeitraum zum Vergleich
        const endDatePrevious = new Date(startDateCurrent);
        endDatePrevious.setDate(startDateCurrent.getDate() - 1);
        const startDatePrevious = new Date(endDatePrevious);
        startDatePrevious.setDate(endDatePrevious.getDate() - 29); // Davorliegende 30 Tage

        const [gscCurrent, gscPrevious, gaCurrent, gaPrevious] = await Promise.all([
            getSearchConsoleData(project.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
            getSearchConsoleData(project.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
            getAnalyticsData(project.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
            getAnalyticsData(project.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious))
        ]);

        // ✅ KORREKTUR: Datenstruktur passend zur Frontend-Komponente erstellen
        const responseData = {
            kpis: {
                clicks: {
                    value: gscCurrent.clicks.total,
                    change: calculateChange(gscCurrent.clicks.total, gscPrevious.clicks.total),
                },
                impressions: {
                    value: gscCurrent.impressions.total,
                    change: calculateChange(gscCurrent.impressions.total, gscPrevious.impressions.total),
                },
                sessions: {
                    value: gaCurrent.sessions.total,
                    change: calculateChange(gaCurrent.sessions.total, gaPrevious.sessions.total),
                },
                totalUsers: {
                    value: gaCurrent.totalUsers.total,
                    change: calculateChange(gaCurrent.totalUsers.total, gaPrevious.totalUsers.total),
                },
            },
            charts: {
                clicks: gscCurrent.clicks.daily,
                impressions: gscCurrent.impressions.daily,
                sessions: gaCurrent.sessions.daily,
                totalUsers: gaCurrent.totalUsers.daily,
            }
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error(`Fehler in /api/projects/${projectId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter interner Fehler.';
        return NextResponse.json({ message: `Fehler beim Abrufen der Projektdaten: ${errorMessage}` }, { status: 500 });
    }
}
