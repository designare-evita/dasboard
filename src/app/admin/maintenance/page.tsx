// src/app/maintenance/page.tsx
'use client';

import React from 'react';
import { Tools, ConeStriped } from 'react-bootstrap-icons';
import Link from 'next/link';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl text-center border border-gray-100">
        <div className="mx-auto w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
          <ConeStriped className="text-amber-500 text-4xl" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Wartungsarbeiten</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Wir führen aktuell wichtige Updates am System durch, um die Plattform noch besser zu machen. 
          <br /><br />
          Das System ist in Kürze wieder für dich verfügbar.
        </p>

        <div className="text-sm text-gray-400 border-t pt-6">
          Admin Zugriff? <Link href="/login" className="text-amber-600 hover:underline font-medium">Hier einloggen</Link>
        </div>
      </div>
    </div>
  );
}
