(function () {
  'use strict';
  const root = document.getElementById('email-creation-preview');
  const byRole = (role) => root.querySelector('[data-role="' + role + '"]');
  const pack = JSON.parse(byRole('data').textContent);
  const brand = pack.brand;
  const state = { scenario: brand.defaultScenario, language: pack.defaultLocale, device: 'desktop' };
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const action = (text, className) => '<button type="button" class="' + className + '" data-preview-action><span>' + escape(text) + '</span></button>';
  const bdi = (text) => '<bdi>' + escape(text) + '</bdi>';
  pack.locales.forEach((locale) => {
    const option = document.createElement('option');
    option.value = locale.code;
    option.textContent = locale.label;
    byRole('language').appendChild(option);
  });

  function render() {
    const locale = pack.locales.find((entry) => entry.code === state.language);
    const copy = pack.messages[state.language], ui = copy.ui;
    const item = brand.catalog.find((entry) => entry.id === state.scenario);
    const d = copy.templates[item.id], view = pack.views[state.language][item.id];
    root.lang = locale.tag;
    root.setAttribute('aria-label', brand.name + ' · ' + ui.previewLabel);
    root.querySelector('.se-controls').setAttribute('aria-label', ui.preview);
    root.querySelector('.se-controls').dir = locale.dir;
    root.querySelector('.se-canvas').setAttribute('aria-label', ui.previewLabel);
    root.querySelector('.se-inbox').dataset.device = state.device;
    root.querySelector('.se-inbox').lang = locale.tag;
    root.querySelector('.se-meta').dir = locale.dir;
    byRole('email').dir = locale.dir;
    byRole('email').setAttribute('aria-label', d.subject);
    byRole('footer').dir = locale.dir;
    byRole('status').dir = locale.dir;
    [['scenario', ui.scenario], ['language', ui.language], ['device', ui.preview]].forEach(([role, text]) => {
      byRole(role + '-label').textContent = text;
      byRole(role).setAttribute('aria-label', text);
    });
    byRole('scenario').replaceChildren();
    brand.groups.forEach((groupId) => {
      const group = document.createElement('optgroup');
      group.label = ui.groups[groupId];
      brand.catalog.filter((entry) => entry.group === groupId).forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = copy.templates[entry.id].name;
        group.appendChild(option);
      });
      byRole('scenario').appendChild(group);
    });
    byRole('scenario').value = item.id;
    byRole('language').value = locale.code;
    byRole('device').value = state.device;
    byRole('device').options[0].textContent = ui.desktop;
    byRole('device').options[1].textContent = ui.mobile;
    byRole('preview-label').textContent = ui.previewLabel;
    byRole('kind').textContent = ui.groups[item.group];
    byRole('subject').textContent = d.subject;
    byRole('preheader').textContent = d.preview;
    const rows = view.details.length ? '<dl class="se-detail">' + view.details.map(([label, value]) => '<div class="se-detail-row"><dt>' + escape(label) + '</dt><dd>' + bdi(value) + '</dd></div>').join('') + '</dl>' : '';
    const post = view.post ? '<div class="se-post"><div class="se-post-top"><span class="se-avatar">' + escape(view.post.avatar) + '</span>' + bdi(view.post.account) + '</div><p>' + escape(ui.samplePost) + '</p><div class="se-status">' + escape(ui.mediaUnavailable) + ' · ' + bdi(view.post.platform) + '</div></div>' : '';
    const code = view.code ? '<div class="se-code" aria-label="' + escape(ui.codeLabel) + '">' + escape(view.code) + '</div><p class="se-note se-center-note">' + escape(ui.codeLabel) + '</p>' : '';
    const callout = d.callout ? '<div class="se-callout ' + (item.tone === 'danger' ? 'danger' : '') + '">' + escape(d.callout) + '</div>' : '';
    const fallback = item.fallback ? '<p class="se-note">' + escape(ui.fallback) + '<br>' + action(ui.secureLink, 'se-secondary') + '</p>' : '';
    byRole('email').innerHTML = '<div class="se-inner"><div class="se-symbol ' + (item.tone || '') + '" aria-hidden="true"><span></span></div><p class="se-kicker">' + escape(ui.groups[item.group]) + '</p><h2 class="se-title">' + escape(d.title) + '</h2><p class="se-copy se-greeting">' + escape(view.greeting) + '</p><p class="se-copy">' + escape(d.body) + '</p>' + code + post + rows + callout + '<div class="se-action-row">' + action(d.cta, 'se-primary') + '</div>' + (d.note ? '<p class="se-note">' + escape(d.note) + '</p>' : '') + fallback + '<p class="se-signature"><strong>' + escape(ui.team) + '</strong></p></div><div class="se-help">' + escape(ui.help) + ' ' + action(ui.contact, '') + '</div>';
    byRole('footer').innerHTML = '<p><strong>' + escape(brand.name) + '</strong> · ' + bdi(brand.website) + '</p><p>' + escape(ui.footer) + '</p>';
    byRole('status').textContent = ui.demoNotice;
  }

  [['scenario', 'scenario'], ['language', 'language'], ['device', 'device']].forEach(([role, key]) => {
    byRole(role).addEventListener('change', () => { state[key] = byRole(role).value; render(); });
  });
  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-preview-action]')) {
      byRole('status').textContent = pack.messages[state.language].ui.actionNotice;
    }
  });
  render();
})();
