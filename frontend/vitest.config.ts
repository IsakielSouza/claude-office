import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Espelha o alias `@/* → ./src/*` do tsconfig.json para o vitest (que não lê
// tsconfig paths por padrão). Necessário desde que componentes testáveis passam
// a importar via `@/` transitivamente (ex.: OfficeMap → MeetingModal → Modal).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
