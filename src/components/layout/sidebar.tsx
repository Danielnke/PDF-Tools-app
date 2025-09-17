"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { 
  Merge, 
  Split, 
  Archive, 
  FileText, 
  Image as ImageIcon, 
  Edit3, 
  Shield, 
  RotateCw,
  Eye,
  Zap,
  Crop 
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const pdfTools = [
  {
    id: 'merge',
    title: 'Merge PDF',
    href: '/merge-pdf',
    icon: Merge,
    description: 'Combine multiple PDFs'
  },
  {
    id: 'split',
    title: 'Split PDF',
    href: '/split-pdf',
    icon: Split,
    description: 'Extract pages from PDF'
  },
  {
    id: 'compress',
    title: 'Compress PDF',
    href: '/compress-pdf',
    icon: Archive,
    description: 'Reduce PDF file size'
  },
  {
    id: 'crop',
    title: 'Crop PDF',
    href: '/crop-pdf',
    icon: Crop,
    description: 'Crop PDF pages'
  },
  {
    id: 'convert-pdf',
    title: 'Convert PDF',
    href: '/convert',
    icon: FileText,
    description: 'PDF to Word, Excel, etc.'
  },
  {
    id: 'convert-image',
    title: 'PDF ↔ Image',
    href: '/convert/image',
    icon: ImageIcon,
    description: 'Convert between PDF and images'
  },
  {
    id: 'edit',
    title: 'Edit PDF',
    href: '/edit-pdf',
    icon: Edit3,
    description: 'Add text and annotations'
  },
  {
    id: 'protect',
    title: 'Protect PDF',
    href: '/protect-pdf',
    icon: Shield,
    description: 'Add password protection'
  },
  {
    id: 'rotate',
    title: 'Rotate PDF',
    href: '/rotate-pdf',
    icon: RotateCw,
    description: 'Rotate PDF pages'
  },
  {
    id: 'viewer',
    title: 'PDF Viewer',
    href: '/viewer',
    icon: Eye,
    description: 'View PDF online'
  }
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] w-64 border-r border-border bg-background transition-transform duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-auto p-4">
            <div className="mb-4">
              <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight">
                PDF Tools
              </h2>
              <p className="px-2 text-sm text-muted">
                Choose a tool to get started
              </p>
            </div>
            
            <div className="space-y-2">
              {pdfTools.map((tool) => {
                const IconComponent = tool.icon;
                return (
                  <a
                    key={tool.id}
                    href={tool.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface transition-colors group"
                    onClick={onClose}
                  >
                    <IconComponent className="h-4 w-4 text-muted group-hover:text-accent transition-colors" />
                    <div className="flex-1">
                      <div className="font-medium">{tool.title}</div>
                      <div className="text-xs text-muted">{tool.description}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
          
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Zap className="h-4 w-4" />
              <span>Fast & Secure Processing</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}