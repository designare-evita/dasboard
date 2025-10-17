// src/components/layout/Footer.tsx

import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white shadow-inner mt-12 py-6">
      <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-s">
        <p>
          &copy; {currentYear} <a href="https://designare.at/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">Michael Kanda & Evita</a>. Jede Codezeile von Hand gestreichelt. Also bitte nicht klauen. Alle Rechte vorbehalten.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
