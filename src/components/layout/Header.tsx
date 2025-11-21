// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';
import { useState } from 'react';
import { 
  List, 
  X, 
  Briefcase, 
  CalendarCheck, 
  ShieldLock, 
  Speedometer2, 
  BoxArrowRight, 
  BoxArrowInRight 
} from 'react-bootstrap-icons';

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname(); 
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN'; 
  const isUser = session?.user?.role === 'BENUTZER'; 

  // ✅ Logo-Logik
  const defaultLogo = "/logo-data-peak.webp";
  const logoSrc = session?.user?.logo_url || defaultLogo;
  const priorityLoad = logoSrc === defaultLogo;

  if (pathname === '/login') { 
    return null;
  }

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-white shadow-md relative">
      <nav className="w-full px-6 py-3 flex justify-between items-center">

        {/* Linke Seite: Logo und Begrüßung */}
        <div className="flex items-center space-x-4">
          <Link href="/" onClick={handleLinkClick}>
            <div className="relative h-[45px] w-[180px]">
              <Image
                src={logoSrc}
                alt="Dashboard Logo"
                fill
                priority={priorityLoad}
                onError={(e) => { 
                  if (logoSrc !== defaultLogo) {
                    (e.target as HTMLImageElement).src = defaultLogo;
                  }
                }}
                className="object-contain"
                sizes="180px"
              />
            </div>
          </Link>

          {status === 'authenticated' && (
            <>
              <span className="text-gray-600 underline underline-offset-6 hidden md:block">
                Hallo, {session.user?.name ?? session.user?.email}
              </span>
            </>
          )}
        </div>

        {/* Rechte Seite (Desktop) */}
        <div className="hidden md:flex items-center space-x-4">
          {status === 'authenticated' && (
            <>
              <NotificationBell />
              {isAdmin && (
                <Link href="/" passHref>
                  <Button variant={pathname === '/' ? 'default' : 'outline'} className="gap-2">
                    <Briefcase size={16} />
                    Projekte
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin/redaktionsplan" passHref>
                  <Button variant={pathname === '/admin/redaktionsplan' ? 'default' : 'outline'} className="gap-2">
                    <CalendarCheck size={16} />
                    Redaktionspläne
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin" passHref>
                  <Button variant={pathname === '/admin' ? 'default' : 'outline'} className="gap-2">
                    <ShieldLock size={16} />
                    Admin-Bereich
                  </Button>
                </Link>
              )}
              {isUser && (
                <Link href="/" passHref>
                  <Button variant={pathname === '/' ? 'default' : 'outline'} className="gap-2">
                    <Speedometer2 size={16} />
                    Dashboard
                  </Button>
                </Link>
              )}
              {isUser && (
                <Link href="/dashboard/freigabe" passHref>
                  <Button variant={pathname === '/dashboard/freigabe' ? 'default' : 'outline'} className="gap-2">
                    <CalendarCheck size={16} />
                    Redaktionsplan
                  </Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => signOut({ callbackUrl: '/login' })} className="gap-2">
                <BoxArrowRight size={16} />
                Abmelden
              </Button>
            </>
          )}
          {status === 'unauthenticated' && (
             <Link href="/login" passHref>
               <Button variant="default" className="gap-2">
                 <BoxArrowInRight size={16} />
                 Anmelden
               </Button>
             </Link>
          )}
        </div>

        {/* Hamburger-Button (Mobilgeräte) */}
        <div className="md:hidden flex items-center">
          {status === 'authenticated' && <NotificationBell />}
          
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-600 hover:text-gray-900 p-2 ml-2"
            aria-label="Menü umschalten"
          >
            {isMobileMenuOpen ? <X size={28} /> : <List size={28} />}
          </button>
        </div>
      </nav>

      {/* Mobiles Dropdown-Menü */}
      {isMobileMenuOpen && status === 'authenticated' && (
        <div 
          className="md:hidden absolute top-full left-0 w-full bg-white shadow-lg border-t border-gray-100 z-50"
          onClick={handleLinkClick}
        >
          <div className="flex flex-col space-y-2 p-4">
            
            {isAdmin && (
              <>
                <Link href="/" passHref>
                  <Button variant={pathname === '/' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <Briefcase size={16} />
                    Projekte
                  </Button>
                </Link>
                <Link href="/admin/redaktionsplan" passHref>
                  <Button variant={pathname === '/admin/redaktionsplan' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <CalendarCheck size={16} />
                    Redaktionspläne
                  </Button>
                </Link>
                <Link href="/admin" passHref>
                  <Button variant={pathname === '/admin' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <ShieldLock size={16} />
                    Admin-Bereich
                  </Button>
                </Link>
              </>
            )}

            {isUser && (
              <>
                <Link href="/" passHref>
                  <Button variant={pathname === '/' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <Speedometer2 size={16} />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/dashboard/freigabe" passHref>
                  <Button variant={pathname === '/dashboard/freigabe' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <CalendarCheck size={16} />
                    Redaktionsplan
                  </Button>
                </Link>
              </>
            )}
            
            <hr className="my-2" />

            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => signOut({ callbackUrl: '/login' })}>
              <BoxArrowRight size={16} />
              Abmelden
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
