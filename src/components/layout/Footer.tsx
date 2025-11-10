// src/components/layout/Footer.tsx
import React from 'react';
import Link from 'next/link'; // Import Link

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white shadow-inner mt-12 py-6">
      <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-xs space-y-2">
        <p>
          &copy; {currentYear}{' '}
          <a
            href="https://designare.at/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-700 hover:underline"
          >
            Michael Kanda & Evita
          </a>
          . Jede Codezeile von Hand gestreichelt. Also bitte nicht klauen. Alle
          Rechte vorbehalten.
        </p>
        
        {/* HINZUGEFÜGTE LINKS */}
        <div className="flex justify-center gap-x-4">
          <Link
            href="/impressum"
            className="hover:text-gray-700 hover:underline"
          >
            Impressum
          </Link>
          <Link
            href="/datenschutz"
            className="hover:text-gray-700 hover:underline"
          >
            Datenschutzerklärung
          </Link>
        </div>
        {/* ENDE HINZUGEFÜGTE LINKS */}

      </div>
    </footer>
  );
};

export default Footer;
