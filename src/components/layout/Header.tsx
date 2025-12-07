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

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN'; 
  const isSuperAdmin = session?.user?.role === 'SUPERADMIN'; 
  const isUser = session?.user?.role === 'BENUTZER'; 

  // NEU: Prüfen, ob der Plan zugewiesen ist
  const hasRedaktionsplan = session?.user?.hasRedaktionsplan;

  // Logo-Logik
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
    <header className="bg-white border-b border-gray-200 h-16 fixed top-0 w-full z-50">
      <div className="flex items-center justify-between px-6 h-full max-w-[1920px] mx-auto">
        
        {/* Logo Bereich */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="relative h-8 w-auto aspect-[3/1]"> 
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

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-4">
          
          {/* Admin Navigation */}
          {isAdmin && (
            <nav className="flex items-center gap-1 mr-4">
              <Link href="/admin" passHref>
                <Button 
                  variant={pathname === '/admin' ? 'default' : 'ghost'} 
                  size="sm"
                  className="gap-2"
                >
                  <Briefcase size={16} />
                  Projekte
                </Button>
              </Link>
              
              <Link href="/admin/ki-tool" passHref>
                <Button 
                  variant={pathname === '/admin/ki-tool' ? 'default' : 'ghost'} 
                  size="sm"
                  className="gap-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                >
                  <Magic size={16} />
                  KI Tool
                </Button>
              </Link>
              
              <Link href="/admin/redaktionsplan" passHref>
                <Button 
                  variant={pathname.startsWith('/admin/redaktionsplan') ? 'default' : 'ghost'} 
                  size="sm"
                  className="gap-2"
                >
                  <CalendarCheck size={16} />
                  Redaktionsplan
                </Button>
              </Link>

              {/* Superadmin Link */}
              {isSuperAdmin && (
                <Link href="/admin/system" passHref>
                  <Button 
                    variant={pathname === '/admin/system' ? 'default' : 'ghost'} 
                    size="sm"
                    className="gap-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                  >
                    <HddNetwork size={16} />
                    System
                  </Button>
                </Link>
              )}
            </nav>
          )}

          {/* User Navigation */}
          {isUser && (
            <nav className="flex items-center gap-1 mr-4">
              <Link href="/" passHref>
                <Button 
                  variant={pathname === '/' ? 'default' : 'ghost'} 
                  size="sm"
                  className="gap-2"
                >
                  <Speedometer2 size={16} />
                  Dashboard
                </Button>
              </Link>
              
              {/* NEU: Button nur rendern, wenn hasRedaktionsplan true ist */}
              {hasRedaktionsplan && (
                <Link href="/dashboard/freigabe" passHref>
                  <Button 
                    variant={pathname === '/dashboard/freigabe' ? 'default' : 'ghost'} 
                    size="sm"
                    className="gap-2"
                  >
                    <CalendarCheck size={16} />
                    Redaktionsplan
                  </Button>
                </Link>
              )}
            </nav>
          )}

          {/* Rechte Seite: Glocke & Logout */}
          <div className="flex items-center gap-2 border-l pl-4 border-gray-200">
            {status === 'authenticated' ? (
              <>
                <NotificationBell />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-gray-500 hover:text-red-600"
                  title="Abmelden"
                >
                  <BoxArrowRight size={18} />
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="gap-2">
                  <BoxArrowInRight size={18} />
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2 text-gray-600"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <List size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-white border-b border-gray-200 shadow-lg p-4 flex flex-col gap-2 animate-in slide-in-from-top-2">
          
          <div className="flex flex-col gap-2" onClick={handleLinkClick}>
            {isAdmin && (
              <>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 mt-2">Admin Menü</div>
                <Link href="/admin" passHref>
                  <Button variant={pathname === '/admin' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <Briefcase size={16} />
                    Projekt Verwaltung
                  </Button>
                </Link>
                <Link href="/admin/ki-tool" passHref>
                  <Button variant={pathname === '/admin/ki-tool' ? 'default' : 'outline'} className="w-full justify-start gap-2 text-purple-600 border-purple-200 bg-purple-50">
                    <Magic size={16} />
                    KI Tool
                  </Button>
                </Link>
                <Link href="/admin/redaktionsplan" passHref>
                  <Button variant={pathname.startsWith('/admin/redaktionsplan') ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <CalendarCheck size={16} />
                    Redaktionsplan Manager
                  </Button>
                </Link>
                
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
                
                {/* NEU: Auch im Mobile Menu nur anzeigen, wenn hasRedaktionsplan true ist */}
                {hasRedaktionsplan && (
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
