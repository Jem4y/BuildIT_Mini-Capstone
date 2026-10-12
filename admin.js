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
      $('#pImage').value = data.image;
    } else {
      title.textContent = 'Add product';
      form.action = '/admin/products';
    }
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
      badge: btn.dataset.badge
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
