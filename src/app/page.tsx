"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { ToolGrid } from "@/components/tool-cards/tool-grid";
import { Button } from "@/components/ui/button";
import { PDF_TOOLS } from "@/lib/constants/tools";
import { Upload, Download, Shield, FileText } from "lucide-react";

export default function Home() {
  const handleToolSelect = (toolId: string) => {
    const tool = PDF_TOOLS.find(t => t.id === toolId);
    if (tool?.href) {
      window.location.href = tool.href;
    }
  };

  return (
    <MainLayout showSidebar={false}>
      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            Free Online <span className="text-accent">PDF Tools</span>
          </h1>
          <p className="text-xl text-muted mb-8 max-w-2xl mx-auto">
            Merge, split, compress, convert, and edit PDF files online. 
            No registration required, completely free, and secure.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Get Started
            </Button>
            <Button variant="outline" size="lg">
              Browse Tools
            </Button>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section id="tools" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Choose Your PDF Tool
          </h2>
          <ToolGrid tools={PDF_TOOLS} onToolSelect={handleToolSelect} />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-12">Why Choose Our PDF Tools?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-success/10 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Shield className="h-8 w-8 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">100% Secure</h3>
              <p className="text-muted">Your files are processed securely and deleted automatically after processing.</p>
            </div>
            <div className="text-center">
              <div className="bg-accent/10 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Download className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Registration</h3>
              <p className="text-muted">Use all tools without creating an account or providing personal information.</p>
            </div>
            <div className="text-center">
              <div className="bg-warning/10 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileText className="h-8 w-8 text-warning" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">High Quality</h3>
              <p className="text-muted">Advanced algorithms ensure the best quality output for all operations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface border-t border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-6 w-6 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">PDF Tools</h3>
              </div>
              <p className="text-muted mb-4">
                The complete solution for all your PDF needs. Free, secure, and easy to use.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Tools</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted hover:text-foreground transition-colors">Merge PDF</a></li>
                <li><a href="#" className="text-muted hover:text-foreground transition-colors">Split PDF</a></li>
                <li><a href="#" className="text-muted hover:text-foreground transition-colors">Compress PDF</a></li>
                <li><a href="#" className="text-muted hover:text-foreground transition-colors">Convert PDF</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" className="text-muted hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-muted hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-muted hover:text-foreground transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center">
            <p className="text-muted">
              © 2024 PDF Tools. All rights reserved. Made with ❤️ for PDF enthusiasts.
            </p>
          </div>
        </div>
      </footer>
    </MainLayout>
  );
}