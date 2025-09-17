"use client";

import React from "react";
import { ToolCard } from "./tool-card";
import { PDFTool } from "@/types/pdf";

interface ToolGridProps {
  tools: PDFTool[];
  onToolSelect?: (toolId: string) => void;
}

export function ToolGrid({ tools, onToolSelect }: ToolGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {tools.map((tool, index) => (
        <div
          key={tool.id}
          className="animate-fade-in"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <ToolCard
            title={tool.title}
            description={tool.description}
            icon={tool.icon}
            href={tool.href}
            features={tool.features}
            onClick={() => onToolSelect?.(tool.id)}
          />
        </div>
      ))}
    </div>
  );
}