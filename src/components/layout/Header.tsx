// src/components/layout/Header.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { 
  List, 
  X, 
  BoxArrowRight, 
  Speedometer2, 
  Folder, 
  CalendarWeek, 
  Gear,
  Magic // Das Icon für das KI-Tool
} from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const user = session?.user;
  const role = user?.role;
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';

  // Helper für aktive Links
  const isActive = (path: string) => pathname === path;

  // Gemeinsame Link-Klassen
  const linkBaseClass = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200";
  const linkInactiveClass = "text-gray-600 hover:bg-gray-100 hover:text-indigo-600";
  const linkActiveClass = "bg-indigo-50 text-indigo-700 shadow-sm";

  const getLinkClass = (path: string) => 
    cn(linkBaseClass, isActive(path) ? linkActiveClass : linkInactiveClass);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-xl shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* --- LOGO --- */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                D
              </div>
              <span className="font-bold text-xl text-gray-800 tracking-tight hidden sm:block">
                Designare
              </span>
            </Link>
          </div>

          {/* --- DESKTOP NAVIGATION --- */}
          <nav className="hidden md:flex space-x-1 items-center">
            
            {/* Standard Links */}
            <Link href="/" className={getLinkClass('/')}>
              <Speedometer2 className="text-lg" />
              <span>Dashboard</span>
            </Link>

            {/* --- ADMIN BEREICH --- */}
            {isAdmin && (
              <>
                <div className="h-6 w-px bg-gray-200 mx-2" /> {/* Trennlinie */}
                
                <Link href="/admin/projects" className={getLinkClass('/admin/projects')}>
                  <Folder className="text-lg" />
                  <span>Projekte</span>
                </Link>

                <Link href="/admin/redaktionsplan" className={getLinkClass('/admin/redaktionsplan')}>
                  <CalendarWeek className="text-lg" />
                  <span>Redaktionspläne</span>
                </Link>

                {/* ✨ NEUER KI TOOL BUTTON ✨ */}
                <Link href="/admin/ki-tool" className={getLinkClass('/admin/ki-tool')}>
                  <Magic className="text-lg" />
                  <span>KI Tool</span>
                </Link>

                <Link href="/admin" className={getLinkClass('/admin')}>
                  <Gear className="text-lg" />
                  <span>Admin</span>
                </Link>
              </>
            )}
          </nav>

          {/* --- RECHTS: USER & MOBILE TOGGLE --- */}
          <div className="flex items-center gap-4">
            
            {/* User Dropdown / Info (Vereinfacht) */}
            {user ? (
              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-sm font-semibold text-gray-700 leading-none">
                    {user.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mt-1">
                    {role}
                  </span>
                </div>
                
                <button 
                  onClick={() => signOut()}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="Abmelden"
                >
                  <BoxArrowRight className="text-xl" />
                </button>
              </div>
            ) : (
              <Link href="/login" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                Anmelden
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

      {/* --- MOBILE MENU --- */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-xl">
          <div className="px-4 pt-2 pb-6 space-y-2">
            
            <div className="py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              Menü
            </div>
            
            <Link 
              href="/" 
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn("w-full", getLinkClass('/'))}
            >
              <Speedometer2 className="text-lg" />
              <span>Dashboard</span>
            </Link>

            {/* --- ADMIN MOBILE --- */}
            {isAdmin && (
              <>
                <div className="py-2 mt-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-t border-gray-100 pt-4">
                  Verwaltung
                </div>

                <Link 
                  href="/admin/projects" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn("w-full", getLinkClass('/admin/projects'))}
                >
                  <Folder className="text-lg" />
                  <span>Projekte</span>
                </Link>

                <Link 
                  href="/admin/redaktionsplan" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn("w-full", getLinkClass('/admin/redaktionsplan'))}
                >
                  <CalendarWeek className="text-lg" />
                  <span>Redaktionspläne</span>
                </Link>

                {/* ✨ NEUER KI TOOL BUTTON (MOBIL) ✨ */}
                <Link 
                  href="/admin/ki-tool" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn("w-full", getLinkClass('/admin/ki-tool'))}
                >
                  <Magic className="text-lg" />
                  <span>KI Content Tool</span>
                </Link>

                <Link 
                  href="/admin" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn("w-full", getLinkClass('/admin'))}
                >
                  <Gear className="text-lg" />
                  <span>Admin Bereich</span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
