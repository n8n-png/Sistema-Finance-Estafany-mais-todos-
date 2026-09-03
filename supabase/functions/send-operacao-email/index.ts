import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

interface Body {
  to?: string[];
  subject?: string;
  html?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const to = Array.isArray(body.to) ? body.to.filter((e) => typeof e === 'string' && e.includes('@')) : [];
    const subject = typeof body.subject === 'string' ? body.subject.slice(0, 300) : '';
    const html = typeof body.html === 'string' ? body.html : '';

    if (to.length === 0 || !subject || !html) {
      return new Response(JSON.stringify({ error: 'to, subject e html são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    // Integração de e-mail ainda não conectada — devolve modo simulado.
    if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
      console.info('[simulado] e-mail não enviado (integração ausente)', { to, subject });
      return new Response(JSON.stringify({ simulated: true, to, subject }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'Crédito PJ MaisTODOS <onboarding@resend.dev>',
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Resend falhou [${response.status}]: ${errorBody}`);
      return new Response(
        JSON.stringify({ error: 'Falha no envio de e-mail', status: response.status, details: errorBody }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify({ simulated: false, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-operacao-email error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
