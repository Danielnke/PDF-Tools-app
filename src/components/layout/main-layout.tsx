"use client";

import React, { useState, useCallback } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function MainLayout({ children, showSidebar = true }: MainLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((s) => !s);
  }, []);

  const closeSidebarOnMobile = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={toggleSidebar} isMobileMenuOpen={isSidebarOpen} />

      <div className="flex">
        {showSidebar && (
          <Sidebar isOpen={isSidebarOpen} onClose={closeSidebarOnMobile} />
        )}

        <main
          className={cn(
            "flex-1 min-h-[calc(100vh-4rem)] transition-[margin] duration-300",
            showSidebar && isSidebarOpen ? "md:ml-64" : "md:ml-0"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
