"use client";

import React from "react";
import { LucideIcon, Merge, Split, Archive, FileText, Image as ImageIcon, Edit3, Shield, RotateCw, Eye, Lock, Unlock, Type } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  'merge': Merge,
  'split': Split,
  'archive': Archive,
  'file-text': FileText,
  'image': ImageIcon,
  'edit-3': Edit3,
  'shield': Shield,
  'rotate-cw': RotateCw,
  'eye': Eye,
  'rotate': RotateCw,
  'watermark': Type,
  'lock': Lock,
  'unlock': Unlock,
};

interface ToolCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
  features: string[];
  className?: string;
  onClick?: () => void;
}

export function ToolCard({
  title,
  description,
  icon,
  href,
  features,
  className,
  onClick
}: ToolCardProps) {
  const IconComponent = iconMap[icon] || FileText;
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Navigate to href
      window.location.href = href;
    }
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-300 animate-fade-in",
        className
      )}
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-lg">
            <IconComponent className="h-6 w-6 text-accent" />
          </div>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-muted text-sm leading-relaxed">{description}</p>
        
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="text-sm text-muted flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-accent rounded-full flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        
        <Button 
          className="w-full mt-4"
          variant="outline"
        >
          Use Tool
        </Button>
      </CardContent>
    </Card>
  );
}