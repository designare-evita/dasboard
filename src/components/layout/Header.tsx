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
  HddNetwork,
  Magic // [Neu] Import für das KI-Icon
} from 'react-bootstrap-icons';

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname(); 
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Rollen-Checks
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN'; 
  const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
  const isUser = session?.user?.role === 'BENUTZER'; 

  const defaultLogo = "/logo-data-peak.webp";
  const logoSrc = session?.user?.logo_url || defaultLogo;

  if (pathname === '/login') { 
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* LOGO LINK */}
          <div className="flex-shrink-0 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-8 h-8">
                 <Image 
                   src={logoSrc}
                   alt="Logo"
                   fill
                   className="object-contain"
                 />
              </div>
              <span className="font-bold text-xl text-gray-800 hidden sm:block">
                Designare
              </span>
            </Link>
          </div>

          {/* DESKTOP NAVIGATION */}
          <nav className="hidden md:flex items-center space-x-2">
             {/* Dashboard immer sichtbar für eingeloggte */}
             <Link href="/" passHref>
                <Button variant={pathname === '/' ? 'default' : 'ghost'} size="sm" className="gap-2">
                  <Speedometer2 size={16} />
                  Dashboard
                </Button>
             </Link>

             {/* ADMIN LINKS */}
             {isAdmin && (
               <>
                 <Link href="/admin/projects" passHref>
                    <Button variant={pathname.startsWith('/admin/projects') ? 'default' : 'ghost'} size="sm" className="gap-2">
                      <Briefcase size={16} />
                      Projekte
                    </Button>
                 </Link>

                 <Link href="/admin/redaktionsplan" passHref>
                    <Button variant={pathname.startsWith('/admin/redaktionsplan') ? 'default' : 'ghost'} size="sm" className="gap-2">
                      <CalendarCheck size={16} />
                      Redaktionsplan
                    </Button>
                 </Link>

                 {/* [Neu] KI TOOL BUTTON (Desktop) */}
                 <Link href="/admin/ki-tool" passHref>
                    <Button variant={pathname === '/admin/ki-tool' ? 'default' : 'ghost'} size="sm" className="gap-2">
                      <Magic size={16} />
                      KI Tool
                    </Button>
                 </Link>

                 <Link href="/admin" passHref>
                    <Button variant={pathname === '/admin' ? 'default' : 'ghost'} size="sm" className="gap-2">
                      <ShieldLock size={16} />
                      Admin
                    </Button>
                 </Link>
               </>
             )}
          </nav>

          {/* RECHTS: USER & MOBILE TOGGLE */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            
            {session ? (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Abmelden"
                className="hidden md:flex"
              >
                <BoxArrowRight size={20} />
              </Button>
            ) : (
              <Link href="/login">
                <Button variant="default" size="sm">Anmelden</Button>
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
            >
              {isMobileMenuOpen ? <X size={24} /> : <List size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 pt-2 pb-6 space-y-2">
            
            {/* ADMIN SECTION MOBILE */}
            {isAdmin && (
              <>
                <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">Verwaltung</div>
                
                <Link href="/admin/projects" passHref>
                  <Button variant={pathname.startsWith('/admin/projects') ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <Briefcase size={16} />
                    Projekte
                  </Button>
                </Link>

                <Link href="/admin/redaktionsplan" passHref>
                  <Button variant={pathname.startsWith('/admin/redaktionsplan') ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <CalendarCheck size={16} />
                    Redaktionsplan
                  </Button>
                </Link>

                {/* [Neu] KI TOOL BUTTON (Mobil) */}
                <Link href="/admin/ki-tool" passHref>
                  <Button variant={pathname === '/admin/ki-tool' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <Magic size={16} />
                    KI Tool
                  </Button>
                </Link>

                <Link href="/admin" passHref>
                  <Button variant={pathname === '/admin' ? 'default' : 'outline'} className="w-full justify-start gap-2">
                    <ShieldLock size={16} />
                    Admin Bereich
                  </Button>
                </Link>

                {/* SUPERADMIN EXTRA */}
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

            <hr className="my-2" />

            {/* LOGOUT MOBILE */}
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
