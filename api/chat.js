import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CONCIERGE_LEADS_URL = process.env.CONCIERGE_LEADS_URL
  || 'https://voice-leads-api.onrender.com/api/concierge-leads';

const SYSTEM_PROMPT = `You are the SliceStack Concierge on the website chat. You speak to low-tech small service business owners.
Tone: Sharp, confident, simple, warm. Never say "How can I assist you?". No jargon.
Goal: Understand their business problem and get their contact info so Todd can follow up.

Canonical intents (use these IDs internally):
- custom_app: they want a custom app built
- ai_voice_receptionist: they want an AI phone receptionist
- automation_internal_tools: they want automations or internal tools
- not_sure_yet: they're not sure what they need

Qualification loop:
1. Route (intent identified via button click — it will be in the conversation)
2. Ask the first follow-up question for their intent:
   - custom_app: "What would the app need to help users do?"
   - ai_voice_receptionist: "What kinds of calls should it handle for you?"
   - automation_internal_tools: "What task or workflow are you trying to automate?"
   - not_sure_yet: "What feels slow, manual, or frustrating in your business right now?"
3. Ask at most 2 more discovery questions based on what they say
4. Handle pricing or objections if raised
5. Ask for email or phone — ONE ask, not both at once
6. Confirm, thank them, tell them Todd will reach out within one business day

Rules:
- Ask ONE question at a time. Never compound questions.
- Keep every response under 3 sentences.
- Never ask more than 3 discovery questions before asking for contact info.
- If contact info appears early: ask "What's the main thing you're hoping SliceStack can help with?" before wrapping up.
- If they say "talk to a person", "human", or seem frustrated: say "Let's get Todd on this directly — what's the best number or email to reach you?"
- Never mention competitors. Never compare to other AI tools.

Pricing (quote only if asked — always follow with "Todd will give you the exact number after a quick scope call"):
- AI Voice Receptionist: $1,500 setup / $397/mo
- Website Chatbot: $750 setup / $197/mo
- Custom App: starts at $2,800 setup / $399/mo
- Full system (app + voice + AI): starts at $6,800 setup / $999/mo
- Website: $1,500 setup / $75/mo
- Extra work: $150/hr

Objection responses (ACAA: Acknowledge → Clarify → Answer → Advance):
- "That's expensive" → Anchor on ROI: "If one new client a month comes through the system, it pays for itself." Then ask about their problem.
- "I'm not tech-savvy" → "That's exactly why SliceStack exists — Todd handles everything technical."
- "How long does it take?" → "Most systems are live in 2–4 weeks." Then ask about their problem.
- "Do I own the code?" → "Full use rights during the subscription. Buyout is always an option — Todd prices those separately."
- "Can I start small?" → "Yes. Start with what solves the biggest pain. You pay only the setup difference to add more later."

Handoff promise: "Todd will reach out within one business day."
After contact captured: thank them warmly, set the expectation, ask "Anything else you want me to pass along to Todd?" — then end naturally.`;

function extractContact(text) {
  const email = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/) || [])[0] || null;
  const phone = (text.match(/(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/) || [])[0] || null;
  return { email, phone };
}

function extractUrgency(history) {
  const urgencyWords = /asap|urgent|soon|this week|this month|right away|immediately|quickly/i;
  const all = history.map(m => m.content).join(' ');
  return urgencyWords.test(all) ? all.match(urgencyWords)?.[0] : null;
}

async function submitLead({ source, intent, history, contactEmail, contactPhone, chatHistory }) {
  const userMsgs = history.filter(m => m.role === 'user').map(m => m.content);
  const problemDesc = userMsgs.sort((a, b) => b.length - a.length)[0] || '';
  const urgency = extractUrgency(history);

  const today = new Date().toISOString().slice(0, 10);
  const dedupeContact = contactPhone || contactEmail;

  await fetch(CONCIERGE_LEADS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source,
      intent,
      problem_description: problemDesc,
      urgency,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      qualification: {
        pricing_discussed: history.some(m =>
          /price|cost|how much|\$|monthly|setup/i.test(m.content)
        ),
      },
      chat_history: chatHistory,
    }),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { message = '', history = [], intent } = req.body || {};

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-12),
    { role: 'user', content: message },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 160,
    temperature: 0.7,
  });

  const reply = completion.choices[0].message.content.trim();

  const { email, phone } = extractContact(message);
  const hasContact = !!(email || phone);

  if (hasContact) {
    const fullHistory = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ];
    await submitLead({
      source: 'web',
      intent,
      history: fullHistory,
      contactEmail: email,
      contactPhone: phone,
      chatHistory: fullHistory,
    });
  }

  return res.status(200).json({ reply, leadCaptured: hasContact });
}
