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

  function makeCard(it) {
    const card = document.createElement('div');
    card.className = 'card';

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
          items.push({
            category: cat.name || '',
            item: it.name || '',
            description: it.description || '',
            price: it.price || '',
            image_url: it.image || '',
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
