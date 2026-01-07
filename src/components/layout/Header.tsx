// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';
import { useState, useEffect } from 'react';
import { 
  List, 
  X, 
  Briefcase, 
  CalendarCheck, 
  ShieldLock, 
  Speedometer2, 
  BoxArrowRight, 
  BoxArrowInRight,
  HddNetwork,
  Magic
} from 'react-bootstrap-icons';

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname(); 
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Wartungsmodus-Check
  const [isInMaintenance, setIsInMaintenance] = useState(false);
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true);
  
  // ✅ NEU: KI-Tool Berechtigung
  const [kiToolEnabled, setKiToolEnabled] = useState(true);
  
  // ✅ NEU: Hat User Landingpages? (für Redaktionsplan-Button)
  const [hasLandingpages, setHasLandingpages] = useState(false);
  const [isCheckingLandingpages, setIsCheckingLandingpages] = useState(true);

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN'; 
  const isSuperAdmin = session?.user?.role === 'SUPERADMIN'; 
  const isUser = session?.user?.role === 'BENUTZER'; 

  // Logo-Logik
  const defaultLogo = "/logo-data-peak.webp";
  const logoSrc = session?.user?.logo_url || defaultLogo;
  const priorityLoad = logoSrc === defaultLogo;

  // Wartungsmodus-Status prüfen
  useEffect(() => {
    const checkMaintenanceStatus = async () => {
      if (status !== 'authenticated' || !session?.user) {
        setIsCheckingMaintenance(false);
        setIsInMaintenance(false);
        return;
      }

      if (session.user.role === 'SUPERADMIN') {
        setIsCheckingMaintenance(false);
        setIsInMaintenance(false);
        return;
      }

      try {
        const res = await fetch('/api/admin/maintenance?checkSelf=true');
        const data = await res.json();
        setIsInMaintenance(data.isInMaintenance === true);
      } catch (e) {
        console.error('Failed to check maintenance status:', e);
        setIsInMaintenance(false);
      } finally {
        setIsCheckingMaintenance(false);
      }
    };

    if (status !== 'loading') {
      checkMaintenanceStatus();
    }
  }, [session, status]);

  // ✅ NEU: KI-Tool Status prüfen
  useEffect(() => {
    const checkKiToolStatus = async () => {
      if (status !== 'authenticated' || !session?.user) {
        setKiToolEnabled(true);
        return;
      }

      // SUPERADMIN hat immer Zugriff
      if (session.user.role === 'SUPERADMIN') {
        setKiToolEnabled(true);
        return;
      }

      try {
        const res = await fetch('/api/admin/ki-tool-settings?checkSelf=true');
        const data = await res.json();
        setKiToolEnabled(data.kiToolEnabled !== false);
      } catch (e) {
        console.error('Failed to check KI-Tool status:', e);
        setKiToolEnabled(true); // Im Fehlerfall anzeigen
      }
    };

    if (status !== 'loading') {
      checkKiToolStatus();
    }
  }, [session, status]);

  // ✅ NEU: Landingpages-Check für BENUTZER
  useEffect(() => {
    const checkLandingpages = async () => {
      if (status !== 'authenticated' || !session?.user) {
        setIsCheckingLandingpages(false);
        setHasLandingpages(false);
        return;
      }

      // Admins sehen den Button immer (sie haben ja die Redaktionspläne)
      if (session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') {
        setIsCheckingLandingpages(false);
        setHasLandingpages(true);
        return;
      }

      // Für BENUTZER: Live-Check ob Landingpages existieren
      try {
        const res = await fetch('/api/user/has-landingpages');
        const data = await res.json();
        setHasLandingpages(data.hasLandingpages === true);
      } catch (e) {
        console.error('Failed to check landingpages:', e);
        setHasLandingpages(false);
      } finally {
        setIsCheckingLandingpages(false);
      }
    };

    if (status !== 'loading') {
      checkLandingpages();
    }
  }, [session, status]);

  // Login-Seite: Header nicht anzeigen
  if (pathname === '/login') { 
    return null;
  }

  // Wartungsmodus aktiv -> Header ausblenden
  if (isInMaintenance) {
    return null;
  }

  // Während der Prüfung Header nicht anzeigen (verhindert Flackern)
  if (isCheckingMaintenance && status === 'authenticated' && session?.user?.role !== 'SUPERADMIN') {
    return null;
  }

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  // ✅ Hilfsfunktion: Soll der KI-Tool Button angezeigt werden?
  const shouldShowKiTool = isAdmin && kiToolEnabled;

  // ✅ Hilfsfunktion: Soll der Redaktionsplan Button für User angezeigt werden?
  const shouldShowRedaktionsplanForUser = isUser && hasLandingpages && !isCheckingLandingpages;

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
              
              {/* ADMIN: Projekte */}
              {isAdmin && (
                <Link href="/" passHref>
                  <Button variant={pathname === '/' ? 'default' : 'outline'} className="gap-2">
                    <Briefcase size={16} />
                    Projekte
                  </Button>
                </Link>
              )}
              
              {/* ADMIN: Redaktionspläne (immer sichtbar für Admins) */}
              {isAdmin && (
                <Link href="/admin/redaktionsplan" passHref>
                  <Button variant={pathname === '/admin/redaktionsplan' ? 'default' : 'outline'} className="gap-2">
                    <CalendarCheck size={16} />
                    Redaktionspläne
                  </Button>
                </Link>
              )}
              
              {/* ✅ ADMIN: KI Tool Button (nur wenn aktiviert) */}
              {shouldShowKiTool && (
                <Link href="/admin/ki-tool" passHref>
                  <Button variant={pathname === '/admin/ki-tool' ? 'default' : 'outline'} className="gap-2">
                    <Magic size={16} />
                    KI Tool
                  </Button>
                </Link>
              )}

              {/* ADMIN: Admin-Bereich */}
              {isAdmin && (
                <Link href="/admin" passHref>
                  <Button variant={pathname === '/admin' ? 'default' : 'outline'} className="gap-2">
                    <ShieldLock size={16} />
                    Admin-Bereich
                  </Button>
                </Link>
              )}

              {/* SUPERADMIN: System */}
              {isSuperAdmin && (
                <Link href="/admin/system" passHref>
                  <Button 
                    variant={pathname === '/admin/system' ? 'default' : 'outline'} 
                    className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    title="System Status"
                  >
                    <HddNetwork size={16} />
                    <span className="hidden lg:inline">System</span>
                  </Button>
                </Link>
              )}

              {/* BENUTZER: Dashboard */}
              {isUser && (
                <Link href="/" passHref>
                  <Button variant={pathname === '/' ? 'default' : 'outline'} className="gap-2">
                    <Speedometer2 size={16} />
                    Dashboard
                  </Button>
                </Link>
              )}
              
              {/* ✅ BENUTZER: Redaktionsplan (nur wenn Landingpages vorhanden) */}
              {shouldShowRedaktionsplanForUser && (
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

                {/* ✅ KI Tool Button (Mobil) - nur wenn aktiviert */}
                {shouldShowKiTool && (
                  <Link href="/admin/ki-tool" passHref>
                    <Button variant={pathname === '/admin/ki-tool' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                      <Magic size={16} />
                      KI Tool
                    </Button>
                  </Link>
                )}

                <Link href="/admin" passHref>
                  <Button variant={pathname === '/admin' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <ShieldLock size={16} />
                    Admin-Bereich
                  </Button>
                </Link>

                {/* Mobile Link für Superadmin */}
                {isSuperAdmin && (
                  <Link href="/admin/system" passHref>
                    <Button variant={pathname === '/admin/system' ? 'default' : 'outline'} className="w-full justify-start gap-2 text-indigo-600 border-indigo-200 bg-indigo-50">
                      <HddNetwork size={16} />
                      System Status
                    </Button>
                  </Link>
                )}
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
                
                {/* ✅ Redaktionsplan für User (Mobil) - nur wenn Landingpages vorhanden */}
                {shouldShowRedaktionsplanForUser && (
                  <Link href="/dashboard/freigabe" passHref>
                    <Button variant={pathname === '/dashboard/freigabe' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                      <CalendarCheck size={16} />
                      Redaktionsplan
                    </Button>
                  </Link>
                )}
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
