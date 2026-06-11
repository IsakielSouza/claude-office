/**
 * Root da aplicação.
 *
 * Por decisão do CEO (2026-06-11), o sistema abre direto no Dashboard de
 * coordenação (visão de fluxo dos agentes), não mais no visualizador do
 * escritório. O escritório (Pixi) foi movido para /office e continua
 * acessível pela navegação.
 */

import { redirect } from "next/navigation";

export default function RootRedirect(): never {
  redirect("/dashboard");
}
