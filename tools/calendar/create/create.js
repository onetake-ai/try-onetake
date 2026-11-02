/**
 * Link generator (/tools/calendar/create/): turns a Proton calendar share link into a link to the
 * calendar page (format ?id=&key=, see ../link.js), then checks it through the relay.
 */

import { parseLink, linkProblem } from '../link.js';

const $ = (id) => document.getElementById(id);

function message(key, values) {
  const el = document.querySelector('#messages [data-msg="' + key + '"]');
  let text = el ? el.textContent.trim() : '';
  Object.keys(values || {}).forEach((k) => { text = text.replace('{' + k + '}', values[k]); });
  return text;
}

function showError(key) {
  $('makerError').textContent = message(key);
  $('makerError').hidden = false;
  $('protonLink').setAttribute('aria-invalid', 'true');
  $('makerResult').hidden = true;
}

function clearError() {
  $('makerError').hidden = true;
  $('protonLink').removeAttribute('aria-invalid');
}

// Calendar name and number of events (moved occurrences of a recurring event don't count)
function summarize(ics) {
  const text = ics.replace(/\r?\n[ \t]/g, '');
  const nameMatch = text.match(/^X-WR-CALNAME:(.*)$/m);
  const name = nameMatch ? nameMatch[1].trim().replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ') : '';
  const events = text.split(/^BEGIN:VEVENT\s*$/m).slice(1);
  const count = events.filter((block) => !/^RECURRENCE-ID[;:]/m.test(block.split(/^END:VEVENT/m)[0])).length;
  return { name, count };
}

let checkId = 0;

async function check(link) {
  const id = ++checkId;
  const status = $('makerCheck');
  status.className = 'maker__check';
  status.textContent = message('checking');

  let key = 'unchecked';
  let values = {};
  try {
    const res = await fetch(link.relay);
    if (res.status === 404) {
      key = 'notFound';
    } else if (res.ok) {
      const { name, count } = summarize(await res.text());
      key = count === 0 ? 'empty_calendar' : (name ? 'works' : 'worksNoName');
      values = { name, count };
    }
  } catch (e) { /* network or relay down: unchecked */ }

  if (id !== checkId) return;   // a newer link was pasted meanwhile
  status.textContent = message(key, values);
  status.classList.add(key === 'notFound' ? 'maker__check--bad' : key === 'unchecked' ? 'maker__check--unknown' : 'maker__check--ok');
}

function create() {
  const value = $('protonLink').value;
  const link = parseLink(value);
  if (!link) {
    showError(linkProblem(value));
    return;
  }
  clearError();
  $('pageLink').value = link.page;
  $('openLink').href = link.page;
  $('limitedWarning').hidden = !link.limited;
  $('makerResult').hidden = false;
  check(link);
}

async function copy() {
  const button = $('copyLink');
  const input = $('pageLink');
  const original = button.textContent;
  let ok = false;
  try {
    await navigator.clipboard.writeText(input.value);
    ok = true;
  } catch (e) {
    input.select();
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
  }
  button.textContent = message(ok ? 'copied' : 'copyFailed');
  if (!ok) input.select();
  setTimeout(() => { button.textContent = original; }, 2500);
}

$('makerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  create();
});

// Pasting a link is enough: no need to click the button
$('protonLink').addEventListener('paste', () => setTimeout(create, 0));

$('copyLink').addEventListener('click', copy);
