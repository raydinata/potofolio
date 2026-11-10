(function () {
  'use strict';
  
  var LIVE_PREVIEW = {
    langkahstore: '',
    sinarexpress: '',
    spk: '',
    'portofolio-web': ''
  };

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Tema terang / gelap ---------- */
  var themeBtn = document.getElementById('theme');

  function syncThemeUI() {
    if (!themeBtn) return;
    var light = root.getAttribute('data-theme') === 'light';
    themeBtn.setAttribute('aria-pressed', String(light));
    themeBtn.setAttribute('aria-label', light
      ? 'Tema terang aktif. Klik untuk tema gelap'
      : 'Tema gelap aktif. Klik untuk tema terang');
  }

  if (themeBtn) {
    syncThemeUI();
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') !== 'light' ? 'light' : 'dark';
      var apply = function () {
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (err) {}
        syncThemeUI();
      };
      if (reduce || !document.startViewTransition) { apply(); return; }
      /* Ganti tema dengan lingkaran yang melebar dari tombol */
      var r = themeBtn.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      document.startViewTransition(apply).ready.then(function () {
        root.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + end + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 650, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
        );
      });
    });
  }

  /* ---------- Accordion proyek: hanya satu terbuka ---------- */
  var projects = Array.prototype.slice.call(document.querySelectorAll('.projects details[data-project]'));
  var projectAnims = new WeakMap();

  function projectPanel(details) {
    return details.querySelector('.project-panel');
  }

  function resetPanel(panel) {
    panel.style.height = '';
    panel.style.opacity = '';
    panel.classList.remove('animating');
  }

  function openProject(details) {
    var panel = projectPanel(details);
    if (!panel) { details.open = true; return; }

    var running = projectAnims.get(details);
    var wasOpen = details.open;
    var currentHeight = panel.getBoundingClientRect().height || 0;
    if (running) { running.cancel(); projectAnims.delete(details); }

    details.open = true;
    details.classList.add('is-open');

    if (reduce) { resetPanel(panel); return; }

    var start = wasOpen ? currentHeight : 0;
    panel.classList.add('animating');
    panel.style.height = start + 'px';
    void panel.offsetHeight;
    var target = panel.scrollHeight;

    var anim = panel.animate(
      [
        { height: start + 'px', opacity: start > 0 ? 1 : 0 },
        { height: target + 'px', opacity: 1 }
      ],
      { duration: 460, easing: 'cubic-bezier(.2,.7,.2,1)' }
    );
    projectAnims.set(details, anim);
    var fallback = setTimeout(function () {
      if (projectAnims.get(details) !== anim) return;
      projectAnims.delete(details);
      try { anim.cancel(); } catch (err) {}
      resetPanel(panel);
    }, 540);
    anim.onfinish = function () {
      clearTimeout(fallback);
      if (projectAnims.get(details) !== anim) return;
      projectAnims.delete(details);
      resetPanel(panel);
    };
  }

  function closeProject(details) {
    var panel = projectPanel(details);
    details.classList.remove('is-open');
    if (!panel) { details.open = false; return; }

    var running = projectAnims.get(details);
    var currentHeight = panel.getBoundingClientRect().height || 0;
    if (running) { running.cancel(); projectAnims.delete(details); }

    if (reduce || !details.open) {
      details.open = false;
      resetPanel(panel);
      return;
    }

    var start = currentHeight || panel.scrollHeight;
    panel.classList.add('animating');
    panel.style.height = start + 'px';
    void panel.offsetHeight;

    var anim = panel.animate(
      [
        { height: start + 'px', opacity: 1 },
        { height: '0px', opacity: 0 }
      ],
      { duration: 260, easing: 'cubic-bezier(.4,0,1,1)' }
    );
    projectAnims.set(details, anim);
    var fallback = setTimeout(function () {
      if (projectAnims.get(details) !== anim) return;
      projectAnims.delete(details);
      try { anim.cancel(); } catch (err) {}
      details.open = false;
      resetPanel(panel);
    }, 330);
    anim.onfinish = function () {
      clearTimeout(fallback);
      if (projectAnims.get(details) !== anim) return;
      projectAnims.delete(details);
      details.open = false;
      resetPanel(panel);
    };
  }

  function setProjectOpen(details, open) {
    details.dataset.state = open ? 'open' : 'closed';
    if (open) openProject(details); else closeProject(details);
  }

  projects.forEach(function (details) {
    var summary = details.querySelector('summary');
    details.dataset.state = details.open ? 'open' : 'closed';
    if (!summary) return;
    summary.addEventListener('click', function (e) {
      e.preventDefault();
      var willOpen = details.dataset.state !== 'open';
      if (willOpen) {
        projects.forEach(function (other) {
          if (other !== details && other.dataset.state === 'open') setProjectOpen(other, false);
        });
      }
      setProjectOpen(details, willOpen);
    });
  });

  /* ---------- Dua view: Beranda & Portofolio ---------- */
  var views = {
    home: document.getElementById('beranda'),
    work: document.getElementById('portofolio')
  };
  var currentView = 'home';
  var workScroll = 0;
  var switchingViews = false;
  var pendingNav = null;
  var skipLink = document.querySelector('.skip');

  var curtain = document.createElement('div');
  curtain.className = 'curtain';
  curtain.hidden = true;
  curtain.setAttribute('aria-hidden', 'true');
  curtain.innerHTML = '<div class="curtain-panel"></div><div class="curtain-panel"></div><div class="curtain-panel"></div>';
  document.body.appendChild(curtain);

  function setSkipTarget() {
    if (!skipLink) return;
    skipLink.setAttribute('href', currentView === 'work' ? '#proyek' : '#beranda');
  }

  function setViewState(name) {
    var from = views.work, to = views.home;
    if (name === 'work') { from = views.home; to = views.work; }
    if (!to) return;
    if (from) {
      from.classList.remove('is-active');
      from.inert = true;
      from.setAttribute('aria-hidden', 'true');
    }
    to.classList.add('is-active');
    to.inert = false;
    to.removeAttribute('aria-hidden');
    currentView = name;
    root.setAttribute('data-view', name);
    setSkipTarget();
  }

  function focusView(name, target) {
    var el = target;
    if (!el) {
      el = name === 'home'
        ? document.getElementById('home-title')
        : (views.work && views.work.querySelector('#proyek h2'));
    }
    if (!el) return;
    var heading = el.matches('h1,h2,h3') ? el : el.querySelector('h1,h2,h3');
    var focusEl = heading || el;
    if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
    focusEl.focus({ preventScroll: true });
  }

  function afterViewChange(name, opts) {
    opts = opts || {};
    var target = opts.target || null;
    if (name === 'work') {
      if (target) {
        window.scrollTo(0, 0);
        requestAnimationFrame(function () {
          target.scrollIntoView({
            behavior: opts.instant ? 'auto' : (reduce ? 'auto' : 'smooth'),
            block: 'start'
          });
        });
      } else {
        window.scrollTo(0, opts.restore === false ? 0 : workScroll);
      }
    } else {
      window.scrollTo(0, 0);
    }
    focusView(name, target);
    updateProgress();
  }

  function hashFor(name, target) {
    if (name === 'home') return '#beranda';
    if (target && target.id) return '#' + target.id;
    return '#portofolio';
  }

  function pushHash(name, target) {
    var hash = hashFor(name, target);
    if (location.hash === hash) return;
    try {
      history.pushState({ view: name }, '', hash);
    } catch (err) {
      /* Beberapa browser membatasi pushState pada file:// — navigasi tetap jalan. */
    }
  }

  function resolveHash(hash) {
    if (!hash || hash === '#' || hash === '#beranda') return { view: 'home' };
    if (hash === '#portofolio') return { view: 'work' };
    var el = null;
    try { el = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (err) {}
    if (!el) return null;
    if (views.work && views.work.contains(el)) return { view: 'work', target: el };
    if (views.home && views.home.contains(el)) return { view: 'home', target: el };
    return null;
  }

  function go(name, opts) {
    opts = opts || {};
    if (!views[name]) return;
    if (switchingViews) { pendingNav = { name: name, opts: opts }; return; }

    var target = opts.target || null;

    if (name === currentView) {
      if (target) {
        focusView(name, target);
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        focusView(name, null);
      }
      if (opts.push) pushHash(name, target);
      return;
    }

    if (currentView === 'work') workScroll = window.scrollY;

    if (reduce || opts.instant) {
      setViewState(name);
      afterViewChange(name, opts);
      if (opts.push) pushHash(name, target);
      return;
    }

    switchingViews = true;
    curtain.hidden = false;
    void curtain.offsetHeight;
    curtain.classList.remove('is-revealing');
    curtain.classList.add('is-covering');

    setTimeout(function () {
      setViewState(name);
      afterViewChange(name, opts);
      if (opts.push) pushHash(name, target);
      curtain.classList.remove('is-covering');
      curtain.classList.add('is-revealing');
      setTimeout(function () {
        curtain.classList.remove('is-revealing');
        curtain.hidden = true;
        switchingViews = false;
        if (pendingNav) {
          var next = pendingNav;
          pendingNav = null;
          go(next.name, next.opts);
        }
      }, 700);
    }, 620);
  }

  function syncFromHash(instant) {
    var nav = resolveHash(location.hash) || { view: 'home' };
    go(nav.view, { target: nav.target || null, push: false, instant: !!instant });
  }

  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link || link.classList.contains('skip')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var nav = resolveHash(link.getAttribute('href'));
    if (!nav) return;
    e.preventDefault();
    go(nav.view, { target: nav.target || null, push: true });
  });

  if (skipLink) {
    skipLink.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      go(currentView, {
        target: currentView === 'work' ? document.getElementById('proyek') : null,
        push: false
      });
    });
  }

  window.addEventListener('popstate', function () { syncFromHash(false); });
  window.addEventListener('hashchange', function () { syncFromHash(false); });

  var initialNav = resolveHash(location.hash);
  if (initialNav && initialNav.view === 'work') {
    setViewState('work');
    afterViewChange('work', { target: initialNav.target || null, instant: true });
  } else {
    root.setAttribute('data-view', 'home');
    if (views.work) {
      views.work.inert = true;
      views.work.setAttribute('aria-hidden', 'true');
    }
    setSkipTarget();
  }

  /* ---------- Live preview per proyek ---------- */
  document.querySelectorAll('.projects details[data-project]').forEach(function (d) {
    var url = (LIVE_PREVIEW[d.getAttribute('data-project')] || '').trim();
    if (!/^https?:\/\//i.test(url)) return;

    var body = d.querySelector('.body');
    var info = body.lastElementChild;
    var title = (d.querySelector('h3') || {}).textContent || 'proyek';

    var bar = document.createElement('div');
    bar.className = 'live';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn';
    toggle.textContent = 'Pratinjau langsung';
    toggle.setAttribute('aria-expanded', 'false');

    var open = document.createElement('a');
    open.className = 'btn ghost';
    open.href = url;
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = 'Buka di tab baru';

    bar.appendChild(toggle);
    bar.appendChild(open);
    info.appendChild(bar);

    var frame = document.createElement('div');
    frame.className = 'frame';
    frame.hidden = true;
    frame.innerHTML = '<div class="frame-bar"><i></i><i></i><i></i><em class="frame-url"></em></div>';
    frame.querySelector('.frame-url').textContent = url;

    var iframe = document.createElement('iframe');
    iframe.title = 'Pratinjau langsung: ' + title;
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');

    var note = document.createElement('p');
    note.className = 'frame-note';
    note.textContent = 'Jika tampilan kosong, situs tersebut mungkin memblokir pratinjau tertanam. Gunakan "Buka di tab baru".';

    frame.appendChild(iframe);
    frame.appendChild(note);
    body.appendChild(frame);

    var loaded = false;
    toggle.addEventListener('click', function () {
      var show = frame.hidden;
      if (show && !loaded) { iframe.src = url; loaded = true; }
      frame.hidden = !show;
      toggle.textContent = show ? 'Tutup pratinjau' : 'Pratinjau langsung';
      toggle.setAttribute('aria-expanded', String(show));
      if (show) frame.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    });
  });

  /* ---------- Bar progres scroll ---------- */
  var bar = document.createElement('div');
  bar.className = 'progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  var ticking = false;
  function updateProgress() {
    if (!bar) { ticking = false; return; }
    var h = root.scrollHeight - root.clientHeight;
    bar.style.setProperty('--p', h > 0 ? Math.min(1, root.scrollTop / h) : 0);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  updateProgress();

  /* ---------- Menu aktif sesuai bagian yang dilihat ---------- */
  if ('IntersectionObserver' in window) {
    var links = {};
    document.querySelectorAll('.panel a[href^="#"], nav a[href^="#"]').forEach(function (a) {
      links[a.getAttribute('href').slice(1)] = a;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          Object.keys(links).forEach(function (k) {
            var active = k === e.target.id;
            links[k].classList.toggle('active', active);
            if (active) links[k].setAttribute('aria-current', 'true');
            else links[k].removeAttribute('aria-current');
          });
        }
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Muncul halus saat di-scroll ---------- */
  if (!reduce && 'IntersectionObserver' in window) {
    root.classList.add('js');
    var targets = '.projects details, .about > div, .sg, .exp li, .contact > *, section > h2, footer';
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    document.querySelectorAll(targets).forEach(function (el) {
      var idx = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.classList.add('reveal');
      el.style.transitionDelay = Math.min(idx, 6) * 70 + 'ms';
      io.observe(el);
    });

    document.querySelectorAll('.skills').forEach(function (ul) {
      Array.prototype.forEach.call(ul.children, function (li, i) { li.style.setProperty('--i', i); });
    });
  }

  /* ============================================================
     ANIMASI TAMBAHAN
     ROLES = tulisan yang bergantian diketik di bagian atas.
     ============================================================ */
  var ROLES = ['web developer.'];
  var canHover = window.matchMedia('(hover: hover)').matches;

  if (!reduce) {
    /* Teks jabatan diketik bergantian */
    var role = document.querySelector('.hero .role');
    if (role && ROLES.length > 1) {
      role.classList.add('typing');
      var ri = 0;
      var typeTo = function (text, done) {
        var i = 0;
        (function step() { role.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(step, 70); else done(); })();
      };
      var erase = function (done) {
        (function step() { role.textContent = role.textContent.slice(0, -1); if (role.textContent.length > 0) setTimeout(step, 38); else done(); })();
      };
      var cycle = function () {
        setTimeout(function () {
          erase(function () { ri = (ri + 1) % ROLES.length; typeTo(ROLES[ri], cycle); });
        }, 2400);
      };
      setTimeout(cycle, 1400);
    }

    /* Tombol "magnet": sedikit mengikuti kursor */
    if (canHover) {
      document.querySelectorAll('.hero-actions .btn, button.theme').forEach(function (b) {
        b.addEventListener('pointermove', function (e) {
          var r = b.getBoundingClientRect();
          b.style.translate = ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + 'px';
        });
        b.addEventListener('pointerleave', function () { b.style.translate = ''; });
      });

      /* Gambar proyek miring 3D mengikuti kursor */
      document.querySelectorAll('.projects .shot.has-img').forEach(function (el) {
        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect();
          el.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 6).toFixed(2) + 'deg');
          el.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 4).toFixed(2) + 'deg');
        });
        el.addEventListener('pointerleave', function () {
          el.style.setProperty('--rx', '0deg');
          el.style.setProperty('--ry', '0deg');
        });
      });
    }
  }

  /* Tombol kembali ke atas */
  var toTop = document.createElement('button');
  toTop.type = 'button';
  toTop.className = 'to-top';
  toTop.setAttribute('aria-label', 'Kembali ke atas');
  toTop.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(toTop);
  toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  window.addEventListener('scroll', function () { toTop.classList.toggle('show', root.scrollTop > 600); }, { passive: true });

  /* ---------- Menu geser (UTAMA / KONTAK) ---------- */
  var panel = document.getElementById('panel');
  var menuBtn = document.getElementById('menuBtn');
  var menuClose = document.getElementById('menuClose');
  var scrim = document.getElementById('scrim');
  function setMenu(open, refocus) {
    root.classList.toggle('menu-open', open);
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) menuClose.focus({ preventScroll: true });
    else if (refocus) menuBtn.focus({ preventScroll: true });
  }
  if (panel && menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(true); });
    menuClose.addEventListener('click', function () { setMenu(false, true); });
    scrim.addEventListener('click', function () { setMenu(false, true); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('menu-open')) setMenu(false, true);
    });
  }

  /* ---------- Layar pembuka: loading lalu tombol masuk ---------- */
  var seen = false;
  try { seen = sessionStorage.getItem('intro') === '1'; } catch (err) {}
  if (!reduce && !seen && !location.hash) {
    root.classList.add('intro-lock', 'intro-wait');
    var intro = document.createElement('div');
    intro.className = 'intro';
    intro.innerHTML =
      '<div class="intro-load"><span class="intro-mark">Raydinata</span>' +
      '<span class="intro-text">Sebentar ya</span><span class="dots"><i></i><i></i><i></i></span></div>' +
      '<button class="intro-prompt" type="button"><span>Masuk</span>' +
      '<b><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></b></button>';
    document.body.appendChild(intro);

    var ready = false, gone = false, startY = null;
    setTimeout(function () {
      ready = true;
      intro.querySelector('.intro-prompt').focus({ preventScroll: true });
    }, 1300);
    var dismiss = function () {
      if (!ready || gone) return;
      gone = true;
      try { sessionStorage.setItem('intro', '1'); } catch (err) {}
      intro.classList.add('out');
      root.classList.remove('intro-lock', 'intro-wait');
      setTimeout(function () { intro.remove(); }, 1000);
    };
    intro.addEventListener('click', dismiss);
    intro.addEventListener('wheel', function (e) { if (e.deltaY > 4) dismiss(); }, { passive: true });
    intro.addEventListener('touchstart', function (e) { startY = e.touches[0].clientY; }, { passive: true });
    intro.addEventListener('touchmove', function (e) {
      if (startY !== null && startY - e.touches[0].clientY > 30) dismiss();
    }, { passive: true });
    document.addEventListener('keydown', function (e) {
      if (!gone && ['ArrowDown', 'PageDown', ' ', 'Enter', 'Escape'].indexOf(e.key) > -1) {
        e.preventDefault();
        dismiss();
      }
    });
  }
})();