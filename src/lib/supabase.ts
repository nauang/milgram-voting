import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Bucket utilizado para armazenar as imagens dos prisioneiros.
 */
export const CHARACTERS_BUCKET = "characters";

/**
 * Instância administrativa reutilizável do Supabase.
 */
let supabaseAdminClient: ReturnType<typeof createClient> | null = null;

/**
 * Retorna o cliente administrativo do Supabase Storage.
 *
 * IMPORTANTE:
 * - Esta função deve ser utilizada exclusivamente no servidor.
 * - A chave secreta nunca deve ser enviada ao navegador.
 * - A autenticação do administrador deve ser verificada
 *   antes de qualquer operação privilegiada.
 */
export function getSupabaseAdmin(): ReturnType<typeof createClient> {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  // Falha fechada quando a configuração estiver incompleta.
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Supabase Storage não configurado. " + "Defina SUPABASE_URL e SUPABASE_SECRET_KEY.",
    );
  }

  // Cliente administrativo sem persistência de sessão.
  // Nunca compartilhar esta instância com componentes client-side.
  supabaseAdminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseAdminClient;
}
