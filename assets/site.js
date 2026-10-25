(() => {
  'use strict';
  const controls = document.querySelector('.publication-controls');
  if (controls) {
    const search = document.querySelector('#publication-search');
    const articles = [...document.querySelectorAll('.publication')];
    const filters = [...document.querySelectorAll('[data-filter]')];
    const count = document.querySelector('.result-count');
    const empty = document.querySelector('.empty-state');
    let topic = 'all';
    const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'");
    const apply = () => {
      const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
      let visible = 0;
      for (const article of articles) {
        const matches = (topic === 'all' || article.dataset.topics.split(' ').includes(topic)) && words.every(word => normalize(article.dataset.search).includes(word));
        article.hidden = !matches;
        if (matches) visible++;
      }
      count.textContent = `${visible} publication${visible === 1 ? '' : 's'}`;
      empty.hidden = visible !== 0;
      for (const button of filters) button.setAttribute('aria-pressed', String(button.dataset.filter === topic));
    };
    filters.forEach(button => button.addEventListener('click', () => { topic = button.dataset.filter; apply(); }));
    search.addEventListener('input', apply);
    document.querySelector('#reset-search').addEventListener('click', () => { topic = 'all'; search.value = ''; apply(); search.focus(); });
    controls.hidden = false;
    // Apply restored browser form values as well as direct input.
    apply();
    window.addEventListener('pageshow', apply);
  }
  for (const button of document.querySelectorAll('.copy-citation')) {
    if (!navigator.clipboard?.writeText) continue;
    button.hidden = false;
    button.addEventListener('click', async () => {
      const text = button.previousElementSibling.textContent;
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = 'Copy citation'; }, 1800);
      } catch {
        const range = document.createRange();
        range.selectNodeContents(button.previousElementSibling);
        const selection = window.getSelection();
        selection.removeAllRanges(); selection.addRange(range);
        button.textContent = 'Selected — copy with your keyboard';
      }
    });
  }
  const print = document.querySelector('.print-cv');
  if (print) { print.hidden = false; print.addEventListener('click', () => window.print()); }
})();
