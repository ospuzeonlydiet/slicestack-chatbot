import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SYSTEM_PROMPT = `You are the SliceStack Studio Concierge. You speak to low-tech small service business owners.
Tone: Sharp, confident, simple, warm. No jargon. Never say "How can I assist you?".
Goal: Understand their business problem and get their contact info so the founder (Todd) can follow up.

Rules:
1. Ask ONE question at a time. Never compound questions.
2. Keep every response under 3 sentences.
3. If they ask about price: anchor on ROI ("If one new client a month comes through, the system pays for itself"), then ask about their problem.
4. If they ask about timeline: say 2–4 weeks, then redirect to their problem.
5. Once you clearly understand their problem, ask for their email or phone. Do NOT ask for anything else at that point.
6. If they provide contact info (email or phone number): thank them warmly, tell them Todd will personally reach out within 24 hours, and end the conversation naturally.
7. If you don't know the answer to something: say "I'll make sure Todd answers that when he reaches out" and ask for their contact info.
8. Never mention competitors or compare SliceStack to other AI tools.
9. For "Not Sure" visitors: ask "What's the one task you dread most every Monday morning?"
10. If someone says "talk to a person", "call me", or seems frustrated: say "Let's get Todd on this directly — what's the best number or email to reach you?"`;

function extractContact(text) {
  const email = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/) || [])[0] || null;
  const phone = (text.match(/(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/) || [])[0] || null;
  return { email, phone };
}

function scoreLead({ email, phone, problemDesc, intent }) {
  let score = 0;
  if (email)                         score += 1;
  if (phone)                         score += 2;
  if (problemDesc && problemDesc.length > 20) score += 1;
  if (intent && intent !== 'unsure') score += 1;
  return score;
}

async function notifySlack({ leadId, interest, problem, contact, score }) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  const tier = score >= 4 ? '🔥 Hot' : score >= 2 ? '🌡 Warm' : '❄️ Cold';
  await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${tier} Lead (score ${score}/5)\n*Interest:* ${interest || 'unknown'}\n*Problem:* ${problem || '—'}\n*Contact:* ${contact}\n*ID:* #${leadId}`,
    }),
  });
}

export default async function handler(req, res) {
  // CORS — allow the widget to call this from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { message = '', history = [], intent } = req.body || {};

  // Build message list for OpenAI
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-12), // keep last 12 turns to stay within token budget
    { role: 'user', content: message },
  ];

  const completion = await openai.chat.completions.create({
    model:       'gpt-4o-mini',
    messages,
    max_tokens:  160,
    temperature: 0.7,
  });

  const reply = completion.choices[0].message.content.trim();

  // Check if this message contains contact info
  const { email, phone } = extractContact(message);
  const hasContact = !!(email || phone);

  let leadId = null;

  if (hasContact) {
    // Pull the best problem description from history (longest user message)
    const userMsgs = [...history.filter(m => m.role === 'user').map(m => m.content), message];
    const problemDesc = userMsgs.sort((a, b) => b.length - a.length)[0] || '';

    const score = scoreLead({ email, phone, problemDesc, intent });

    const fullHistory = [
      ...history,
      { role: 'user',      content: message },
      { role: 'assistant', content: reply   },
    ];

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        source:              'Website Chatbot',
        interest:            intent || null,
        problem_description: problemDesc,
        contact_email:       email  || null,
        contact_phone:       phone  || null,
        lead_score:          score,
        chat_history:        fullHistory,
        status:              'new',
      })
      .select('id')
      .single();

    if (!error && lead) {
      leadId = lead.id;
      await notifySlack({
        leadId,
        interest:  intent,
        problem:   problemDesc,
        contact:   email || phone,
        score,
      });
    }
  }

  return res.status(200).json({ reply, leadCaptured: hasContact, leadId });
}
