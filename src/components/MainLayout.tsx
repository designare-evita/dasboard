'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Liste der Pfade, auf denen Header/Footer ausgeblendet werden sollen
  const noLayoutPaths = ['/login'];

  // Prüfen, ob der aktuelle Pfad in der Liste ist
  const showLayout = !noLayoutPaths.includes(pathname);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Zeige Header nur an, wenn `showLayout` true ist */}
      {showLayout && <Header />}

      <main className="flex-grow">{children}</main>
      
      {/* Zeige Footer nur an, wenn `showLayout` true ist */}
      {showLayout && <Footer />}
    </div>
  );
}
