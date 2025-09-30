"use client";

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import PdfEditor from '@/components/edit-pdf/pdf-editor';

export default function EditPdfPage() {
  return (
    <MainLayout>
      <section className="py-10">
        <div className="mx-auto max-w-5xl px-4">
          <h1 className="text-2xl font-semibold mb-2">Edit PDF</h1>
          <p className="text-muted mb-6">Add text, draw, highlight, and shapes. Export as a flattened PDF. No upload to server.</p>
        </div>
        <PdfEditor />
      </section>
    </MainLayout>
  );
}
