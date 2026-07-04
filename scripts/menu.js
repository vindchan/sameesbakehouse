(() => {
  const cfgEl = document.getElementById('menu-config');
  const SHEET_ID = cfgEl?.dataset?.sheetId || '';
  const GID = cfgEl?.dataset?.gid || '0';
  const WHATSAPP = (cfgEl?.dataset?.whatsapp || '').replace(/\D+/g, '');
  const WHATSAPP_LINK = cfgEl?.dataset?.whatsappLink || cfgEl?.dataset?.waLink || '';
  // Menu data now comes from the Samees admin app (was Google Sheets).
  const MENU_API = cfgEl?.dataset?.menuApi || 'https://orders.sameesbakehouse.com/api/menu';

  const elTabs = document.getElementById('category-tabs');
  const elGrid = document.getElementById('menu-grid');
  const elLoading = document.getElementById('state-loading');
  const elError = document.getElementById('state-error');
  const elUpdated = document.getElementById('last-updated');
  const elOrderCta = document.getElementById('order-cta');

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

  function renderTabs() {
    elTabs.innerHTML = '';
    const all = document.createElement('button');
    all.className = 'tab' + (state.active === 'All Items' ? ' active' : '');
    all.textContent = 'All Items';
    all.addEventListener('click', () => { state.active = 'All Items'; renderTabs(); renderGrid(); });
    elTabs.appendChild(all);

    state.categories.forEach(cat => {
      const b = document.createElement('button');
      b.className = 'tab' + (state.active === cat ? ' active' : '');
      b.textContent = cat;
      b.addEventListener('click', () => { state.active = cat; renderTabs(); renderGrid(); });
      elTabs.appendChild(b);
    });
  }

  function renderGrid() {
    const items = state.active === 'All Items'
      ? state.items
      : state.items.filter(it => it.category === state.active);

    elGrid.innerHTML = '';
    items.forEach(it => {
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

      elGrid.appendChild(card);
    });

    elGrid.style.display = 'grid';
    elLoading.style.display = 'none';
    elError.style.display = 'none';
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
    elGrid.style.display = 'none';
    elError.style.display = 'block';
  }

  async function loadMenu() {
    elLoading.style.display = 'block';
    elGrid.style.display = 'none';
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
      renderTabs();
      renderGrid();
    } catch (e) {
      showError(e.message || 'Failed to load menu');
    }
  }

  loadMenu();
})();
