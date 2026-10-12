$root = "C:\Users\Kingsley\OneDrive\Documents\love troll"

$html = @'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Home — VYBE</title>
<meta name="description" content="Your VYBE home: meet people, find mutual connections, and catch the gist.">
<meta name="theme-color" content="#FFF9F0">
<meta name="robots" content="noindex">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect x='2' y='2' width='36' height='36' rx='12' fill='%237357E8'/%3E%3Cpath d='M11 14l9 14 9-14' fill='none' stroke='%23FFD166' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="app-shell.css">
<link rel="stylesheet" href="home.css">
</head>
<body class="home-body">
<a class="skip" href="#main">Skip to content</a>
<header class="app-header">
  <div class="app-header-inner">
    <a class="logo" href="home.html" aria-label="VYBE home"><svg viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="12" fill="#7357E8" stroke="#211D2B" stroke-width="2.5"/><path d="M11 14l9 14 9-14" fill="none" stroke="#FFD166" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="31" cy="10" r="3" fill="#FF6B61"/></svg>VYBE</a>
    <nav class="app-nav" aria-label="Main navigation">
      <a class="app-nav-link" href="home.html" aria-current="page"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>Home</a>
      <a class="app-nav-link" href="#people"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>Meet people</a>
      <a class="app-nav-link" href="#connections"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 12.5 5 10a3 3 0 0 1 4.2-4.2l2.3 2.3 2.3-2.3A3 3 0 0 1 18 10l-6 6-1.5-1.5"/><path d="m4 15 3-3a2 2 0 0 1 2.8 0l1.2 1.2"/><path d="m5 18 2-2"/><path d="m8 20 2-2"/></svg>Connections</a>
      <span class="app-nav-soon" aria-label="Play, coming soon"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10a4 4 0 0 1 3.8 5.2l-1 3.3a2 2 0 0 1-3.3.9l-2-1.9h-5l-2 1.9a2 2 0 0 1-3.3-.9l-1-3.3A4 4 0 0 1 7 8Z"/><path d="M8 10v4M6 12h4M16 11h.01M18 13h.01"/></svg>Play<small>Soon</small></span>
      <span class="app-nav-soon" aria-label="Community, coming soon"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6a7.5 7.5 0 1 1 17-3.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg>Community<small>Soon</small></span>
      <a class="app-nav-link" href="onboarding.html"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>Profile</a>
    </nav>
    <button class="nav-logout app-logout" type="button" data-logout>Log out</button>
  </div>
</header>

<main class="home-main" id="main">
  <p class="home-status" data-home-status role="status" aria-live="polite" tabindex="-1" hidden></p>

  <section class="hero-board" aria-labelledby="welcome-title">
    <div class="hero-copy">
      <p class="home-eyebrow">YOUR CAMPUS LANE</p>
      <h1 id="welcome-title">Find your next good <span>vibe</span> before lecture ends.</h1>
      <p>Low-key chemistry, good people, and the kind of campus energy that turns into plans without forcing it.</p>
      <span class="greeting-tag" data-name-greeting></span>
      <div class="hero-actions">
        <a class="btn welcome-action" href="#people">Meet people</a>
        <a class="btn alt" href="#connections">See your matches</a>
      </div>
      <div class="mini-metrics" aria-label="VYBE stats">
        <div class="metric"><strong>12</strong><span>online now</span></div>
        <div class="metric"><strong>3</strong><span>fresh today</span></div>
        <div class="metric"><strong>1</strong><span>new plan</span></div>
      </div>
    </div>

    <div class="hero-visual" aria-hidden="true">
      <div class="visual-window"></div>
      <div class="floating-card accent-sun"><span>Campus mood</span><strong>Electric but easy</strong></div>
      <div class="floating-card accent-purple"><span>Live now</span><strong>Good people nearby</strong></div>
      <div class="floating-card accent-mint"><span>Tonight</span><strong>Something low-key</strong></div>
      <div class="online-pill"><span></span>6 people in your orbit</div>
    </div>
  </section>

  <section class="campus-grid" aria-label="Campus vibes overview">
    <article class="vibe-card vibe-main">
      <p class="home-eyebrow">MOOD BOARD</p>
      <h2>This is what the week feels like.</h2>
      <p>From class breaks to late-night gist, it’s all a little chaotic and a lot alive.</p>
    </article>
    <article class="vibe-card tone-coral"><span class="vibe-kicker">Good people</span><strong>Friendly faces and familiar rhythms.</strong></article>
    <article class="vibe-card tone-mint"><span class="vibe-kicker">Fresh finds</span><strong>New people, same energy, better stories.</strong></article>
    <article class="vibe-card tone-yellow"><span class="vibe-kicker">Your lane</span><strong>Low pressure, high potential.</strong></article>
  </section>

  <section class="home-section people-section" id="people" aria-labelledby="people-title">
    <div class="section-title">
      <div><p class="home-eyebrow">YOUR PEOPLE, YOUR PACE</p><h2 id="people-title">People you might click with</h2></div>
      <p class="people-note">No pressure. Just good energy.</p>
    </div>
    <p class="section-message" data-people-message role="status" aria-live="polite">Looking for people you might click with…</p>
    <ul class="suggestion-list" data-suggestions aria-label="Suggested VYBE members"></ul>
  </section>

  <div class="home-lower">
    <section class="connections-section" id="connections" aria-labelledby="connections-title">
      <div class="section-title">
        <div><p class="home-eyebrow">WHEN IT’S MUTUAL</p><h2 id="connections-title">Your connections</h2></div>
        <a class="text-link" href="#people">Meet people <span aria-hidden="true">→</span></a>
      </div>
      <p class="section-message" data-connections-message role="status" aria-live="polite">Checking your connections…</p>
      <ul class="connection-list" data-connections aria-label="Your mutual connections"></ul>
    </section>

    <aside class="conversation-card" aria-labelledby="conversation-title">
      <p class="home-eyebrow">A LITTLE HELP WITH THE FIRST “HEY”</p>
      <h2 id="conversation-title">Try this conversation starter</h2>
      <p class="conversation-prompt">“What’s your campus green flag?”</p>
      <a class="text-link" href="#people">Find someone to ask <span aria-hidden="true">→</span></a>
    </aside>
  </div>

  <div class="coming-soon-strip" aria-label="More of VYBE coming soon">
    <p>More of VYBE is on the way</p>
    <span>Play <small>Coming soon</small></span>
    <span>Community <small>Coming soon</small></span>
  </div>
</main>

<nav class="app-mobile-nav" aria-label="Main navigation">
  <a class="app-mobile-link" href="home.html" aria-current="page"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg><span>Home</span></a>
  <a class="app-mobile-link" href="#people"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><span>Meet people</span></a>
  <a class="app-mobile-link" href="#connections"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 12.5 5 10a3 3 0 0 1 4.2-4.2l2.3 2.3 2.3-2.3A3 3 0 0 1 18 10l-6 6-1.5-1.5"/><path d="m4 15 3-3a2 2 0 0 1 2.8 0l1.2 1.2"/><path d="m5 18 2-2"/><path d="m8 20 2-2"/></svg><span>Connect</span></a>
  <span class="app-mobile-soon" aria-label="Play, coming soon"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10a4 4 0 0 1 3.8 5.2l-1 3.3a2 2 0 0 1-3.3.9l-2-1.9h-5l-2 1.9a2 2 0 0 1-3.3-.9l-1-3.3A4 4 0 0 1 7 8Z"/><path d="M8 10v4M6 12h4M16 11h.01M18 13h.01"/></svg><span>Play</span></span>
  <span class="app-mobile-soon" aria-label="Community, coming soon"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6a7.5 7.5 0 1 1 17-3.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg><span>Community</span></span>
  <a class="app-mobile-link" href="onboarding.html"><svg class="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg><span>Profile</span></a>
</nav>

<script type="module" src="./home.js"></script>
</body>
</html>
'@

$css = @'
.home-body{min-height:100vh;background:radial-gradient(circle at top left, rgba(115,87,232,.12), transparent 30%),radial-gradient(circle at bottom right, rgba(255,107,97,.12), transparent 26%),linear-gradient(180deg, #fffaf3 0%, #fff7ef 42%, #fffdf9 100%)}
.home-main{width:min(1160px,calc(100% - 48px));margin:0 auto;padding:38px 0 90px}
.home-status,.section-message{color:var(--muted)}
.home-status{margin:0 0 18px}
.home-status[data-state=error],.section-message[data-state=error]{padding:12px 15px;border-left:3px solid #b3261e;background:#fff1ef;color:#8c1d15}
.hero-board{position:relative;display:grid;grid-template-columns:1.08fr .92fr;gap:26px;padding:28px;border:1.5px solid rgba(33,29,43,.12);border-radius:32px;background:linear-gradient(135deg,#fffdf9 0%,#f8f1ff 50%,#fff6ec 100%);box-shadow:0 28px 54px -34px rgba(33,29,43,.32);overflow:hidden}
.hero-board::before,.hero-board::after{content:"";position:absolute;border-radius:999px;pointer-events:none}
.hero-board::before{width:240px;height:240px;right:-72px;top:-82px;background:rgba(255,209,102,.38)}
.hero-board::after{width:190px;height:190px;left:-52px;bottom:-80px;background:rgba(189,235,215,.88)}
.hero-copy{position:relative;z-index:1;padding:12px 6px 2px}
.home-eyebrow{font-size:.74rem;font-weight:700;letter-spacing:.14em;color:#6047d0}
.hero-copy h1{margin:12px 0 10px;font-size:clamp(2.6rem,5vw,4.5rem);letter-spacing:-.08em;line-height:.92}
.hero-copy h1 span{display:block;color:#ff6b61}
.hero-copy>p:not(.home-eyebrow){max-width:560px;color:var(--muted);font-size:1.08rem}
.greeting-tag{display:inline-flex;align-items:center;gap:10px;margin-top:18px;padding:8px 12px;border:1px solid rgba(33,29,43,.12);border-radius:999px;background:rgba(255,255,255,.72);font:700 .74rem/1 var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--ink)}
.greeting-tag::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ecf9b;box-shadow:0 0 0 4px rgba(78,207,155,.18)}
.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.hero-actions .btn{box-shadow:none;border-radius:16px;padding:14px 18px;min-height:50px}
.hero-actions .btn.alt{background:rgba(255,255,255,.65);color:var(--ink);box-shadow:none}
.mini-metrics{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
.metric{min-width:122px;padding:12px 14px;border:1px solid rgba(33,29,43,.12);border-radius:16px;background:rgba(255,255,255,.54);backdrop-filter:blur(8px)}
.metric strong{display:block;font:800 1.5rem/1 var(--display);letter-spacing:-.06em}
.metric span{display:block;margin-top:5px;color:var(--muted);font-size:.76rem;text-transform:uppercase;letter-spacing:.08em}
.hero-visual{position:relative;min-height:355px;border:1px solid rgba(33,29,43,.12);border-radius:28px;background:linear-gradient(180deg,#f3e7ff 0%, #eafaf1 100%);overflow:hidden}
.visual-window{position:absolute;inset:16% 14% 16% 16%;border-radius:28px;background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.86), rgba(255,255,255,.12) 32%, rgba(33,29,43,.06) 100%);border:1px solid rgba(33,29,43,.1);box-shadow:inset 0 0 0 10px rgba(255,255,255,.25)}
.visual-window::before,.visual-window::after{content:"";position:absolute;inset:auto;display:block;border-radius:50%}
.visual-window::before{width:185px;height:185px;left:-35px;bottom:-55px;background:rgba(255,107,97,.22)}
.visual-window::after{width:140px;height:140px;right:-30px;top:-25px;background:rgba(255,209,102,.38)}
.floating-card{position:absolute;display:flex;flex-direction:column;gap:5px;padding:14px 14px 12px;border:1px solid rgba(33,29,43,.12);border-radius:18px;background:rgba(255,255,255,.82);box-shadow:0 20px 32px -28px rgba(33,29,43,.32);backdrop-filter:blur(5px)}
.floating-card span{font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5e536d}
.floating-card strong{font:800 1.1rem/1.2 var(--display);letter-spacing:-.04em}
.accent-sun{left:22px;top:18px;transform:rotate(-7deg);background:rgba(255,209,102,.9)}
.accent-purple{right:18px;top:64px;transform:rotate(7deg);background:rgba(235,228,255,.92)}
.accent-mint{left:34px;bottom:28px;transform:rotate(-5deg);background:rgba(189,235,215,.86)}
.online-pill{position:absolute;right:24px;bottom:26px;display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid rgba(33,29,43,.12);border-radius:999px;background:rgba(255,255,255,.8);font-size:.76rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.online-pill span{display:inline-block;width:8px;height:8px;border-radius:50%;background:#57d09b;box-shadow:0 0 0 4px rgba(87,208,155,.16)}
.campus-grid{display:grid;grid-template-columns:1.25fr .9fr .9fr .9fr;gap:16px;margin-top:24px}
.vibe-card{padding:20px 18px;border:1px solid rgba(33,29,43,.12);border-radius:24px;background:#fff;box-shadow:0 18px 32px -30px rgba(33,29,43,.32)}
.vibe-main{padding:24px 22px;background:linear-gradient(180deg,#f9f0ff 0%, rgba(255,255,255,.9) 100%)}
.vibe-main h2{margin-top:8px;font-size:clamp(1.8rem,2.7vw,2.6rem);letter-spacing:-.06em}
.vibe-main p{margin-top:10px;color:var(--muted);max-width:30ch}
.vibe-kicker{display:block;margin-bottom:8px;font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5d566b}
.vibe-card strong{display:block;font:800 1.18rem/1.2 var(--display);letter-spacing:-.04em}
.tone-coral{background:linear-gradient(180deg,#ffe8e4 0%, #fffefc 100%)}
.tone-mint{background:linear-gradient(180deg,#e6f6ee 0%, #fffefc 100%)}
.tone-yellow{background:linear-gradient(180deg,#fff3d4 0%, #fffefc 100%)}
.home-section{margin-top:42px}
.section-title{display:flex;align-items:end;justify-content:space-between;gap:20px}
.section-title h2,.connections-section h2,.conversation-card h2{margin-top:6px;font-size:clamp(1.8rem,3vw,2.4rem);letter-spacing:-.06em}
.text-link{display:inline-flex;align-items:center;gap:7px;color:#573ed0;font-weight:700;text-decoration:none}
.text-link:hover{text-decoration:underline;text-underline-offset:4px}
.text-link:focus-visible,.suggestion-actions button:focus-visible{outline:3px solid var(--purple);outline-offset:3px}
.people-note{color:var(--muted);font-size:.9rem}
.section-message{margin-top:14px}
.section-message:empty{display:none}
.section-message[data-state=success]{padding:12px 15px;border-left:3px solid #348363;background:#e8f5ee;color:#20563f}
.suggestion-list{list-style:none;padding:0;margin:20px 0 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.suggestion-card{min-width:0;overflow:hidden;border:1px solid rgba(33,29,43,.13);border-radius:22px;background:rgba(255,255,255,.72);box-shadow:0 22px 32px -30px rgba(33,29,43,.38);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
.suggestion-card:hover{transform:translateY(-4px);border-color:rgba(33,29,43,.2);box-shadow:0 18px 30px -20px rgba(33,29,43,.42)}
.suggestion-visual{height:150px;position:relative;display:flex;align-items:flex-end;padding:18px;overflow:hidden;background:linear-gradient(135deg,#efe7ff 0%,#f5f1ff 100%)}
.suggestion-card:nth-child(3n+2) .suggestion-visual{background:linear-gradient(135deg,#e8f8f0 0%,#f0fff5 100%)}
.suggestion-card:nth-child(3n) .suggestion-visual{background:linear-gradient(135deg,#fff1e7 0%,#fffaf3 100%)}
.suggestion-visual::before,.suggestion-visual::after{position:absolute;content:"";border-radius:50%;pointer-events:none}
.suggestion-visual::before{width:150px;height:150px;right:-38px;top:-48px;background:rgba(255,255,255,.38);border:1px solid rgba(33,29,43,.08)}
.suggestion-visual::after{width:100px;height:100px;left:18px;bottom:-32px;background:rgba(255,255,255,.16);border:1px solid rgba(33,29,43,.08)}
.suggestion-monogram{position:relative;z-index:1;width:68px;height:68px;display:grid;place-items:center;border:1px solid rgba(33,29,43,.14);border-radius:50%;background:rgba(255,255,255,.82);color:var(--ink);font:800 2rem var(--display);box-shadow:0 18px 20px -17px rgba(33,29,43,.35)}
.suggestion-visual-note{position:absolute;right:16px;bottom:16px;color:rgba(33,29,43,.7);font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.suggestion-body{padding:18px 18px 20px}
.suggestion-name{font:800 1.3rem/1.2 var(--display);letter-spacing:-.05em;overflow-wrap:anywhere}
.suggestion-intention{margin-top:4px;color:var(--muted);font-size:.82rem}
.suggestion-detail{margin-top:12px;color:#484250;font-size:.92rem;line-height:1.5}
.interest-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.interest-tag{padding:4px 8px;border-radius:9px;background:#f2effc;color:#5640c7;font-size:.74rem;font-weight:700}
.suggestion-vibe{margin-top:10px;color:var(--muted);font-size:.8rem}
.suggestion-actions{display:flex;gap:9px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(33,29,43,.12)}
.suggestion-actions button{min-height:40px;padding:8px 12px;border:1px solid var(--ink);border-radius:10px;font:700 .86rem var(--body);cursor:pointer;transition:background .15s,transform .15s}
.suggestion-actions button:hover{transform:translateY(-1px)}
.suggestion-actions button:active{transform:translateY(0)}
.suggestion-actions button:disabled{opacity:.6;cursor:wait;transform:none}
.suggestion-skip{background:var(--white);color:var(--ink)}
.suggestion-skip:hover{background:#f5f3f7}
.suggestion-like{background:linear-gradient(135deg,#7357e8,#6047d0);color:white}
.suggestion-like:hover{background:linear-gradient(135deg,#5e43d3,#4f38be)}
.people-empty{grid-column:1/-1;padding:26px 0;border-top:1px solid rgba(33,29,43,.15);border-bottom:1px solid rgba(33,29,43,.15)}
.people-empty h3{margin-top:8px;font-size:1.6rem}
.people-empty>p:last-child{max-width:560px;margin-top:6px;color:var(--muted)}
.home-lower{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:54px;align-items:start;margin-top:48px;padding-top:28px;border-top:1px solid rgba(33,29,43,.14)}
.connections-section,.conversation-card{min-width:0}
.connection-list{list-style:none;padding:0;margin:16px 0 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.connection-item{display:flex;align-items:center;gap:11px;padding:12px;border:1px solid rgba(33,29,43,.12);border-radius:14px;background:rgba(255,255,255,.8)}
.connection-avatar{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#7357e8,#ff6b61);color:#fff;font:800 1rem var(--display)}
.connection-description{display:flex;flex-direction:column;gap:2px;min-width:0}
.connection-name{font-weight:700;overflow-wrap:anywhere}
.connection-caption{font-size:.77rem;color:var(--muted)}
.connection-empty{display:flex;flex-direction:column;gap:8px;padding:20px 18px;border:1px dashed rgba(33,29,43,.2);border-radius:16px;background:rgba(255,255,255,.58);color:var(--muted)}
.connection-empty-mark{font-size:1.5rem;color:#6047d0}
.connection-empty strong{font-size:1.2rem;color:var(--ink)}
.conversation-card{padding:20px 20px 18px;border:1px solid rgba(33,29,43,.12);border-radius:22px;background:linear-gradient(180deg,#fff9f6 0%, #f8f3ff 100%);box-shadow:0 22px 28px -30px rgba(33,29,43,.32)}
.conversation-prompt{margin-top:14px;padding:18px 16px;border-left:4px solid #7357e8;border-radius:14px;background:rgba(255,255,255,.75);font:800 1.3rem/1.3 var(--display);letter-spacing:-.04em}
.conversation-card .text-link{margin-top:18px}
.coming-soon-strip{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;margin-top:42px;padding:18px 20px;border:1px solid rgba(33,29,43,.12);border-radius:20px;background:linear-gradient(135deg,#1c1826 0%, #2d233f 100%);color:#f7f4ff;box-shadow:0 18px 36px -30px rgba(33,29,43,.65)}
.coming-soon-strip p{font-weight:700}
.coming-soon-strip span{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.85);font-weight:700}
.coming-soon-strip small{font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.75)}
@media(max-width:980px){.hero-board{grid-template-columns:1fr}.campus-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.vibe-main{grid-column:1/-1}.suggestion-list{grid-template-columns:repeat(2,minmax(0,1fr))}.home-lower{grid-template-columns:1fr}}
@media(max-width:680px){.home-main{width:min(100%,calc(100% - 28px));padding-top:22px;padding-bottom:110px}.hero-board,.campus-grid,.suggestion-list,.connection-list{gap:12px}.hero-board{padding:20px 18px 18px}.hero-copy h1{font-size:clamp(2.4rem,11vw,3.2rem)}.hero-actions{flex-direction:column;align-items:stretch}.hero-actions .btn{width:100%}.mini-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.metric{min-width:0;padding:10px 8px}.campus-grid,.suggestion-list,.connection-list{grid-template-columns:1fr}.section-title{flex-direction:column;align-items:flex-start}.coming-soon-strip{align-items:flex-start;flex-direction:column}}
'@

[System.IO.File]::WriteAllText((Join-Path $root 'home.html'), $html, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $root 'home.css'), $css, [System.Text.Encoding]::UTF8)
