import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const POLICY_VERSION = 'concierge_v1';

const SCORE_BANDS = { hot: [8, 10], warm: [5, 7], nurture: [3, 4], low: [0, 2] };

function scoreBand(score) {
  if (score >= 8) return 'hot';
  if (score >= 5) return 'warm';
  if (score >= 3) return 'nurture';
  return 'low';
}

function scoreLead({
  source,
  contactPhone,
  phoneConfirmed,
  contactEmail,
  intent,
  problemDescription,
  urgency,
  pricingDiscussed,
}) {
  let score = 0;
  if (contactPhone && phoneConfirmed)  score += 2;
  else if (contactPhone && source === 'voice') score += 1; // caller ID only
  else if (contactPhone)               score += 2; // web — typed = confirmed
  if (contactEmail)                    score += 1;
  if (intent && intent !== 'not_sure_yet') score += 2;
  if (intent === 'not_sure_yet' && problemDescription && problemDescription.length > 20) score += 1;
  if (problemDescription && problemDescription.length > 20) score += 1;
  if (urgency)                         score += 1;
  if (pricingDiscussed)                score += 1;
  return Math.min(score, 10);
}

async function notifySlack({ lead, score, band }) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  const emoji = { hot: '🔥', warm: '🌡', nurture: '🌱', low: '❄️' }[band] || '📋';
  const contact = lead.contact_phone || lead.contact_email || '—';
  const pricing = lead.qualification?.pricing_discussed ? 'Yes' : 'No';

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: [
        `${emoji} *New Lead* (${score}/10 — ${band})`,
        `*Source:* ${lead.source}`,
        `*Intent:* ${lead.intent || 'unknown'}`,
        `*Problem:* ${lead.problem_description || '—'}`,
        `*Contact:* ${contact}`,
        `*Pricing discussed:* ${pricing}`,
        `*Urgency:* ${lead.urgency || '—'}`,
        lead.handoff_summary ? `*Summary:* ${lead.handoff_summary}` : null,
      ].filter(Boolean).join('\n'),
    }),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const {
    source,                  // 'voice' | 'web'
    intent,                  // canonical intent ID
    problem_description,
    urgency,
    contact_email,
    contact_phone,
    contact_name,
    phone_confirmed,         // voice only — did Nina confirm it back?
    qualification = {},      // { human_requested, pricing_discussed, price_range_given, objections, out_of_scope_reason }
    utm = {},                // web only
    handoff_summary,
    chat_history,
  } = req.body || {};

  if (!source || !['voice', 'web'].includes(source)) {
    return res.status(400).json({ error: 'source must be "voice" or "web"' });
  }

  const score = scoreLead({
    source,
    contactPhone: contact_phone,
    phoneConfirmed: phone_confirmed ?? true,
    contactEmail: contact_email,
    intent,
    problemDescription: problem_description,
    urgency,
    pricingDiscussed: qualification.pricing_discussed,
  });

  const band = scoreBand(score);

  // Dedupe key — same phone or email within same day
  const today = new Date().toISOString().slice(0, 10);
  const dedupeContact = contact_phone || contact_email || null;
  const duplicate_key = dedupeContact ? `${dedupeContact}__${today}` : null;

  const leadPayload = {
    policy_version:      POLICY_VERSION,
    source,
    intent:              intent || null,
    problem_description: problem_description || null,
    urgency:             urgency || null,
    contact_email:       contact_email || null,
    contact_phone:       contact_phone || null,
    contact_name:        contact_name || null,
    lead_score:          score,
    score_band:          band,
    qualification,
    utm,
    duplicate_key,
    handoff_status:      'new',
    handoff_summary:     handoff_summary || null,
    chat_history:        chat_history || null,
  };

  const { data: lead, error } = await supabase
    .from('concierge_leads')
    .upsert(leadPayload, { onConflict: 'duplicate_key', ignoreDuplicates: false })
    .select('id')
    .single();

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: 'Failed to save lead' });
  }

  await notifySlack({ lead: { ...leadPayload, id: lead.id }, score, band });

  return res.status(200).json({ leadId: lead.id, score, score_band: band });
}
