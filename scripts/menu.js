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
  const slug = (s) => 'cat-' + String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

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
    items: [], // {category, item, description, price, available, image_url}
    categories: [],
    active: 'All Items',
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

  function scrollToCat(cat) {
    const el = document.getElementById(slug(cat));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Top chips: tap to jump to a category. They do NOT filter — every category stays on the page.
  function renderJumpChips() {
    elTabs.innerHTML = '';
    state.categories.forEach(cat => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.textContent = cat;
      b.dataset.cat = cat;
      b.addEventListener('click', () => scrollToCat(cat));
      elTabs.appendChild(b);
    });
  }

  // Bottom-right floating button → popup list of categories.
  function renderJumpMenu() {
    elJumpList.innerHTML = '';
    state.categories.forEach(cat => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = cat;
      b.addEventListener('click', () => { closeJump(); scrollToCat(cat); });
      elJumpList.appendChild(b);
    });
  }

  function openJump() { elJumpMenu.classList.add('open'); elJumpBackdrop.classList.add('open'); elFab.setAttribute('aria-expanded', 'true'); }
  function closeJump() { elJumpMenu.classList.remove('open'); elJumpBackdrop.classList.remove('open'); elFab.setAttribute('aria-expanded', 'false'); }
  elFab.addEventListener('click', () => { (elJumpMenu.classList.contains('open') ? closeJump : openJump)(); });
  elJumpBackdrop.addEventListener('click', closeJump);

  // ── Item detail overlay: all photos, high quality, swipe left/right ───────────
  function openDetail(it) {
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
    elGallery.scrollLeft = 0;
    updateDetailCount();
    elDetailBackdrop.classList.add('open');
    elDetailModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDetail() {
    elDetailBackdrop.classList.remove('open');
    elDetailModal.classList.remove('open');
    document.body.style.overflow = '';
  }
  function updateDetailCount() {
    const total = elGallery.children.length;
    const w = elGallery.clientWidth;
    const i = w ? Math.round(elGallery.scrollLeft / w) : 0;
    elDetailCount.textContent = total > 1 ? `${Math.min(i + 1, total)} / ${total}` : '';
    elDetailCount.style.display = total > 1 ? 'block' : 'none';
  }
  elGallery.addEventListener('scroll', updateDetailCount, { passive: true });
  elDetailClose.addEventListener('click', closeDetail);
  elDetailBackdrop.addEventListener('click', closeDetail);
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
    // Square or wide photo → show it 1:1; taller-than-square → keep the 4:5 frame.
    img.addEventListener('load', () => {
      if ((img.currentSrc || img.src).indexOf('logo.svg') !== -1) return;
      const r = img.naturalWidth / img.naturalHeight;
      if (r) wrap.style.aspectRatio = r >= 0.98 ? '1 / 1' : '4 / 5';
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

  // Every category is its own section with a big heading (Swiggy-style) — all shown at once.
  function renderSections() {
    elSections.innerHTML = '';
    state.categories.forEach(cat => {
      const items = state.items.filter(it => it.category === cat);
      if (!items.length) return;
      const sec = document.createElement('section');
      sec.className = 'cat-section';
      sec.id = slug(cat);
      sec.dataset.cat = cat;
      const h = document.createElement('h2');
      h.className = 'cat-heading';
      h.textContent = cat;
      sec.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'grid';
      items.forEach(it => grid.appendChild(makeCard(it)));
      sec.appendChild(grid);
      elSections.appendChild(sec);
    });

    elSections.style.display = 'block';
    elLoading.style.display = 'none';
    elError.style.display = 'none';
    elFab.style.display = state.categories.length ? 'inline-flex' : 'none';
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

      const items = [];
      const categories = [];
      (data.categories || []).forEach(cat => {
        let hasVisible = false;
        (cat.items || []).forEach(it => {
          if (it.available === false) return; // hide out-of-stock items
          if (!(it.image || '').trim()) return; // hide items without a photo
          items.push({
            category: cat.name || '',
            item: it.name || '',
            description: it.description || '',
            price: it.price || '',
            image_url: it.image || '',
            images: Array.isArray(it.images) ? it.images.filter(Boolean) : [],
            available: true,
          });
          hasVisible = true;
        });
        // preserve the exact category order set in the admin app
        if (hasVisible && cat.name) categories.push(cat.name);
      });

      state.items = items;
      state.categories = categories;
      renderJumpChips();
      renderJumpMenu();
      renderSections();
    } catch (e) {
      showError(e.message || 'Failed to load menu');
    }
  }

  loadMenu();
})();
