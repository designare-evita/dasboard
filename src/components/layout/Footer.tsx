// src/components/layout/Footer.tsx

import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white shadow-inner mt-12 py-6">
      <div className="max-w-7xl mx-auto px-4 text-center text-gray-500">
        <p>&copy; {currentYear} Michael Kanda & Evita. Alle Rechte vorbehalten.</p>
      </div>
    </footer>
  );
};

export default Footer;
