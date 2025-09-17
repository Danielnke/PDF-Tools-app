"use client";

import React, { useState } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function MainLayout({ children, showSidebar = true }: MainLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onMenuToggle={toggleMobileMenu} 
        isMobileMenuOpen={isMobileMenuOpen} 
      />
      
      <div className="flex">
        {showSidebar && (
          <Sidebar 
            isOpen={isMobileMenuOpen} 
            onClose={closeMobileMenu} 
          />
        )}
        
        <main
          className={cn(
            "flex-1 min-h-[calc(100vh-4rem)]",
            showSidebar ? "md:ml-64" : ""
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}