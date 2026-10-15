(function () {
  const $ = (sel, root = document) => root.querySelector(sel);

  // ----- Mobile sidebar -----
  const sidebar = $('#sidebar');
  const scrim = $('#scrim');
  const menuToggle = $('#menuToggle');

  function setMenu(open) {
    sidebar.classList.toggle('open', open);
    scrim.classList.toggle('show', open);
    menuToggle.setAttribute('aria-expanded', String(open));
  }
  menuToggle.addEventListener('click', () => setMenu(!sidebar.classList.contains('open')));
  scrim.addEventListener('click', () => setMenu(false));

  // ----- Old price / discount % / new price helper -----
  const oldEl = $('#pOldPrice');
  const discEl = $('#pDiscount');
  const priceEl = $('#pPrice');
  const note = $('#discountNote');
  const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (el) => { const v = parseFloat(el.value); return Number.isFinite(v) ? v : null; };

  function refreshNote() {
    const oldP = num(oldEl);
    const price = num(priceEl);
    note.className = 'hint';
    if (oldP === null || price === null || oldP === 0) {
      note.textContent = 'No discount. Enter an old price and a discount %, or type the new price yourself.';
    } else if (oldP <= price) {
      note.textContent = 'The old price must be higher than the new price. Leave it empty if there is no discount.';
      note.classList.add('bad');
    } else {
      const pct = (1 - price / oldP) * 100;
      note.textContent = pct.toFixed(Number.isInteger(Math.round(pct * 10) / 10) ? 0 : 1) + '% off. Customers save ' + peso(oldP - price) + '.';
      note.classList.add('good');
    }
  }

  function discountFromPrices() {
    const oldP = num(oldEl);
    const price = num(priceEl);
    discEl.value = oldP && price !== null && oldP > price ? Math.round((1 - price / oldP) * 1000) / 10 : '';
    refreshNote();
  }

  discEl.addEventListener('input', () => {
    const oldP = num(oldEl);
    const d = num(discEl);
    if (oldP !== null && d !== null && d >= 0 && d < 100) {
      priceEl.value = (Math.round(oldP * (1 - d / 100) * 100) / 100).toFixed(2);
    }
    refreshNote();
  });
  oldEl.addEventListener('input', () => {
    const oldP = num(oldEl);
    const d = num(discEl);
    if (oldP !== null && d !== null && d >= 0 && d < 100) {
      priceEl.value = (Math.round(oldP * (1 - d / 100) * 100) / 100).toFixed(2);
      refreshNote();
    } else {
      discountFromPrices();
    }
  });
  priceEl.addEventListener('input', discountFromPrices);

  // ----- Add / edit product dialog -----
  const dialog = $('#productDialog');
  const form = $('#productForm');
  const title = $('#dialogTitle');

  function openDialog(mode, data) {
    form.reset();
    if (mode === 'edit') {
      title.textContent = 'Edit product';
      form.action = '/admin/products/' + encodeURIComponent(data.id);
      $('#pName').value = data.name;
      $('#pCategory').value = data.category;
      $('#pPrice').value = data.price;
      $('#pOldPrice').value = data.oldPrice;
      $('#pStock').value = data.stock;
      $('#pBadge').value = data.badge;
      $('#pDescription').value = data.description;
      $('#pImage').value = data.image;
    } else {
      title.textContent = 'Add product';
      form.action = '/admin/products';
    }
    discountFromPrices();
    dialog.showModal();
    $('#pName').focus();
  }

  $('#openAdd').addEventListener('click', () => openDialog('add'));
  $('#cancelDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  document.querySelectorAll('.js-edit').forEach((btn) => {
    btn.addEventListener('click', () => openDialog('edit', {
      id: btn.dataset.id,
      name: btn.dataset.name,
      category: btn.dataset.category,
      price: btn.dataset.price,
      oldPrice: btn.dataset.oldPrice,
      stock: btn.dataset.stock,
      image: btn.dataset.image,
      badge: btn.dataset.badge,
      description: btn.dataset.description
    }));
  });

  // ----- Confirm before destructive actions -----
  document.querySelectorAll('form[data-confirm]').forEach((f) => {
    f.addEventListener('submit', (e) => {
      if (!window.confirm(f.dataset.confirm)) e.preventDefault();
    });
  });

  // ----- Product search -----
  const search = $('#productSearch');
  const rows = document.querySelectorAll('#productTable tbody tr');
  const empty = $('#productEmpty');

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach((row) => {
      const match = row.textContent.toLowerCase().includes(q);
      row.hidden = !match;
      if (match) visible++;
    });
    empty.classList.toggle('show', visible === 0);
  });
})();
