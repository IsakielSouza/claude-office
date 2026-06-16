"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CoordinationNav } from "@/components/coordination/CoordinationNav";
import { OpsPanel } from "@/components/ops/OpsPanel";

export default function ServidoresPage(): React.ReactNode {
  return (
    <main className="min-h-screen bg-neutral-950 text-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-orange-500">Claude</span> Servidores
        </h1>
        <Link
          href="/office"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft size={14} /> Voltar ao escritório
        </Link>
      </div>

      <CoordinationNav />

      <OpsPanel />
    </main>
  );
}
