// Edge Function: create-checkout
//
// Creates a Razorpay order for the annual ₹1,999 Pro subscription. The
// mobile client opens the Razorpay checkout in a WebView with the
// returned order_id. On webhook success, we'll flip the org's plan to
// 'pro' (see create-checkout-webhook — deploy separately).
//
// Runs in dry-run mode when Razorpay secrets aren't set, so the app
// works end-to-end in dev.
//
// Body: { plan: 'pro', annual: true, amount_paise?: 199900 }

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

interface Body {
  plan?: string;
  annual?: boolean;
  amount_paise?: number;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const amountPaise = body.amount_paise ?? 199_900; // ₹1,999

  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

  // Dry run when secrets aren't configured
  if (!keyId || !keySecret) {
    return json({
      razorpay_configured: false,
      message: 'Razorpay keys not set. Configure RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET.',
      order_id: 'dryrun_' + crypto.randomUUID().slice(0, 8),
      amount: amountPaise,
    });
  }

  // Real Razorpay order creation
  const creds = btoa(`${keyId}:${keySecret}`);
  const resp = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: `vasool_pro_${Date.now()}`,
      notes: { plan: body.plan ?? 'pro', annual: body.annual ?? true },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    return json({ error: `Razorpay ${resp.status}: ${text}` }, 502);
  }
  const order = await resp.json();
  return json({
    razorpay_configured: true,
    order_id: order.id,
    amount: order.amount,
    key_id: keyId,
    currency: order.currency,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}
