import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Authenticated client — RLS kullanıcının token'ına göre çalışır
export function getSupabaseClient(req: Request) {
  const authHeader = req.headers.get('Authorization')!;
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

// Service role client — RLS bypass, admin işlemleri için
export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// Token'dan user bilgisini al
// Gateway zaten JWT'yi doğruladı (verify_jwt: true), tekrar auth API çağrısı yapmaya gerek yok
// ES256 token'ları eski supabase-js sürümlerinde auth.getUser() ile doğrulanamıyor
export async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Unauthorized');

  const token = authHeader.replace('Bearer ', '');

  // JWT payload'ı decode et (gateway zaten imzayı doğruladı)
  let payload: any;
  try {
    payload = JSON.parse(atob(token.split('.')[1]));
  } catch {
    throw new Error('Unauthorized');
  }

  if (!payload.sub) throw new Error('Unauthorized');

  const user = {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    app_metadata: payload.app_metadata,
    user_metadata: payload.user_metadata,
  };

  const supabase = getSupabaseClient(req);
  return { user, supabase };
}
