import React from 'react';

// Jede Layout-Datei muss die "children" Eigenschaft annehmen.
// "children" ist der Inhalt der page.tsx, der hier eingesetzt wird.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section>
      {/* Hier könnte später eine gemeinsame Navigation für das Dashboard hinkommen */}
      <nav>Dashboard Navigation</nav>
      
      {/* Hier wird der Inhalt der Seite (page.tsx) angezeigt */}
      {children}
    </section>
  );
}
