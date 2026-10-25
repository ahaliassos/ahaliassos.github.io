import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readVerifiedCV, appointmentTitle, appointmentDates } from './cv-source.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const profile = JSON.parse(await readFile(path.join(root, 'data/profile.json'), 'utf8'));
const cvData = JSON.parse(await readFile(path.join(root, 'data/cv.json'), 'utf8'));
const papers = JSON.parse(await readFile(path.join(root, 'data/publications.json'), 'utf8')).sort((a, b) => b.year - a.year);
const chapterCount = papers.filter(paper => paper.venue === 'Book chapter').length;
const paperCount = papers.length - chapterCount;
const publicationCount = `${paperCount} ${paperCount === 1 ? 'paper' : 'papers'} & ${chapterCount} ${chapterCount === 1 ? 'chapter' : 'chapters'}`;
const cvPDF = await readVerifiedCV();
const out = path.join(root, 'dist');
const origin = (process.env.SITE_URL || profile.canonicalUrl).replace(/\/$/, '');
const siteRoot = `${new URL(origin).pathname.replace(/\/$/, '')}/`;
const natwestPeriod = `${profile.employment.natwest.start}–present`;
const metaPostdocPeriod = `${profile.employment.metaPostdoc.start}–${profile.employment.metaPostdoc.end}`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow = '<span aria-hidden="true">↗</span>';
const right = '<span aria-hidden="true">→</span>';
const ext = (href, text, cls = '') => `<a class="${cls}" href="${esc(href)}">${text} ${arrow}</a>`;
const reviewingVenues = profile.reviewing.map(({venue, years}) => `<strong>${esc(venue)}</strong>${years ? ` (${esc(years)})` : ''}`);
const reviewingHTML = `Reviewer for ${reviewingVenues.slice(0,-1).join(', ')}, and ${reviewingVenues.at(-1)}.`;
const authorText = paper => paper.authors.map(a => `${a === profile.name ? `<strong>${esc(a)}</strong>` : esc(a)}${paper.equalContribution?.includes(a) ? '<sup>*</sup>' : ''}`).join(', ');
const paperLinks = paper => `<div class="paper-links">${ext(paper.paper, 'Paper')}${paper.code ? ext(paper.code, 'Code') : ''}${paper.project ? ext(paper.project, 'Project') : ''}<a href="publications.html#${paper.id}" class="details-link">Details ${right}</a></div>`;

function portrait() {
  return `<figure class="portrait"><img src="${esc(profile.portrait.src)}" alt="${esc(profile.name)}" width="${profile.portrait.width}" height="${profile.portrait.height}" fetchpriority="high" decoding="async"></figure>`;
}

function paperFigure(paper) {
  const figure = paper.figure;
  return `<figure class="paper-figure art-${paper.id}"><div class="paper-art"><img src="${esc(figure.src)}" width="${figure.width}" height="${figure.height}" alt="${esc(figure.alt)}" loading="lazy" decoding="async"></div></figure>`;
}

function header(active = 'home', rootPrefix = '') {
  return `<a class="skip-link" href="#main">Skip to content</a><header class="site-header wrap"><a class="site-name" href="${rootPrefix}index.html" aria-label="Alexandros Haliassos — home">Alexandros Haliassos</a><nav aria-label="Main navigation"><a href="${rootPrefix}index.html#about" ${active === 'home' ? 'aria-current="page"' : ''}>About</a><a href="${rootPrefix}publications.html" ${active === 'publications' ? 'aria-current="page"' : ''}>Publications</a><a href="${rootPrefix}cv.html" ${active === 'cv' ? 'aria-current="page"' : ''}>CV</a><a class="nav-contact" href="${rootPrefix}index.html#contact">Contact ${arrow}</a></nav></header>`;
}
function footer(rootPrefix = '') {
  return `<footer class="site-footer wrap"><a href="${rootPrefix}index.html">Alexandros Haliassos</a><span>London, UK</span><a href="#top">Back to top ↑</a></footer>`;
}
function shell(title, body, active, filename = '') {
  // Error pages may be served at any missing URL, including nested paths.
  const rootPrefix = filename === '404.html' ? siteRoot : '';
  const canonical = `${origin}/${filename}`;
  return `<!doctype html>
<html lang="en-GB" id="top"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="theme-color" content="#f7f6f2"><title>${esc(title)}</title><meta name="description" content="${esc(profile.description)}"><link rel="canonical" href="${esc(canonical)}"><link rel="icon" href="${rootPrefix}assets/favicon.svg" type="image/svg+xml"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(profile.description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${origin}/assets/social-preview.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Alexandros Haliassos — AI research in deepfake detection, audiovisual learning and robust machine learning"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="${rootPrefix}assets/style.css"><script defer src="${rootPrefix}assets/site.js"></script><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Person',name:profile.name,url:origin,image:`${origin}/${profile.portrait.src}`,jobTitle:profile.role,worksFor:{'@type':'Organization',name:'NatWest Group'},alumniOf:{'@type':'CollegeOrUniversity',name:'Imperial College London'},sameAs:[profile.scholar,profile.github,profile.linkedin],knowsAbout:['Deepfake detection','Audiovisual representation learning','Speech recognition','Self-supervised learning']}).replace(/</g,'\\u003c')}</script></head><body>${header(active, rootPrefix)}${body}${footer(rootPrefix)}</body></html>`;
}
function publicationNote(paper) {
  if (!paper.reviewNote) return '';
  const {text, sourceName, source} = paper.reviewNote;
  return `<p class="publication-note">${esc(text)} <a href="${esc(source)}">${esc(sourceName)}</a>.</p>`;
}

function featured(paper) {
  return `<article class="featured-paper" id="${paper.id}">${paperFigure(paper)}<div class="feature-body"><div class="paper-meta"><span>${paper.venue} ${paper.year}</span><span>${paper.shortName}</span></div><h3><a href="${paper.paper}">${esc(paper.title)}</a></h3><p class="paper-summary">${esc(paper.summary)}</p><p class="authors">${authorText(paper)}</p>${publicationNote(paper)}${paperLinks(paper)}</div></article>`;
}
function compact(paper, full = false) {
  return `<article class="paper-row ${full ? 'publication' : ''}" id="${paper.id}" ${full ? `data-topics="${paper.topics.join(' ')}" data-search="${esc([paper.title,...paper.authors,paper.venue,paper.year,paper.shortName].join(' ').toLowerCase())}"` : ''}><div class="paper-year"><span>${paper.venue}</span><span>${paper.year}</span>${paper.status ? `<span class="paper-status">${esc(paper.status)}</span>` : ''}</div><div class="paper-content"><${full ? 'h2' : 'h3'}><a href="${paper.paper}">${esc(paper.title)}</a></${full ? 'h2' : 'h3'}><p class="authors">${authorText(paper)}</p><p class="paper-summary">${esc(paper.summary)}</p>${paper.equalContribution ? '<p class="equal-note">* Equal contribution</p>' : ''}${publicationNote(paper)}<div class="paper-links">${ext(paper.paper, 'Paper')}${paper.code ? ext(paper.code, 'Code') : ''}${paper.project ? ext(paper.project, 'Project') : ''}${full ? `<details class="citation"><summary>BibTeX</summary><div class="citation-content"><pre>${esc(bibtex(paper))}</pre><button type="button" class="copy-citation" aria-label="Copy citation for ${esc(paper.shortName)}" hidden>Copy citation</button></div></details>` : ''}</div></div></article>`;
}
function bibtex(p) {
  const type = p.venue === 'Preprint' || p.venue === 'IEEE TNNLS' ? 'article' : p.venue === 'Book chapter' ? 'incollection' : 'inproceedings';
  const venueField = type === 'article' ? 'journal' : 'booktitle';
  const venue = p.booktitle || (p.venue === 'Preprint' ? 'arXiv preprint arXiv:2510.23581' : p.venue === 'IEEE TNNLS' ? 'IEEE Transactions on Neural Networks and Learning Systems' : p.venue === 'Book chapter' ? 'Visual Computing for Cultural Heritage' : p.venue);
  // Preserve acronyms and method names when a bibliography style changes case.
  const title = p.title.replace(/\b(?:[A-Za-z]+-)*[A-Z][A-Za-z]*[A-Z][A-Za-z]*\b/g, '{$&}');
  return `@${type}{${p.id}${p.year},\n  title = {${title}},\n  author = {${p.authors.join(' and ')}},\n  ${venueField} = {${venue}},\n  year = {${p.year}},\n${p.status ? `  note = {${p.status}},\n` : ''}  url = {${p.paper}}\n}`;
}

const home = `<main id="main"><section class="hero wrap" id="about"><div class="hero-content"><h1>Alexandros<br>Haliassos</h1><p class="role">${esc(profile.role)}</p><p class="affiliation">${esc(profile.affiliation)} · ${esc(profile.location)}</p><div class="bio"><p>My research focuses on self-supervised learning, audiovisual understanding and robust machine learning. At NatWest’s CAIRO research group, I design models for audio and audiovisual deepfake detection and speaker verification.</p><p>Previously, I worked at Meta and completed my PhD at Imperial College London, supervised by Prof. Maja Pantic.</p></div><div class="social-links"><a href="assets/alexandros-haliassos-cv.pdf" download>CV (PDF) <span aria-hidden="true">↓</span></a>${ext(profile.scholar,'Google Scholar')}${ext(profile.github,'GitHub')}${ext(profile.linkedin,'LinkedIn')}<a href="mailto:${profile.email}">Email ${arrow}</a></div></div>${portrait()}</section>
<section class="research-focus wrap" aria-labelledby="focus-heading"><div class="section-kicker" id="focus-heading">RESEARCH FOCUS</div><div class="focus-grid"><div><span class="focus-number">01</span><h2>Deepfake detection</h2><p>Detecting manipulated media and generalising to unseen forgery methods.</p></div><div><span class="focus-number">02</span><h2>Audiovisual learning</h2><p>Learning representations from audio and video using self-supervision.</p></div><div><span class="focus-number">03</span><h2>Robust machine learning</h2><p>Improving model robustness to noise, unseen conditions and distribution shifts.</p></div></div></section>
<section class="research-section wrap" id="research" aria-labelledby="research-heading"><div class="section-heading"><div><p class="eyebrow">PAPERS & OPEN-SOURCE CODE</p><h2 id="research-heading">Selected research</h2></div><a class="text-link" href="publications.html">All publications ${right}</a></div><div class="featured-grid">${featured(papers.find(p=>p.id==='usr2'))}${featured(papers.find(p=>p.id==='realforensics'))}</div><div class="selected-list">${['usr','raven','lipforensics'].map(id=>compact(papers.find(p=>p.id===id))).join('')}</div><a class="all-research" href="publications.html">All publications <span>${esc(publicationCount)} ${right}</span></a></section>
<section class="background-section wrap" id="background" aria-labelledby="background-heading"><div class="background-intro"><p class="eyebrow">RESEARCH & EXPERIENCE</p><h2 id="background-heading">Background</h2><a class="text-link" href="cv.html">View my CV ${right}</a></div><div class="timeline"><article><span class="timeline-date current">${esc(natwestPeriod.toUpperCase())}</span><h3>NatWest Group</h3><p class="timeline-role">${esc(profile.role)} · CAIRO research group</p><p>Audio and audiovisual deepfake detection and speaker verification, with a focus on self-supervised learning and robustness.</p></article><article><span class="timeline-date">2022–2025</span><h3>Meta</h3><p class="timeline-role">AI Research</p><p>Postdoctoral researcher (${esc(metaPostdocPeriod)}), with earlier research internships in 2022 and 2023 and external collaboration in 2022.</p><p>Audiovisual representation learning, speech recognition, robust models and audio-driven facial animation.</p></article><article><span class="timeline-date">2020–2024</span><h3>Imperial College London</h3><p class="timeline-role">PhD in Machine Learning</p><p>Supervised by Prof. Maja Pantic. Funded by an Imperial President’s PhD Scholarship.</p><p class="thesis">Learning from Talking Faces: From DeepFake Detection to Speech Recognition</p></article><article><span class="timeline-date">2014–2019</span><h3>Imperial College London</h3><p class="timeline-role">MEng in Electrical and Electronic Engineering</p><p>${esc(profile.educationHighlights.meng.join(' '))}</p><p>Henry Ford II Scholar Award · Dean’s List (three times)</p></article></div></section>
<section class="service-section wrap" aria-labelledby="service-heading"><h2 id="service-heading">Recognition & service</h2><div><h3>CVPR Outstanding Reviewer</h3><p>2022 · 2024 · 2026</p></div><div><h3>Peer review</h3><p>${reviewingHTML}</p></div></section>
<section class="contact-section" id="contact" aria-labelledby="contact-heading"><div class="wrap contact-inner"><div><h2 id="contact-heading">Contact</h2></div><a class="contact-email" href="mailto:${profile.email}">${profile.email} ${arrow}</a></div></section></main>`;

const topics = [['all','All work'],['deepfakes','Deepfake detection'],['representation','Representation learning'],['speech','Speech'],['generation','Generation'],['other','Other work']];
const publications = `<main id="main" class="wrap publications-main"><section class="page-intro"><h1>Publications</h1><p>${paperCount} papers and ${chapterCount} book ${chapterCount === 1 ? 'chapter' : 'chapters'}, spanning deepfake detection, audiovisual learning, speech processing, and earlier work in computer vision and signal processing.</p><div class="intro-links">${ext(profile.scholar, 'Google Scholar')}<a href="assets/publications.bib" download>Download bibliography ↓</a></div></section><div class="publication-controls" hidden><div class="filter-buttons" role="group" aria-label="Filter publications by topic">${topics.map(([id,label])=>`<button type="button" data-filter="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</div><div class="search-row"><label class="search-label" for="publication-search"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="1.5"/></svg><input type="search" id="publication-search" placeholder="Search titles, authors, venues…" autocomplete="off"><span class="sr-only">Search publications</span></label><p class="result-count" role="status" aria-live="polite">${papers.length} publications</p></div></div><div id="publication-list">${papers.map(p=>compact(p,true)).join('')}</div><div class="empty-state" hidden><h2>No matching publications</h2><p>Try a different search or topic.</p><button type="button" id="reset-search">Clear filters ${right}</button></div><p class="bibliography-note">Papers are listed by conference or publication year.</p></main>`;

const cv = `<main id="main" class="wrap cv-main">
<section class="page-intro"><p class="eyebrow">CURRICULUM VITAE</p><h1>${esc(profile.name)}</h1><p>${esc(profile.role)} · ${esc(profile.affiliation)}</p><div class="intro-links"><a href="assets/alexandros-haliassos-cv.pdf" download>Download CV (PDF) ↓</a><a href="mailto:${profile.email}">${profile.email}</a></div></section>
<section class="cv-section"><h2>Research interests</h2><p>${esc(cvData.researchInterests)}</p></section>
<section class="cv-section"><h2>Research experience</h2>${cvData.experience.map(employer=>`<article><h3>${esc(employer.organisation)}</h3>${employer.appointments.map(appointment=>`<div class="cv-appointment"><div class="cv-heading"><h4>${esc(appointmentTitle(appointment,profile))}</h4><span>${esc(appointmentDates(appointment,profile))}</span></div><ul>${appointment.details.map(detail=>`<li>${esc(detail)}</li>`).join('')}</ul></div>`).join('')}</article>`).join('')}</section>
<section class="cv-section"><h2>Education</h2>${cvData.education.map(education=>`<article><div class="cv-heading"><h3>${esc(education.degree)}</h3><span>${esc(education.dates)}</span></div><p>${esc(education.institution)}</p>${(education.highlights?profile.educationHighlights[education.highlights]:education.details).map(detail=>`<p>${esc(detail)}</p>`).join('')}${education.thesis?`<p>Thesis: <em>${esc(education.thesis)}.</em></p><p>${esc(education.research)}</p>`:''}</article>`).join('')}</section>
<section class="cv-section"><h2>Selected first-author publications</h2><div class="cv-papers">${cvData.selectedPublications.map(id=>papers.find(p=>p.id===id)).map(p=>`<article><h3><a href="${p.paper}">${esc(p.title)}</a></h3><p>${authorText(p)}. <strong>${p.venue} ${p.year}.</strong></p>${p.equalContribution?'<p>* Equal contribution</p>':''}</article>`).join('')}</div><a class="text-link" href="publications.html">Complete publication list ${right}</a></section>
<section class="cv-section"><h2>Awards & honours</h2><ul>${profile.honours.map(honour=>`<li>${esc(honour)}</li>`).join('')}</ul></section>
<section class="cv-section"><h2>Reviewing service</h2><p>${reviewingHTML}</p></section>
<section class="cv-section"><h2>Earlier experience</h2>${cvData.earlierExperience.map(experience=>`<article><div class="cv-heading"><h3>${esc(experience.organisation)} · ${esc(experience.role)}</h3><span>${esc(experience.dates)}</span></div><p>${esc(experience.detail)}</p></article>`).join('')}</section>
<section class="cv-section"><h2>Languages</h2><p>${esc(cvData.languages)}</p></section><p class="cv-updated">Updated October 2026</p></main>`;

await mkdir(path.join(out, 'assets'), {recursive:true});
await cp(path.join(root, 'assets'), path.join(out,'assets'), {recursive:true});
await Promise.all([
  writeFile(path.join(out,'index.html'),shell('Alexandros Haliassos — AI Research',home,'home')),
  writeFile(path.join(out,'publications.html'),shell('Publications — Alexandros Haliassos',publications,'publications','publications.html')),
  writeFile(path.join(out,'cv.html'),shell('CV — Alexandros Haliassos',cv,'cv','cv.html')),
  writeFile(path.join(out,'404.html'),shell('Page not found — Alexandros Haliassos',`<main id="main" class="wrap page-intro not-found"><p class="eyebrow">404 / PAGE NOT FOUND</p><h1>Page not found</h1><p>This page could not be found.</p><a class="text-link" href="${siteRoot}index.html">Back to the homepage →</a></main>`,'none','404.html')),
  writeFile(path.join(out,'assets/publications.bib'),papers.map(bibtex).join('\n\n')+'\n'),
  writeFile(path.join(out,'assets/alexandros-haliassos-cv.pdf'),cvPDF),
  writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`),
  writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['','publications.html','cv.html'].map(p=>`<url><loc>${esc(origin+'/'+p)}</loc><lastmod>${profile.updated}</lastmod></url>`).join('')}</urlset>`),
  writeFile(path.join(out,'.nojekyll'),'')
]);
console.log(`Built ${papers.length} publications, 4 pages and CV PDF into dist/. Canonical origin: ${origin}`);
