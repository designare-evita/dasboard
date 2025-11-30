// src/app/api/debug-auth/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Verhindert Caching, damit wir immer den aktuellen Status sehen

export async function GET() {
  const report: any = {
    status: 'checking',
    env_vars_found: [],
    errors: [],
    auth_method: 'none',
  };

  try {
    // 1. Check: Welche Variablen sind da? (Wir loggen NICHT die Werte, nur ob sie existieren)
    if (process.env.GOOGLE_CREDENTIALS) report.env_vars_found.push('GOOGLE_CREDENTIALS');
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) report.env_vars_found.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    if (process.env.GOOGLE_PRIVATE_KEY_BASE64) report.env_vars_found.push('GOOGLE_PRIVATE_KEY_BASE64');

    // 2. Versuch: Methode A (JSON String)
    if (process.env.GOOGLE_CREDENTIALS) {
      report.auth_method = 'JSON String (GOOGLE_CREDENTIALS)';
      try {
        const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        if (!creds.client_email) throw new Error('client_email fehlt im JSON');
        if (!creds.private_key) throw new Error('private_key fehlt im JSON');
        report.status = 'success';
        report.message = `Gültiges JSON gefunden für: ${creds.client_email}`;
      } catch (e: any) {
        report.status = 'error';
        report.errors.push(`JSON Parse Error: ${e.message}`);
      }
    } 
    // 3. Versuch: Methode B (Base64 Key + Email)
    else if (process.env.GOOGLE_PRIVATE_KEY_BASE64 && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      report.auth_method = 'Base64 Key (GOOGLE_PRIVATE_KEY_BASE64)';
      try {
        const key = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, 'base64').toString('utf-8');
        if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
          throw new Error('Der decodierte Key scheint kein gültiger Private Key zu sein (Header fehlt).');
        }
        report.status = 'success';
        report.message = `Gültiger Base64 Key gefunden für: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`;
      } catch (e: any) {
        report.status = 'error';
        report.errors.push(`Base64 Decode Error: ${e.message}`);
      }
    } 
    // 4. Keine Credentials
    else {
      report.status = 'error';
      report.errors.push('Keine Google Credentials in process.env gefunden.');
      report.tip = 'Hast du die .env Datei erstellt und den Server neu gestartet?';
    }

  } catch (error: any) {
    report.status = 'fatal_error';
    report.errors.push(error.message);
  }

  return NextResponse.json(report, { status: report.status === 'success' ? 200 : 500 });
}
