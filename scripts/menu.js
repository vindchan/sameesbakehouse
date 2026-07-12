(() => {
  const cfgEl = document.getElementById('menu-config');
  const SHEET_ID = cfgEl?.dataset?.sheetId || '';
  const GID = cfgEl?.dataset?.gid || '0';
  const WHATSAPP = (cfgEl?.dataset?.whatsapp || '').replace(/\D+/g, '');
  const WHATSAPP_LINK = cfgEl?.dataset?.whatsappLink || cfgEl?.dataset?.waLink || '';
  // Menu data now comes from the Samees admin app (was Google Sheets).
  const MENU_API = cfgEl?.dataset?.menuApi || 'https://orders.sameesbakehouse.com/api/menu';

  const elTabs = document.getElementById('category-tabs');
  const elSections = document.getElementById('menu-sections');
  const elLoading = document.getElementById('state-loading');
  const elError = document.getElementById('state-error');
  const elUpdated = document.getElementById('last-updated');
  const elOrderCta = document.getElementById('order-cta');
  const elFab = document.getElementById('jump-fab');
  const elJumpMenu = document.getElementById('jump-menu');
  const elJumpList = document.getElementById('jump-list');
  const elJumpBackdrop = document.getElementById('jump-backdrop');
  const elDetailBackdrop = document.getElementById('detail-backdrop');
  const elDetailModal = document.getElementById('detail-modal');
  const elDetailClose = document.getElementById('detail-close');
  const elGallery = document.getElementById('detail-gallery');
  const elDetailCount = document.getElementById('detail-count');
  const elDetailTitle = document.getElementById('detail-title');
  const elDetailDesc = document.getElementById('detail-desc');
  const elDetailPrice = document.getElementById('detail-price');
  const elShare = document.getElementById('detail-share');
  const slug = (s) => 'cat-' + String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const itemSlug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // Set WhatsApp CTA
  const waMsg = encodeURIComponent("Hi! I'd like to place an order from the menu.");
  if (WHATSAPP_LINK) {
    elOrderCta.href = WHATSAPP_LINK;
  } else if (WHATSAPP) {
    elOrderCta.href = `https://wa.me/${WHATSAPP}?text=${waMsg}`;
  } else {
    elOrderCta.href = `https://wa.me/?text=${waMsg}`;
  }

  const state = {
    // Top categories, each with its own items plus one level of sub-categories.
    groups: [], // [{ name, items:[card], subs:[{ name, items:[card] }] }]
    itemBySlug: new Map(), // shareable-link lookup: slug → card item
  };

  function isTruthy(v) {
    if (v === null || v === undefined) return true; // default available
    const s = String(v).trim().toLowerCase();
    if (s === '' ) return true;
    return ['true','yes','y','1'].includes(s);
  }

  function cellVal(c) {
    if (!c) return '';
    // Prefer formatted value if present, else raw
    return c.f != null ? c.f : (c.v != null ? c.v : '');
  }

  // no special image URL transforms needed; use the URL as-is

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // API items (available + has a photo) → the card objects the grid renders.
  function toCardItems(apiItems, categoryName) {
    const out = [];
    (apiItems || []).forEach(it => {
      if (it.available === false) return; // hide out-of-stock
      if (!(it.image || '').trim()) return; // hide items without a photo
      out.push({
        id: it.id || '', // → shareable item page /i/<id>
        category: categoryName || '',
        item: it.name || '',
        description: it.description || '',
        price: it.price || '',
        image_url: it.image || '',
        images: Array.isArray(it.images) ? it.images.filter(Boolean) : [],
        slug: itemSlug(it.name), // finalised (deduped) in loadMenu
      });
    });
    return out;
  }

  // Top chips: tap to jump to a top-level category. They do NOT filter.
  function renderJumpChips() {
    elTabs.innerHTML = '';
    state.groups.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.textContent = g.name;
      b.dataset.cat = g.name;
      b.addEventListener('click', () => scrollToId(slug(g.name)));
      elTabs.appendChild(b);
    });
  }

  // Bottom-right floating button → categories, with sub-sections nested under each.
  function renderJumpMenu() {
    elJumpList.innerHTML = '';
    state.groups.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = g.name;
      b.style.fontWeight = '600';
      b.addEventListener('click', () => { closeJump(); scrollToId(slug(g.name)); });
      elJumpList.appendChild(b);
      g.subs.forEach(s => {
        const sb = document.createElement('button');
        sb.type = 'button';
        sb.textContent = s.name;
        sb.style.paddingLeft = '26px';
        sb.style.color = '#666';
        sb.addEventListener('click', () => { closeJump(); scrollToId(slug(g.name + ' ' + s.name)); });
        elJumpList.appendChild(sb);
      });
    });
  }

  function openJump() { elJumpMenu.classList.add('open'); elJumpBackdrop.classList.add('open'); elFab.setAttribute('aria-expanded', 'true'); }
  function closeJump() { elJumpMenu.classList.remove('open'); elJumpBackdrop.classList.remove('open'); elFab.setAttribute('aria-expanded', 'false'); }
  elFab.addEventListener('click', () => { (elJumpMenu.classList.contains('open') ? closeJump : openJump)(); });
  elJumpBackdrop.addEventListener('click', closeJump);

  // ── Item detail overlay: all photos, high quality, swipe left/right ───────────
  let currentItem = null;

  function showDetail(it) {
    currentItem = it;
    const imgs = (it.images && it.images.length) ? it.images : (it.image_url ? [it.image_url] : []);
    elGallery.innerHTML = '';
    imgs.forEach((u) => {
      const im = document.createElement('img');
      im.src = u;
      im.alt = it.item || 'Menu item';
      im.loading = 'lazy';
      elGallery.appendChild(im);
    });
    elDetailTitle.textContent = it.item || '';
    elDetailDesc.textContent = it.description || '';
    elDetailDesc.style.display = it.description ? 'block' : 'none';
    elDetailPrice.textContent = it.price || '';
    elDetailPrice.style.display = it.price ? 'block' : 'none';
    if (elShare) elShare.textContent = '🔗 Share this';
    elGallery.scrollLeft = 0;
    updateDetailCount();
    elDetailBackdrop.classList.add('open');
    elDetailModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function hideDetail() {
    currentItem = null;
    elDetailBackdrop.classList.remove('open');
    elDetailModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Open with a shareable URL (?item=slug) so the exact item can be linked.
  function openDetail(it) {
    showDetail(it);
    history.pushState({ item: it.slug }, '', location.pathname + '?item=' + encodeURIComponent(it.slug));
  }
  function closeDetail() {
    if (history.state && history.state.item) {
      history.back(); // pop our pushed entry → popstate hides the overlay (phone back button works too)
    } else {
      hideDetail();
      history.replaceState({}, '', location.pathname);
    }
  }
  window.addEventListener('popstate', () => {
    const s = new URLSearchParams(location.search).get('item');
    if (s && state.itemBySlug.has(s)) showDetail(state.itemBySlug.get(s));
    else hideDetail();
  });

  function updateDetailCount() {
    const total = elGallery.children.length;
    const w = elGallery.clientWidth;
    const i = w ? Math.round(elGallery.scrollLeft / w) : 0;
    elDetailCount.textContent = total > 1 ? `${Math.min(i + 1, total)} / ${total}` : '';
    elDetailCount.style.display = total > 1 ? 'block' : 'none';
  }

  async function shareItem() {
    if (!currentItem) return;
    // Share the rich item page (photo preview + details) when we have an id;
    // otherwise fall back to the in-menu deep link.
    const url = currentItem.id
      ? 'https://orders.sameesbakehouse.com/i/' + encodeURIComponent(currentItem.id)
      : location.origin + location.pathname + '?item=' + encodeURIComponent(currentItem.slug);
    const title = 'Samee’s Bakehouse — ' + (currentItem.item || 'Menu');
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch (e) { /* user cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(url); if (elShare) elShare.textContent = '✓ Link copied'; }
      catch (e) { window.prompt('Copy this link:', url); }
    }
  }

  elGallery.addEventListener('scroll', updateDetailCount, { passive: true });
  elDetailClose.addEventListener('click', closeDetail);
  elDetailBackdrop.addEventListener('click', closeDetail);
  if (elShare) elShare.addEventListener('click', shareItem);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDetail(); closeJump(); } });

  function makeCard(it) {
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.addEventListener('click', () => openDetail(it));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(it); }
    });

    const wrap = document.createElement('div');
    wrap.className = 'img-wrap';
    const img = document.createElement('img');
    if (it.image_url) img.src = it.image_url;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = it.item || it.category || 'Menu item';
    img.onerror = () => {
      img.src = '/assets/logo.svg';
      img.style.objectFit = 'contain';
      wrap.style.background = '#F5EFE6';
    };
    // Show each photo at its own true shape — never crop.
    img.addEventListener('load', () => {
      if ((img.currentSrc || img.src).indexOf('logo.svg') !== -1) return;
      const w = img.naturalWidth, h = img.naturalHeight;
      if (w && h) wrap.style.aspectRatio = w + ' / ' + h;
    });
    wrap.appendChild(img);
    card.appendChild(wrap);

    const body = document.createElement('div');
    body.className = 'card-body';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = it.item || '';
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = it.description || '';
    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = it.price || '';

    body.appendChild(title);
    if (it.description) body.appendChild(desc);
    if (it.price) body.appendChild(price);
    card.appendChild(body);
    return card;
  }

  function makeGrid(items) {
    const grid = document.createElement('div');
    grid.className = 'grid';
    items.forEach(it => grid.appendChild(makeCard(it)));
    return grid;
  }

  // Each top category is a section with a big heading; its sub-categories get sub-headings.
  function renderSections() {
    elSections.innerHTML = '';
    state.groups.forEach(g => {
      const sec = document.createElement('section');
      sec.className = 'cat-section';
      sec.id = slug(g.name);
      sec.dataset.cat = g.name;

      const h = document.createElement('h2');
      h.className = 'cat-heading';
      h.textContent = g.name;
      sec.appendChild(h);

      if (g.items.length) sec.appendChild(makeGrid(g.items));

      g.subs.forEach(s => {
        const sh = document.createElement('h3');
        sh.className = 'subcat-heading';
        sh.id = slug(g.name + ' ' + s.name);
        sh.textContent = s.name;
        sec.appendChild(sh);
        sec.appendChild(makeGrid(s.items));
      });

      elSections.appendChild(sec);
    });

    elSections.style.display = 'block';
    elLoading.style.display = 'none';
    elError.style.display = 'none';
    elFab.style.display = state.groups.length ? 'inline-flex' : 'none';
    setupScrollSpy();
  }

  // Highlight the chip for the category currently in view, and keep it centered in the chip bar.
  let spyObserver = null;
  function setupScrollSpy() {
    if (spyObserver) spyObserver.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const chips = new Map();
    elTabs.querySelectorAll('.tab').forEach(b => chips.set(b.dataset.cat, b));
    spyObserver = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const cat = e.target.dataset.cat;
        chips.forEach((b, c) => b.classList.toggle('active', c === cat));
        const active = chips.get(cat);
        if (active) {
          const bar = elTabs.getBoundingClientRect();
          const chip = active.getBoundingClientRect();
          elTabs.scrollLeft += (chip.left - bar.left) - (bar.width / 2 - chip.width / 2);
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    elSections.querySelectorAll('.cat-section').forEach(sec => spyObserver.observe(sec));
  }

  function normalizeKey(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ''); // collapse to alphanum
  }

  function indexFor(cols, candidates) {
    const wanted = candidates.map(normalizeKey);
    for (let i = 0; i < cols.length; i++) {
      const key = normalizeKey(cols[i]);
      if (wanted.includes(key)) return i;
    }
    return -1;
  }

  function parseGviz(resp) {
    if (!resp || !resp.table) throw new Error('Invalid sheet response');
    const rawCols = resp.table.cols.map(c => c.label || '');
    const idx = {
      category: indexFor(rawCols, ['category','cat']),
      item: indexFor(rawCols, ['item','name','title']),
      description: indexFor(rawCols, ['description','desc','details']),
      price: indexFor(rawCols, ['price','cost','rate','mrp','rs']),
      available: indexFor(rawCols, ['available','availability','instock','stock','active']),
      image_url: indexFor(rawCols, ['image_url','image url','image','photo','pic','picture','img','imgurl','imageurl']),
    };

    const items = [];
    const categoriesSet = new Set();
    (resp.table.rows || []).forEach(r => {
      const c = r.c || [];
      const row = {
        category: idx.category >= 0 ? cellVal(c[idx.category]) : '',
        item: idx.item >= 0 ? cellVal(c[idx.item]) : '',
        description: idx.description >= 0 ? cellVal(c[idx.description]) : '',
        price: idx.price >= 0 ? cellVal(c[idx.price]) : '',
        available: idx.available >= 0 ? cellVal(c[idx.available]) : '',
        image_url: idx.image_url >= 0 ? cellVal(c[idx.image_url]) : '',
      };
      if (!row.item) return; // skip empty rows
      if (!isTruthy(row.available)) return; // skip unavailable
      if (row.category) categoriesSet.add(String(row.category));
      items.push(row);
    });

    state.items = items;
    state.categories = Array.from(categoriesSet).sort((a,b) => a.localeCompare(b));
  }

  function showError(msg) {
    console.error(msg);
    elLoading.style.display = 'none';
    elSections.style.display = 'none';
    elError.style.display = 'block';
    if (elFab) elFab.style.display = 'none';
  }

  async function loadMenu() {
    elLoading.style.display = 'block';
    elSections.style.display = 'none';
    elError.style.display = 'none';

    const now = new Date();
    elUpdated.textContent = `Last updated: ${now.toLocaleString()}`;

    try {
      const res = await fetch(MENU_API, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      const groups = [];
      (data.categories || []).forEach(cat => {
        const direct = toCardItems(cat.items, cat.name);
        const subs = (cat.subcategories || [])
          .map(sc => ({ name: sc.name || '', items: toCardItems(sc.items, sc.name) }))
          .filter(s => s.items.length > 0);
        // keep the exact category/sub-category order set in the admin app
        if ((direct.length || subs.length) && cat.name) {
          groups.push({ name: cat.name, items: direct, subs });
        }
      });

      // Finalise unique slugs and build the shareable-link lookup.
      const bySlug = new Map();
      const assign = (it) => {
        let base = it.slug || 'item', s = base, n = 2;
        while (bySlug.has(s)) s = base + '-' + (n++);
        it.slug = s;
        bySlug.set(s, it);
      };
      groups.forEach(g => { g.items.forEach(assign); g.subs.forEach(sub => sub.items.forEach(assign)); });

      state.groups = groups;
      state.itemBySlug = bySlug;
      renderJumpChips();
      renderJumpMenu();
      renderSections();

      // Deep link: /menu/?item=<slug> opens that item straight away.
      const initSlug = new URLSearchParams(location.search).get('item');
      if (initSlug && state.itemBySlug.has(initSlug)) showDetail(state.itemBySlug.get(initSlug));
    } catch (e) {
      showError(e.message || 'Failed to load menu');
    }
  }

  loadMenu();
})();
