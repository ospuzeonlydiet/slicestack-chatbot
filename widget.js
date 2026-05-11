(function () {
  var CONFIG = {
    apiUrl: 'https://project-ix0ct.vercel.app/api/chat',
    primaryColor: '#e85d26',
  };

  var BUTTONS = [
    { id: 'app',      label: 'Build a Custom App' },
    { id: 'voice',    label: 'AI Voice Receptionist' },
    { id: 'automate', label: 'Automate My Operations' },
    { id: 'unsure',   label: 'Not Sure — I Need Ideas' },
  ];

  var WELCOME = "Hey! I'm the SliceStack concierge. What brings you here today?";

  var history = [];
  var intent  = null;
  var loading = false;
  var opened  = false;

  /* ── CSS ── */
  var css = document.createElement('style');
  css.textContent = [
    '#ss-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:#e85d26;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(232,93,38,.45);z-index:9999;transition:transform .2s;}',
    '#ss-bubble:hover{transform:scale(1.08);}',
    '#ss-bubble svg{width:26px;height:26px;fill:#fff;}',
    '#ss-panel{position:fixed;bottom:92px;right:24px;width:356px;max-height:520px;background:#fff;border-radius:16px;box-shadow:0 8px 48px rgba(0,0,0,.18);z-index:9998;display:flex;flex-direction:column;overflow:hidden;transform:scale(.95) translateY(10px);opacity:0;pointer-events:none;transition:transform .2s,opacity .2s;}',
    '#ss-panel.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',
    '#ss-head{background:#e85d26;padding:13px 16px;display:flex;align-items:center;gap:10px;}',
    '#ss-head .av{width:34px;height:34px;background:rgba(255,255,255,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}',
    '#ss-head .nm{font-size:14px;font-weight:600;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '#ss-head .st{font-size:11px;color:rgba(255,255,255,.75);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '#ss-head .info{flex:1;}',
    '#ss-x{cursor:pointer;color:rgba(255,255,255,.75);font-size:22px;line-height:1;padding:0 2px;font-family:sans-serif;}#ss-x:hover{color:#fff;}',
    '#ss-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;background:#f9f8f6;}',
    '.sm{max-width:86%;font-size:13px;line-height:1.55;padding:9px 13px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '.sm.bot{background:#fff;border:1px solid #e8e6e0;color:#1a1a18;align-self:flex-start;border-bottom-left-radius:3px;}',
    '.sm.usr{background:#e85d26;color:#fff;align-self:flex-end;border-bottom-right-radius:3px;}',
    '.sb-wrap{display:flex;flex-direction:column;gap:6px;width:100%;}',
    '.sb{background:#fff;border:1.5px solid #e85d26;color:#e85d26;padding:9px 13px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;text-align:left;transition:background .15s,color .15s;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '.sb:hover{background:#e85d26;color:#fff;}',
    '#ss-typing{display:flex;gap:4px;align-items:center;padding:10px 13px;background:#fff;border:1px solid #e8e6e0;border-radius:12px;border-bottom-left-radius:3px;align-self:flex-start;}',
    '#ss-typing span{width:6px;height:6px;background:#bbb;border-radius:50%;animation:ss-bop 1.2s infinite;}',
    '#ss-typing span:nth-child(2){animation-delay:.2s;}#ss-typing span:nth-child(3){animation-delay:.4s;}',
    '@keyframes ss-bop{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}',
    '#ss-inp-wrap{padding:10px 12px;border-top:1px solid #e8e6e0;display:none;gap:8px;background:#fff;align-items:flex-end;}',
    '#ss-inp-wrap.vis{display:flex;}',
    '#ss-inp{flex:1;border:1px solid #e8e6e0;border-radius:8px;padding:8px 11px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;resize:none;outline:none;max-height:80px;line-height:1.4;color:#1a1a18;}',
    '#ss-inp:focus{border-color:#e85d26;}',
    '#ss-send{width:34px;height:34px;background:#e85d26;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
    '#ss-send:hover{background:#d04e1f;}',
    '#ss-send svg{width:15px;height:15px;fill:#fff;}',
    '@media(max-width:400px){#ss-panel{width:calc(100vw - 32px);right:16px;bottom:82px;}}',
  ].join('');
  document.head.appendChild(css);

  /* ── DOM ── */
  var bubble = document.createElement('div');
  bubble.id  = 'ss-bubble';
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';

  var panel = document.createElement('div');
  panel.id  = 'ss-panel';
  panel.innerHTML = [
    '<div id="ss-head">',
      '<div class="av">⚡</div>',
      '<div class="info"><div class="nm">SliceStack Concierge</div><div class="st">Typically replies instantly</div></div>',
      '<div id="ss-x">×</div>',
    '</div>',
    '<div id="ss-msgs"></div>',
    '<div id="ss-inp-wrap">',
      '<textarea id="ss-inp" placeholder="Type your message..." rows="1"></textarea>',
      '<button id="ss-send"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>',
    '</div>',
  ].join('');

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  var msgsEl   = document.getElementById('ss-msgs');
  var inpWrap  = document.getElementById('ss-inp-wrap');
  var inp      = document.getElementById('ss-inp');
  var sendBtn  = document.getElementById('ss-send');

  /* ── helpers ── */
  function addMsg(text, role) {
    var d = document.createElement('div');
    d.className = 'sm ' + role;
    d.textContent = text;
    msgsEl.appendChild(d);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function showTyping() {
    var t = document.createElement('div');
    t.id  = 'ss-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    msgsEl.appendChild(t);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function hideTyping() {
    var t = document.getElementById('ss-typing');
    if (t) t.remove();
  }

  function showButtons() {
    var wrap = document.createElement('div');
    wrap.className = 'sb-wrap';
    BUTTONS.forEach(function (btn) {
      var b = document.createElement('button');
      b.className   = 'sb';
      b.textContent = btn.label;
      b.addEventListener('click', function () { onButtonClick(btn); });
      wrap.appendChild(b);
    });
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function onButtonClick(btn) {
    intent = btn.id;
    var wrap = msgsEl.querySelector('.sb-wrap');
    if (wrap) wrap.remove();
    addMsg(btn.label, 'usr');
    inpWrap.classList.add('vis');
    history.push({ role: 'user', content: btn.label });
    callAPI(btn.label);
  }

  function lockInput() {
    inp.disabled         = true;
    sendBtn.disabled     = true;
    inp.placeholder      = "We'll be in touch soon!";
  }

  async function callAPI(msg) {
    loading = true;
    showTyping();
    try {
      var res = await fetch(CONFIG.apiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: msg, history: history, intent: intent }),
      });
      var data = await res.json();
      hideTyping();
      addMsg(data.reply, 'bot');
      history.push({ role: 'assistant', content: data.reply });
      if (data.leadCaptured) lockInput();
    } catch (e) {
      hideTyping();
      addMsg("Something went wrong — try reaching us at hello@slicestackstudio.com", 'bot');
    }
    loading = false;
  }

  function sendMsg() {
    var text = inp.value.trim();
    if (!text || loading) return;
    inp.value = '';
    inp.style.height = 'auto';
    addMsg(text, 'usr');
    history.push({ role: 'user', content: text });
    callAPI(text);
  }

  function init() {
    msgsEl.innerHTML = '';
    history  = [];
    intent   = null;
    inp.disabled     = false;
    sendBtn.disabled = false;
    inp.placeholder  = 'Type your message...';
    inpWrap.classList.remove('vis');
    addMsg(WELCOME, 'bot');
    showButtons();
  }

  /* ── events ── */
  bubble.addEventListener('click', function () {
    opened = !opened;
    panel.classList.toggle('open', opened);
    if (opened && msgsEl.children.length === 0) init();
  });

  document.getElementById('ss-x').addEventListener('click', function () {
    opened = false;
    panel.classList.remove('open');
  });

  sendBtn.addEventListener('click', sendMsg);

  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });

  inp.addEventListener('input', function () {
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 80) + 'px';
  });
})();
