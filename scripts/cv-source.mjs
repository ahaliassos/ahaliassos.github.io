import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const digest = value => createHash('sha256').update(value).digest('hex');

export function appointmentTitle(appointment, profile) {
  return appointment.currentRole ? profile.role : appointment.title;
}
export function appointmentDates(appointment, profile) {
  if (!appointment.period) return appointment.dates;
  const { start, end } = profile.employment[appointment.period];
  return `${start}–${end || 'present'}`;
}
const abbreviateDates = dates => dates.replace(/January|February|March|April|June|July|August|September|October|November|December/g,
  month => ({January:'Jan',February:'Feb',March:'Mar',April:'Apr',June:'Jun',July:'Jul',August:'Aug',September:'Sep',October:'Oct',November:'Nov',December:'Dec'}[month]));
const tex = value => String(value).replace(/[\\{}%&#_$~^]/g, char => ({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','%':'\\%','&':'\\&','#':'\\#','_':'\\_','$':'\\$','~':'\\textasciitilde{}','^':'\\textasciicircum{}'}[char]))
  .replace(/[‘’]/g,"'").replace(/“/g,'``').replace(/”/g,"''").replace(/–/g,'--').replace(/—/g,'---').replace(/·/g,'|');
const link = (url, label) => `\\href{${tex(url)}}{${tex(label)}}`;
const list = values => `\\begin{itemize}\n${values.map(value => `  \\item ${tex(value)}`).join('\n')}\n\\end{itemize}`;

export function renderCV(profile, papers, cv, template) {
  const pageOne = [
    '\\cvsection{Research interests}', `${tex(cv.researchInterests)}\\par`,
    '\\cvsection{Research experience}',
    ...cv.experience.map(employer => [
      `\\organisation{${tex(employer.organisation)}}`,
      ...employer.appointments.map((appointment, index) => [
        index ? '\\vspace{4pt}' : '',
        `\\appointment{${tex(appointmentTitle(appointment,profile))}}{${tex(abbreviateDates(appointmentDates(appointment,profile)))}}`,
        list(appointment.details)
      ].join('\n')),
      '\\entrygap'
    ].join('\n')),
    '\\cvsection{Education}',
    ...cv.education.map(education => [
      `\\dated{${tex(education.degree)}}{${tex(abbreviateDates(education.dates))}}`,
      `${tex(education.institution)}\\par`,
      list(education.highlights ? profile.educationHighlights[education.highlights] : education.details),
      education.thesis ? `\\textbf{Thesis:} ${tex(education.thesis)}.\\par\n\\vspace{2pt}\n${tex(education.research)}\\par` : '',
      '\\entrygap'
    ].join('\n'))
  ].join('\n');

  const selected = cv.selectedPublications.map(id => {
    const paper = papers.find(p => p.id === id);
    if (!paper) throw new Error(`CV publication not found: ${id}`);
    return paper;
  });
  const venues = profile.reviewing.map(({venue,years}) => `\\textbf{${tex(venue)}}${years ? ` (${tex(years)})` : ''}`);
  const pageTwo = [
    '\\cvsection{Selected first-author publications}',
    ...selected.map(paper => {
      const authors = paper.authors.map(author => `${author === profile.name ? `\\textbf{${tex(author)}}` : tex(author)}${paper.equalContribution?.includes(author) ? '\\textsuperscript{*}' : ''}`).join(', ');
      return `\\paper{${tex(paper.paper)}}{${tex(paper.title)}}{${authors}}{${tex(paper.venue)} ${paper.year}}`;
    }),
    selected.some(paper => paper.equalContribution) ? '{\\fontsize{9}{11}\\selectfont * Equal contribution.\\par}\\vspace{4pt}' : '',
    `{\\fontsize{9.5}{12}\\selectfont Complete publication list: ${link(`${profile.canonicalUrl}/publications.html`,`${new URL(profile.canonicalUrl).host}/publications.html`)}\\par}`,
    '\\cvsection{Awards and honours}',
    list(profile.honours),
    '\\cvsection{Reviewing service}',
    `Reviewer for ${venues.slice(0,-1).join(', ')}, and ${venues.at(-1)}.\\par`,
    '\\cvsection{Earlier experience}',
    ...cv.earlierExperience.map(experience => [
      `\\dated{${tex(experience.organisation)} --- ${tex(experience.role)}}{${tex(abbreviateDates(experience.dates))}}`,
      `${tex(experience.detail)}\\par`,
      '\\entrygap'
    ].join('\n')),
    '\\cvsection{Languages}', tex(cv.languages)
  ].join('\n');

  const updated = new Date(`${profile.updated}T12:00:00Z`).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
  const replacements = {
    NAME:tex(profile.name), ROLE:tex(profile.role), AFFILIATION:tex(profile.affiliation), UPDATED:tex(updated),
    CONTACT:`${tex(profile.location)}\\quad|\\quad${link(`mailto:${profile.email}`,profile.email)}\\quad|\\quad${link(profile.canonicalUrl,new URL(profile.canonicalUrl).host)}`,
    LINKS:[link(profile.scholar,'Google Scholar'),link(profile.github,'GitHub'),link(profile.linkedin,'LinkedIn')].join('\\quad|\\quad'),
    PAGE_ONE:pageOne, PAGE_TWO:pageTwo
  };
  return template.replace(/@@([A-Z_]+)@@/g, (_,key) => {
    if (!(key in replacements)) throw new Error(`Unknown CV template token: ${key}`);
    return replacements[key];
  });
}

export async function cvInputs() {
  const [profile,papers,cv,template] = await Promise.all([
    readFile(path.join(root,'data/profile.json'),'utf8'),
    readFile(path.join(root,'data/publications.json'),'utf8'),
    readFile(path.join(root,'data/cv.json'),'utf8'),
    readFile(path.join(root,'cv/template.tex'),'utf8')
  ]);
  return {profile:JSON.parse(profile),papers:JSON.parse(papers),cv:JSON.parse(cv),template};
}

// Website builds need only Node. Typesetting is a separate, explicit step;
// reject stale PDFs so a data edit can never silently leave the download behind.
export async function readVerifiedCV() {
  const {profile,papers,cv,template} = await cvInputs();
  const expected = renderCV(profile,papers,cv,template);
  const [source,pdf,manifestText] = await Promise.all([
    readFile(path.join(root,'cv/alexandros-haliassos-cv.tex'),'utf8'),
    readFile(path.join(root,'assets/alexandros-haliassos-cv.pdf')),
    readFile(path.join(root,'cv/build.json'),'utf8')
  ]);
  const manifest = JSON.parse(manifestText);
  if (source !== expected || manifest.sourceSha256 !== digest(expected) || manifest.pdfSha256 !== digest(pdf)) {
    throw new Error('The CV PDF is stale. Run npm run build:cv, then npm run build.');
  }
  if (manifest.pages !== 2 || !pdf.subarray(0,8).toString().startsWith('%PDF-')) {
    throw new Error('Expected a valid, two-page CV PDF.');
  }
  return pdf;
}
