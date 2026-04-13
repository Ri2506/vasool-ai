// Edge Function: send-receipt-sms
//
// Bridges the mobile app's offline SMS queue to MSG91's transactional SMS
// API. The app calls supabase.functions.invoke('send-receipt-sms') with
// a body like:
//   { org_id, to: '+91xxxxxxxxxx', message: '...', kind, ref_id }
//
// We call MSG91 v5 Flow API. Configure the secrets:
//   supabase secrets set MSG91_AUTH_KEY=<key>
//   supabase secrets set MSG91_SENDER_ID=<6-char sender id>
//   supabase secrets set MSG91_FLOW_ID=<flow id for VASOOL-AI-TXN>
//
// The flow template itself lives in the MSG91 dashboard and must contain
// a single `{#var#}` placeholder that receives the message body. We pick
// flow-based routing over the plain SMS endpoint so Indian DLT compliance
// stays intact (all transactional SMS must flow through an approved
// template since March 2021).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

type Payload = {
  org_id: string;
  to: string;
  message: string;
  kind?: string;
  ref_id?: string;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!payload.to || !payload.message) {
    return json({ error: 'Missing `to` or `message`' }, 400);
  }

  const authKey = Deno.env.get('MSG91_AUTH_KEY');
  const flowId = Deno.env.get('MSG91_FLOW_ID');
  const senderId = Deno.env.get('MSG91_SENDER_ID');

  // If secrets aren't set yet, run in dry-run mode so the app works end-
  // to-end in dev. Return ok=true with a `simulated: true` flag.
  if (!authKey || !flowId) {
    console.warn('[send-receipt-sms] MSG91 not configured, simulating send');
    return json({
      ok: true,
      simulated: true,
      to: payload.to,
      body: payload.message,
    });
  }

  try {
    const resp = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'authkey': authKey,
        'accept': 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        template_id: flowId,
        sender: senderId,
        short_url: '0',
        recipients: [
          {
            mobiles: payload.to.replace('+', ''),
            var: payload.message,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return json({ error: `MSG91 ${resp.status}: ${text}` }, 502);
    }

    const body = await resp.json();
    return json({ ok: true, msg91: body, ref_id: payload.ref_id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
