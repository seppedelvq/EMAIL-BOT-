'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Mail, LayoutDashboard, Settings, Sparkles } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
export function AppSidebar() {
  const path = usePathname();
  const { setOpenMobile } = useSidebar();
  const [nl, setNl] = useState(true);
  useEffect(() => {
    const listener = (e: Event) => setNl((e as CustomEvent).detail !== 'en');
    window.addEventListener('assistant-language', listener);
    return () => window.removeEventListener('assistant-language', listener);
  }, []);
  return (
    <Sidebar className="border-r border-[#e2e9e5]">
      <SidebarHeader className="px-6 py-8">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#174f40] text-white">
            <Mail size={22} />
          </span>
          <span className="text-2xl font-semibold tracking-tight">
            post<span className="text-[#42856b]">.</span>
          </span>
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">AI Mail Assistant</p>
      </SidebarHeader>
      <SidebarContent className="px-3 py-5">
        <SidebarMenu>
          {[
            { href: '/dashboard', name: 'Dashboard', icon: LayoutDashboard },
            { href: '/emails', name: nl ? 'E-mails' : 'Emails', icon: Mail },
            {
              href: '/settings',
              name: nl ? 'Instellingen' : 'Settings',
              icon: Settings,
            },
          ].map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={path === item.href}
                className="h-12 px-4 data-[active=true]:bg-[#e1eee7] data-[active=true]:text-[#174f40]"
              >
                <Link href={item.href} onClick={() => setOpenMobile(false)}>
                  <item.icon />
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="m-4 rounded-xl bg-[#eaf1ed] p-4 text-sm">
        <Sparkles className="mb-2 text-[#31745b]" size={20} />
        <b>{nl ? 'Meer rust. Meer overzicht.' : 'Less noise. More clarity.'}</b>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {nl
            ? 'Jij houdt de controle over je mailbox.'
            : 'You stay in control of your inbox.'}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
