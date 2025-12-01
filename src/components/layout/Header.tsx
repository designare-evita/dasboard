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
  BoxArrowInRight,
  HddNetwork // ✅ NEU: Icon importiert
} from 'react-bootstrap-icons';

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname(); 
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN'; 
  const isSuperAdmin = session?.user?.role === 'SUPERADMIN'; // ✅ NEU
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
        
        {/* LOGO BEREICH */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="relative h-10 w-auto aspect-[3/1]">
              <Image 
                src={logoSrc} 
                alt="Logo" 
                width={120} 
                height={40} 
                className="object-contain object-left"
                priority={priorityLoad}
              />
            </div>
          </Link>
        </div>

        {/* DESKTOP NAVIGATION */}
        <div className="hidden md:flex items-center gap-3">
          
          {/* Admin Links */}
          {isAdmin && (
            <>
              <Link href="/" passHref>
                <Button variant={pathname === '/' ? 'default' : 'ghost'} className="gap-2">
                  <Briefcase size={16} />
                  <span className="hidden lg:inline">Projekte</span>
                </Button>
              </Link>
              <Link href="/admin/redaktionsplan" passHref>
                <Button variant={pathname.startsWith('/admin/redaktionsplan') ? 'default' : 'ghost'} className="gap-2">
                  <CalendarCheck size={16} />
                  <span className="hidden lg:inline">Redaktionspläne</span>
                </Button>
              </Link>
              <Link href="/admin" passHref>
                <Button variant={pathname === '/admin' ? 'default' : 'ghost'} className="gap-2">
                  <ShieldLock size={16} />
                  <span className="hidden lg:inline">Admin</span>
                </Button>
              </Link>
            </>
          )}

          {/* User Links */}
          {isUser && (
            <>
              <Link href="/" passHref>
                <Button variant={pathname === '/' ? 'default' : 'ghost'} className="gap-2">
                  <Speedometer2 size={16} />
                  <span className="hidden lg:inline">Dashboard</span>
                </Button>
              </Link>
              <Link href="/dashboard/freigabe" passHref>
                <Button variant={pathname === '/dashboard/freigabe' ? 'default' : 'ghost'} className="gap-2">
                  <CalendarCheck size={16} />
                  <span className="hidden lg:inline">Redaktionsplan</span>
                </Button>
              </Link>
            </>
          )}

          <div className="h-6 w-px bg-gray-200 mx-1"></div>

          {/* ✅ NEU: System Button (Nur Superadmin) */}
          {isSuperAdmin && (
            <Link href="/admin/system" passHref>
              <Button 
                variant="ghost" 
                size="icon"
                className={`text-gray-500 hover:text-indigo-600 ${pathname === '/admin/system' ? 'bg-indigo-50 text-indigo-600' : ''}`}
                title="System Status"
              >
                <HddNetwork size={18} />
              </Button>
            </Link>
          )}

          {/* Notification Bell */}
          <NotificationBell />

          {/* Logout */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-gray-500 hover:text-red-600 hover:bg-red-50"
            title="Abmelden"
          >
            <BoxArrowRight size={18} />
          </Button>
        </div>

        {/* MOBILE MENU BUTTON */}
        <div className="md:hidden flex items-center gap-4">
          <NotificationBell />
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </nav>

      {/* MOBILE MENU DROPDOWN */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-100 shadow-lg p-4 animate-in slide-in-from-top-2">
          <div className="flex flex-col gap-2">
            
            {isAdmin && (
              <>
                <Link href="/" passHref onClick={handleLinkClick}>
                  <Button variant={pathname === '/' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <Briefcase size={16} />
                    Projekte Übersicht
                  </Button>
                </Link>
                <Link href="/admin/redaktionsplan" passHref onClick={handleLinkClick}>
                  <Button variant={pathname.startsWith('/admin/redaktionsplan') ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <CalendarCheck size={16} />
                    Redaktionspläne
                  </Button>
                </Link>
                <Link href="/admin" passHref onClick={handleLinkClick}>
                  <Button variant={pathname === '/admin' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <ShieldLock size={16} />
                    Admin-Bereich
                  </Button>
                </Link>

                {/* ✅ NEU: Mobile Link für Superadmin */}
                {isSuperAdmin && (
                  <Link href="/admin/system" passHref onClick={handleLinkClick}>
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
                <Link href="/" passHref onClick={handleLinkClick}>
                  <Button variant={pathname === '/' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <Speedometer2 size={16} />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/dashboard/freigabe" passHref onClick={handleLinkClick}>
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
