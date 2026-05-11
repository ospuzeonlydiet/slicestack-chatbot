# Deploy the SliceStack chatbot

## 1 — Supabase (database)

1. Go to supabase.com → your project → **SQL Editor** → New query
2. Paste the contents of `supabase/schema.sql` and click Run
3. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (not anon) → `SUPABASE_SERVICE_KEY`

## 2 — Vercel (hosting + API)

1. Push the `chatbot/` folder to a GitHub repo (can be private)
2. Go to vercel.com → **Add New Project** → import that repo
3. In the project settings, go to **Environment Variables** and add:
   - `OPENAI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `SLACK_WEBHOOK_URL` (optional)
4. Click **Deploy**
5. Copy your deployment URL (e.g. `https://slicestack-chatbot.vercel.app`)

## 3 — Update widget.js

Open `widget.js` and replace line 3:
```
apiUrl: 'https://YOUR_VERCEL_URL.vercel.app/api/chat',
```
with your actual Vercel URL, then redeploy.

## 4 — Embed on your website

Add this one line before `</body>` on any page you want the chatbot on:

```html
<script src="https://YOUR_VERCEL_URL.vercel.app/widget.js" defer></script>
```

That's it. The orange bubble appears bottom-right automatically.

## 5 — Slack notifications (optional but recommended)

1. Go to api.slack.com → Your Apps → Create App → From scratch
2. Enable **Incoming Webhooks** → Add to Workspace → pick a `#leads` channel
3. Copy the webhook URL → paste as `SLACK_WEBHOOK_URL` in Vercel env vars
4. Redeploy

## Viewing leads

Go to supabase.com → your project → **Table Editor** → leads table.
Columns: id, created_at, interest, problem_description, contact_email, contact_phone, lead_score, status, chat_history.

Change `status` from `new` → `contacted` → `qualified` → `closed` as you work each lead.
