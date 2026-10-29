/**
 * Calendar page (/tools/calendar/): preview of a shared Proton calendar + subscribe buttons.
 *
 * Link: a Proton share link with "https://calendar.proton.me" replaced by this page, e.g.
 *   /tools/calendar/?/api/calendar/v1/url/<calendar ID>/calendar.ics?CacheKey=<key>
 * (also accepted: ?id=<calendar ID>&key=<key>, or the full Proton link after the "?").
 *
 * Proton sends no CORS header, so the preview reads the calendar through our Bunny relay
 * (edge-scripts/calendar-proxy.ts). Subscriptions point straight at Proton.
 * Recurring events are expanded with ical.js; times are converted with Intl, in the time zone
 * picked by the visitor (their own by default).
 */

const PROXY_URL      = 'https://calendarfeed.onetake.ai';   // Bunny script edge-scripts/calendar-proxy.ts
const ICAL_URL       = 'https://cdn.jsdelivr.net/npm/ical.js@2.2.1/dist/ical.min.js';
const PROTON_BASE    = 'https://calendar.proton.me/api/calendar/v1/url/';
const JOIN_EARLY_MS  = 15 * 60 * 1000;   // the Join button lights up 15 minutes before the start
const PAST_DAYS      = 120;              // expansion window of recurring events
const FUTURE_DAYS    = 400;
const MAX_PER_EVENT  = 3000;             // safety cap on occurrences of one recurring event
const MAX_LIST_ITEMS = 100;
const TZ_STORAGE_KEY = 'onetakeCalendarTz';
const DAY_MS         = 86400000;

// Same patterns as the relay
const ID_PATTERN  = /^[A-Za-z0-9_-]{20,200}={0,2}$/;
const KEY_PATTERN = /^[A-Za-z0-9+/_-]{8,100}={0,2}$/;

// Video call links, preferred over any other link as the Join button
const MEETING_PATTERN = /(zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|whereby\.com|webex\.com|meet\.jit\.si|meet\.proton\.me|onetake\.ai|livestorm\.co|streamyard\.com|riverside\.fm|youtube\.com\/live|youtu\.be|gotomeeting\.com|zoho\.com\/meeting)/i;
const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;

const state = {
  link: null,          // { id, key, feed, webcal }
  name: '',
  events: [],          // occurrences, sorted by start
  tz: '',
  month: null,         // { y, m } shown in the grid (m: 1-12)
  loaded: false,
};

const $ = (id) => document.getElementById(id);

// ==========================================
// LINK
// ==========================================

function readLink() {
  const params = new URLSearchParams(location.search);
  let id  = params.get('id');
  let key = params.get('key');

  if (!id || !key) {
    let raw = location.search.slice(1);
    try { raw = decodeURIComponent(raw); } catch (e) { /* keep it encoded */ }
    const idMatch  = raw.match(/\/url\/([A-Za-z0-9_-]+={0,2})\/calendar\.ics/);
    const keyMatch = raw.match(/CacheKey=([A-Za-z0-9+/_-]+={0,2})/);
    id  = idMatch && idMatch[1];
    key = keyMatch && keyMatch[1];
  }

  if (!id || !key) return null;
  key = key.replace(/ /g, '+');   // URLSearchParams turns "+" into a space
  if (!ID_PATTERN.test(id) || !KEY_PATTERN.test(key)) return null;

  const feed = PROTON_BASE + id + '/calendar.ics?CacheKey=' + encodeURIComponent(key);
  return { id, key, feed, webcal: feed.replace(/^https:/, 'webcal:') };
}

// ==========================================
// LANGUAGE AND MESSAGES
// ==========================================

// Messages live in the HTML (#messages) so Weglot translates them
function message(key, values) {
  const el = document.querySelector('#messages [data-msg="' + key + '"]');
  let text = el ? el.textContent.trim() : '';
  Object.keys(values || {}).forEach((k) => { text = text.replace('{' + k + '}', values[k]); });
  return text;
}

// Page language (Weglot first, then <html lang>), with the visitor's region when it matches
function locale() {
  let lang = '';
  if (window.Weglot && typeof Weglot.getCurrentLang === 'function') {
    try { lang = Weglot.getCurrentLang() || ''; } catch (e) { /* Weglot not initialized yet */ }
  }
  lang = (lang || document.documentElement.lang || 'en').toLowerCase();
  const base = lang.split('-')[0];
  const match = (navigator.languages || []).find((l) => l.toLowerCase().split('-')[0] === base);
  try { return Intl.getCanonicalLocales(match || lang)[0]; } catch (e) { return 'en'; }
}

// ==========================================
// DATES AND TIME ZONES
// ==========================================

const formatters = new Map();
function fmt(options) {
  const key = locale() + JSON.stringify(options);
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat(locale(), options));
  return formatters.get(key);
}

const partsFormatters = new Map();
function zoneParts(ms, tz) {
  if (!partsFormatters.has(tz)) {
    partsFormatters.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }));
  }
  const p = {};
  partsFormatters.get(tz).formatToParts(ms).forEach((part) => { p[part.type] = Number(part.value); });
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}

function zoneOffset(ms, tz) {
  const p = zoneParts(ms, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

// Wall clock time in a time zone → UTC milliseconds
function wallToUtc(y, m, d, h, mi, s, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  const first = zoneOffset(guess, tz);
  const ms = guess - first;
  const second = zoneOffset(ms, tz);
  return second === first ? ms : guess - second;
}

// ical.js time → UTC milliseconds. ical.js drops the TZID of expanded occurrences (and only
// knows the zones registered with it), so the zone comes from the event's own TZID when needed.
function icalToMs(time, tzid) {
  const zone = time.zone && time.zone.tzid;
  if (zone === 'UTC' || zone === 'Z') {
    return Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second);
  }
  const tz = time.timezone || (zone && zone !== 'floating' ? zone : '') || tzid;
  if (tz) {
    try { return wallToUtc(time.year, time.month, time.day, time.hour, time.minute, time.second, tz); }
    catch (e) { /* unknown zone name: read it as the visitor's local time */ }
  }
  return new Date(time.year, time.month - 1, time.day, time.hour, time.minute, time.second).getTime();
}

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);

function dayKeyOf(ms, tz) {
  const p = zoneParts(ms, tz);
  return dayKey(p.y, p.m, p.d);
}

function parseDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

// Day key + n days (calendar arithmetic, no time zone involved)
function addDays(key, n) {
  const { y, m, d } = parseDayKey(key);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return dayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function daysBetween(fromKey, toKey) {
  const a = parseDayKey(fromKey);
  const b = parseDayKey(toKey);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);
}

// Noon UTC of a day key: a safe instant to format a calendar date with timeZone 'UTC'
const dayKeyToNoon = (key) => { const { y, m, d } = parseDayKey(key); return Date.UTC(y, m - 1, d, 12); };

// Start and end of an occurrence in the selected time zone (all-day events: midnight there)
function startMs(ev) {
  if (!ev.allDay) return ev.start;
  const { y, m, d } = parseDayKey(ev.startDay);
  return wallToUtc(y, m, d, 0, 0, 0, state.tz);
}
function endMs(ev) {
  if (!ev.allDay) return ev.end;
  const { y, m, d } = parseDayKey(ev.endDay);
  return wallToUtc(y, m, d, 0, 0, 0, state.tz);
}

// Day keys an occurrence is shown on (all-day events: every day; timed events: their start day)
function daysOf(ev) {
  if (!ev.allDay) return [dayKeyOf(ev.start, state.tz)];
  const days = [];
  for (let key = ev.startDay; key < ev.endDay && days.length < 366; key = addDays(key, 1)) days.push(key);
  return days;
}

function tzAbbreviation(ms) {
  const part = fmt({ timeZone: state.tz, timeZoneName: 'short', hour: 'numeric' })
    .formatToParts(ms).find((p) => p.type === 'timeZoneName');
  return part ? part.value : '';
}

function tzLongName() {
  for (const style of ['longGeneric', 'long']) {
    try {
      const part = fmt({ timeZone: state.tz, timeZoneName: style, hour: 'numeric' })
        .formatToParts(Date.now()).find((p) => p.type === 'timeZoneName');
      if (part) return part.value;
    } catch (e) { /* style not supported by this browser */ }
  }
  return '';
}

function formatDay(key, options) {
  return fmt(Object.assign({ timeZone: 'UTC' }, options)).format(dayKeyToNoon(key));
}

function formatTime(ms) {
  return fmt({ timeZone: state.tz, hour: 'numeric', minute: '2-digit' }).format(ms);
}

function formatTimeRange(ev) {
  const f = fmt({ timeZone: state.tz, hour: 'numeric', minute: '2-digit' });
  const range = typeof f.formatRange === 'function' ? f.formatRange(ev.start, ev.end) : f.format(ev.start) + ' - ' + f.format(ev.end);
  return range + ' ' + tzAbbreviation(ev.start);
}

// "Thursday 8 October" (+ year when not this year), and the time or "All day"
function describeWhen(ev, longDate) {
  const thisYear = zoneParts(Date.now(), state.tz).y;
  const dateOptions = longDate
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'short', day: 'numeric', month: 'short' };

  if (ev.allDay) {
    const lastDay = addDays(ev.endDay, -1);
    if (parseDayKey(lastDay).y !== thisYear) dateOptions.year = 'numeric';
    const date = lastDay === ev.startDay
      ? formatDay(ev.startDay, dateOptions)
      : formatDay(ev.startDay, dateOptions) + ' - ' + formatDay(lastDay, dateOptions);
    return { date, time: message('allDay') };
  }

  const startKey = dayKeyOf(ev.start, state.tz);
  const endKey = dayKeyOf(ev.end - 1, state.tz);
  if (parseDayKey(startKey).y !== thisYear) dateOptions.year = 'numeric';
  if (startKey === endKey) return { date: formatDay(startKey, dateOptions), time: formatTimeRange(ev) };

  // Over several days: dates and times together
  const options = Object.assign({ timeZone: state.tz, hour: 'numeric', minute: '2-digit' }, dateOptions);
  const f = fmt(options);
  const range = typeof f.formatRange === 'function' ? f.formatRange(ev.start, ev.end) : f.format(ev.start) + ' - ' + f.format(ev.end);
  return { date: range, time: tzAbbreviation(ev.start) };
}

// "in 2 days", "tomorrow", "in 3 hours"
function relative(ms) {
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  const diff = ms - Date.now();
  const days = daysBetween(dayKeyOf(Date.now(), state.tz), dayKeyOf(ms, state.tz));
  if (Math.abs(diff) < 3600000) return rtf.format(Math.round(diff / 60000), 'minute');
  if (days === 0) return rtf.format(Math.round(diff / 3600000), 'hour');
  if (Math.abs(days) < 14) return rtf.format(days, 'day');
  if (Math.abs(days) < 60) return rtf.format(Math.round(days / 7), 'week');
  return rtf.format(Math.round(days / 30), 'month');
}

function firstDayOfWeek() {
  try {
    const loc = new Intl.Locale(locale());
    const info = typeof loc.getWeekInfo === 'function' ? loc.getWeekInfo() : loc.weekInfo;
    if (info && info.firstDay) return info.firstDay % 7;
  } catch (e) { /* not supported by this browser */ }
  return /^(en-us|en-ca|ja|pt-br|es-mx|en-ph|he)/i.test(locale()) || locale() === 'en' ? 0 : 1;
}

// ==========================================
// CALENDAR PARSING
// ==========================================

function loadIcal() {
  return import(ICAL_URL).then((module) => module.default);
}

async function fetchCalendar() {
  const res = await fetch(PROXY_URL + '/?id=' + encodeURIComponent(state.link.id) + '&key=' + encodeURIComponent(state.link.key));
  if (res.status === 404) {
    const error = new Error('Calendar not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  if (!res.ok) throw new Error('Relay answered ' + res.status);
  return res.text();
}

function textProp(component, name) {
  const value = component.getFirstPropertyValue(name);
  return typeof value === 'string' ? value.trim() : '';
}

function tzidOf(component, name) {
  const prop = component.getFirstProperty(name);
  return (prop && prop.getParameter('tzid')) || '';
}

function findJoinLink(location, url, description) {
  const links = [location, url, description].join(' ').match(URL_PATTERN) || [];
  const cleaned = links.map((link) => link.replace(/[).,;:!?'\]]+$/, ''));
  return cleaned.find((link) => MEETING_PATTERN.test(link)) || (url && url.match(/^https?:\/\//) ? url : '') || '';
}

function toOccurrence(item, startTime, endTime, recurring) {
  const component = item.component;
  const title = item.summary ? item.summary.trim() : '';
  const location = textProp(component, 'location');
  const url = textProp(component, 'url');
  const description = textProp(component, 'description');
  const ev = {
    uid: item.uid || '',
    title,
    location,
    description,
    recurring,
    join: findJoinLink(location, url, description),
    allDay: startTime.isDate,
  };

  if (ev.allDay) {
    ev.startDay = dayKey(startTime.year, startTime.month, startTime.day);
    ev.endDay = endTime && endTime.isDate ? dayKey(endTime.year, endTime.month, endTime.day) : addDays(ev.startDay, 1);
    if (ev.endDay <= ev.startDay) ev.endDay = addDays(ev.startDay, 1);
  } else {
    const startTz = tzidOf(component, 'dtstart');
    ev.start = icalToMs(startTime, startTz);
    ev.end = endTime ? icalToMs(endTime, tzidOf(component, 'dtend') || startTz) : ev.start;
    if (ev.end < ev.start) ev.end = ev.start;
  }
  return ev;
}

function isCancelled(item) {
  return textProp(item.component, 'status').toUpperCase() === 'CANCELLED';
}

function parseCalendar(ICAL, text) {
  const calendar = new ICAL.Component(ICAL.parse(text));
  const windowStart = Date.now() - PAST_DAYS * DAY_MS;
  const windowEnd = Date.now() + FUTURE_DAYS * DAY_MS;

  // Moved or edited occurrences of recurring events are separate VEVENTs with a RECURRENCE-ID
  const masters = new Map();
  const exceptions = [];
  calendar.getAllSubcomponents('vevent').forEach((vevent) => {
    const event = new ICAL.Event(vevent);
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid || Math.random().toString(36), event);
  });
  exceptions.forEach((exception) => {
    const master = masters.get(exception.uid);
    if (master) master.relateException(exception);
    else masters.set(exception.uid + exception.recurrenceId, exception);
  });

  const events = [];
  masters.forEach((event) => {
    if (!event.startDate) return;
    if (!event.isRecurring()) {
      if (!isCancelled(event)) events.push(toOccurrence(event, event.startDate, event.endDate, false));
      return;
    }
    const masterTz = tzidOf(event.component, 'dtstart');
    const iterator = event.iterator();
    for (let i = 0, next; i < MAX_PER_EVENT && (next = iterator.next()); i++) {
      const details = event.getOccurrenceDetails(next);
      const approxStart = details.startDate.isDate
        ? Date.UTC(details.startDate.year, details.startDate.month - 1, details.startDate.day)
        : icalToMs(details.startDate, tzidOf(details.item.component, 'dtstart') || masterTz);
      if (approxStart > windowEnd) break;
      if (approxStart < windowStart - 2 * DAY_MS || isCancelled(details.item)) continue;
      events.push(toOccurrence(details.item, details.startDate, details.endDate, true));
    }
  });

  events.forEach((ev) => {
    // Sort key: all-day events at their UTC midnight, close enough for ordering
    ev.sortKey = ev.allDay ? dayKeyToNoon(ev.startDay) - 12 * 3600000 : ev.start;
  });
  events.sort((a, b) => a.sortKey - b.sortKey || a.title.localeCompare(b.title));

  return {
    name: textProp(calendar, 'x-wr-calname'),
    description: textProp(calendar, 'x-wr-caldesc'),
    events,
  };
}

// ==========================================
// HTML HELPERS
// ==========================================

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Plain text with clickable links (escaped piece by piece)
function linkify(text) {
  let html = '';
  let last = 0;
  text.replace(URL_PATTERN, (match, offset) => {
    const url = match.replace(/[).,;:!?'\]]+$/, '');
    html += escapeHtml(text.slice(last, offset));
    html += '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener nofollow">' + escapeHtml(url) + '</a>';
    last = offset + url.length;
    return match;
  });
  return html + escapeHtml(text.slice(last));
}

function track(name, props) {
  try { if (window.plausible) window.plausible(name, { props: props || {} }); } catch (e) { /* tracking must never break the page */ }
}

function isLive(ev) {
  const now = Date.now();
  return now >= startMs(ev) && now < endMs(ev);
}

function joinOpen(ev) {
  const now = Date.now();
  return !ev.allDay && now >= ev.start - JOIN_EARLY_MS && now < ev.end;
}

function joinButton(ev, small) {
  if (!ev.join) return '';
  const style = isLive(ev) ? 'btn--live' : 'btn--primary';
  return '<a class="btn ' + style + (small ? ' btn--small' : '') + '" href="' + escapeHtml(ev.join) + '" target="_blank" rel="noopener" data-join>'
    + escapeHtml(message('join')) + '</a>';
}

const eventTitle = (ev) => escapeHtml(ev.title || '(…)');

// ==========================================
// RENDERING
// ==========================================

function upcomingEvents() {
  const now = Date.now();
  return state.events.filter((ev) => endMs(ev) > now);
}

function renderNext() {
  const box = $('nextEvent');
  const ev = upcomingEvents()[0];
  if (!ev) { box.hidden = true; return; }

  const live = isLive(ev);
  const when = describeWhen(ev, false);
  box.classList.toggle('next--live', live);
  box.innerHTML =
    '<div class="next__info">'
    + '<p class="next__label">' + escapeHtml(message(live ? 'liveNow' : 'next')) + '</p>'
    + '<h2 class="next__title">' + eventTitle(ev) + '</h2>'
    + '<p class="next__when"><strong>' + escapeHtml(when.date) + ', ' + escapeHtml(when.time) + '</strong>'
    + (live ? '' : ' · ' + escapeHtml(relative(startMs(ev)))) + '</p>'
    + '</div>'
    + '<div class="next__actions">'
    + (joinOpen(ev) ? joinButton(ev, false) : '')
    + '<button type="button" class="btn btn--ghost" data-ev="' + state.events.indexOf(ev) + '">' + escapeHtml(message('details')) + '</button>'
    + '</div>';
  box.hidden = false;
}

function renderList() {
  const list = $('listView');
  const events = upcomingEvents().slice(0, MAX_LIST_ITEMS);
  if (!events.length) {
    list.innerHTML = '<p class="agenda__empty">' + escapeHtml(message('noUpcoming')) + '</p>';
    return;
  }

  let html = '';
  let currentMonth = '';
  events.forEach((ev) => {
    const key = ev.allDay ? ev.startDay : dayKeyOf(ev.start, state.tz);
    const monthKey = key.slice(0, 7);
    if (monthKey !== currentMonth) {
      currentMonth = monthKey;
      html += '<h3 class="agenda__month">' + escapeHtml(formatDay(monthKey + '-15', { month: 'long', year: 'numeric' })) + '</h3>';
    }
    const live = isLive(ev);
    html += '<article class="item">'
      + '<div class="item__date">'
      + '<span class="item__weekday">' + escapeHtml(formatDay(key, { weekday: 'short' })) + '</span>'
      + '<span class="item__day">' + parseDayKey(key).d + '</span>'
      + '</div>'
      + '<div class="item__main">'
      + (live ? '<span class="badge-live">' + escapeHtml(message('liveNow')) + '</span>' : '')
      + '<button type="button" class="item__title" data-ev="' + state.events.indexOf(ev) + '">' + eventTitle(ev) + '</button>'
      + '<span class="item__time">' + escapeHtml(ev.allDay ? describeWhen(ev, false).date + ', ' + message('allDay') : formatTimeRange(ev)) + '</span>'
      + (joinOpen(ev) ? '<div class="item__actions">' + joinButton(ev, true) + '</div>' : '')
      + '</div>'
      + '</article>';
  });
  list.innerHTML = html;
}

function eventsByDay() {
  const map = new Map();
  state.events.forEach((ev, index) => {
    daysOf(ev).forEach((key) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(index);
    });
  });
  // All-day events first, then by start time
  map.forEach((indexes) => indexes.sort((a, b) => {
    const ea = state.events[a];
    const eb = state.events[b];
    return (eb.allDay - ea.allDay) || (ea.sortKey - eb.sortKey);
  }));
  return map;
}

function renderMonth() {
  const { y, m } = state.month;
  const byDay = eventsByDay();
  const today = dayKeyOf(Date.now(), state.tz);
  const firstDay = firstDayOfWeek();

  $('monthLabel').textContent = formatDay(dayKey(y, m, 15), { month: 'long', year: 'numeric' });
  $('todayBtn').textContent = message('today');

  let html = '';
  for (let i = 0; i < 7; i++) {
    const weekday = (firstDay + i) % 7;
    // 2024-01-07 is a Sunday
    html += '<div class="month__weekday">' + escapeHtml(fmt({ timeZone: 'UTC', weekday: 'short' }).format(Date.UTC(2024, 0, 7 + weekday, 12))) + '</div>';
  }

  const first = dayKey(y, m, 1);
  const offset = (new Date(dayKeyToNoon(first)).getUTCDay() - firstDay + 7) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;

  for (let i = 0; i < cells; i++) {
    const key = addDays(first, i - offset);
    const { d, m: cellMonth } = parseDayKey(key);
    const indexes = byDay.get(key) || [];
    const classes = ['day'];
    if (cellMonth !== m) classes.push('day--outside');
    if (key < today) classes.push('day--past');
    if (key === today) classes.push('day--today');

    html += '<div class="' + classes.join(' ') + '">';
    html += '<span class="day__num">' + d + '</span>';
    indexes.slice(0, 3).forEach((index) => {
      const ev = state.events[index];
      html += '<button type="button" class="chip' + (ev.allDay ? ' chip--allday' : '') + '" data-ev="' + index + '" title="' + eventTitle(ev) + '">'
        + (ev.allDay ? '' : '<span class="chip__time">' + escapeHtml(formatTime(ev.start)) + '</span>')
        + eventTitle(ev) + '</button>';
    });
    if (indexes.length > 3) {
      html += '<button type="button" class="day__more" data-day="' + key + '">' + escapeHtml(message('more', { n: indexes.length - 3 })) + '</button>';
    }
    if (indexes.length) {
      html += '<span class="day__dots" aria-hidden="true">' + '<span class="day__dot"></span>'.repeat(Math.min(indexes.length, 3)) + '</span>';
      html += '<button type="button" class="day__open" data-day="' + key + '" aria-label="'
        + escapeHtml(message('eventsOn', { date: formatDay(key, { weekday: 'long', day: 'numeric', month: 'long' }) })) + '"></button>';
    }
    html += '</div>';
  }
  $('monthGrid').innerHTML = html;
}

function renderTzName() {
  $('tzName').textContent = tzLongName();
}

function renderAll() {
  if (!state.loaded) return;
  renderTzName();
  renderNext();
  renderList();
  renderMonth();
}

// ==========================================
// DIALOG
// ==========================================

function openDialog(html) {
  const dialog = $('eventDialog');
  $('dialogBody').innerHTML = html;
  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  $('dialogClose').focus();
}

function closeDialog() {
  const dialog = $('eventDialog');
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function openEvent(index) {
  const ev = state.events[index];
  if (!ev) return;
  const when = describeWhen(ev, true);
  const live = isLive(ev);
  const locationIsJoin = ev.location && ev.join && ev.location.indexOf(ev.join) !== -1 && ev.location.trim().length <= ev.join.length + 2;

  let html = '<div class="ev">';
  html += '<h2 class="ev__title" id="dialogTitle">' + eventTitle(ev) + '</h2>';
  if (live) html += '<span class="badge-live">' + escapeHtml(message('liveNow')) + '</span>';
  html += '<p class="ev__when"><strong>' + escapeHtml(when.date) + '</strong><br>' + escapeHtml(when.time) + '</p>';

  if (ev.join && endMs(ev) > Date.now()) {
    html += '<div class="ev__join">' + joinButton(ev, false) + '</div>';
    if (!joinOpen(ev) && !ev.allDay) html += '<p class="ev__hint">' + escapeHtml(message('joinEarly')) + '</p>';
  }
  if (ev.location && !locationIsJoin) {
    html += '<div><p class="ev__label">' + escapeHtml(message('location')) + '</p><p class="ev__text">' + linkify(ev.location) + '</p></div>';
  }
  if (ev.description) html += '<p class="ev__text">' + linkify(ev.description) + '</p>';
  if (ev.recurring) html += '<p class="ev__note">' + escapeHtml(message('recurring')) + '</p>';

  if (endMs(ev) > Date.now()) {
    html += '<div><p class="ev__label">' + escapeHtml(message('addThis')) + '</p><div class="ev__add">'
      + '<a class="btn btn--ghost btn--small" href="' + escapeHtml(googleEventUrl(ev)) + '" target="_blank" rel="noopener" data-add="google">' + escapeHtml(message('addGoogle')) + '</a>'
      + '<button type="button" class="btn btn--ghost btn--small" data-add="ics" data-ev="' + index + '">' + escapeHtml(message('addIcs')) + '</button>'
      + '</div></div>';
  }
  html += '</div>';
  openDialog(html);
}

function openDay(key) {
  const indexes = eventsByDay().get(key) || [];
  let html = '<h2 class="ev__title" id="dialogTitle">' + escapeHtml(formatDay(key, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h2>';
  html += '<div class="day-list">';
  indexes.forEach((index) => {
    const ev = state.events[index];
    html += '<button type="button" class="chip' + (ev.allDay ? ' chip--allday' : '') + '" data-ev="' + index + '">'
      + '<span class="chip__time">' + escapeHtml(ev.allDay ? message('allDay') : formatTime(ev.start)) + '</span>'
      + eventTitle(ev) + '</button>';
  });
  html += '</div>';
  openDialog(html);
}

// ==========================================
// ADD ONE EVENT
// ==========================================

const utcStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateStamp = (key) => key.replace(/-/g, '');

function eventDetails(ev) {
  return [ev.join && ev.description.indexOf(ev.join) === -1 ? ev.join : '', ev.description].filter(Boolean).join('\n\n');
}

function googleEventUrl(ev) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: ev.allDay ? dateStamp(ev.startDay) + '/' + dateStamp(ev.endDay) : utcStamp(ev.start) + '/' + utcStamp(ev.end),
    details: eventDetails(ev),
    location: ev.location || ev.join,
  });
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}

const icsText = (text) => text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');

// Lines longer than 75 octets are folded (RFC 5545)
function foldLine(line) {
  const encoder = new TextEncoder();
  const out = [];
  let current = '';
  for (const char of line) {
    if (encoder.encode(current + char).length > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
    }
    current += char;
  }
  out.push(current);
  return out.join('\r\n ');
}

function downloadIcs(ev) {
  const stamp = ev.allDay ? dateStamp(ev.startDay) : utcStamp(ev.start);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OneTake AI//Calendar page//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + (ev.uid || 'event') + '-' + stamp,
    'DTSTAMP:' + utcStamp(Date.now()),
    ev.allDay ? 'DTSTART;VALUE=DATE:' + dateStamp(ev.startDay) : 'DTSTART:' + utcStamp(ev.start),
    ev.allDay ? 'DTEND;VALUE=DATE:' + dateStamp(ev.endDay) : 'DTEND:' + utcStamp(ev.end),
    'SUMMARY:' + icsText(ev.title),
  ];
  const details = eventDetails(ev);
  if (details) lines.push('DESCRIPTION:' + icsText(details));
  if (ev.location || ev.join) lines.push('LOCATION:' + icsText(ev.location || ev.join));
  if (ev.join) lines.push('URL:' + ev.join);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  const blob = new Blob([lines.map(foldLine).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (ev.title || 'event').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) + '.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// ==========================================
// SUBSCRIBE
// ==========================================

function subscribeUrls() {
  const { feed, webcal } = state.link;
  const name = state.name || document.title;
  const outlook = (host) => 'https://' + host + '/calendar/0/addfromweb?url=' + encodeURIComponent(feed) + '&name=' + encodeURIComponent(name);
  return {
    google: 'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(webcal),
    apple: webcal,
    outlook: outlook('outlook.live.com'),
    office365: outlook('outlook.office.com'),
  };
}

function renderSubscribeLinks() {
  const urls = subscribeUrls();
  document.querySelectorAll('[data-sub]').forEach((a) => { a.href = urls[a.dataset.sub]; });
}

function detectApp() {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod|Macintosh/.test(ua) || iPadOS) return 'apple';
  if (/Android/.test(ua)) return 'google';
  if (/Windows/.test(ua)) return 'outlook';
  return '';
}

function setupApps() {
  const recommended = detectApp();
  const card = recommended && document.querySelector('.app[data-app="' + recommended + '"]');
  if (card) {
    card.classList.add('app--recommended');
    card.querySelector('.app__badge').hidden = false;
    card.parentNode.prepend(card);
  }

  const template = $('copyTemplate');
  document.querySelectorAll('.copy-slot').forEach((slot) => {
    const copy = template.content.cloneNode(true);
    copy.querySelector('.copy__input').value = state.link.feed;
    slot.appendChild(copy);
  });

  renderSubscribeLinks();
}

async function copyText(text, button, input) {
  const original = button.textContent;
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (e) {
    if (input) {
      input.select();
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    }
  }
  button.textContent = message(ok ? 'copied' : 'copyFailed');
  if (!ok && input) input.select();
  setTimeout(() => { button.textContent = original; }, 2500);
  return ok;
}

// ==========================================
// TIME ZONE PICKER
// ==========================================

function setupTimeZones() {
  const visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let saved = '';
  try { saved = localStorage.getItem(TZ_STORAGE_KEY) || ''; } catch (e) { /* storage blocked */ }

  let zones = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch (e) { /* older browser */ }
  if (!zones.length) zones = ['Europe/Paris', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore', 'UTC'];
  if (zones.indexOf(visitorTz) === -1) zones.unshift(visitorTz);
  if (zones.indexOf('UTC') === -1) zones.push('UTC');

  state.tz = saved && zones.indexOf(saved) !== -1 ? saved : visitorTz;

  const select = $('tzSelect');
  select.innerHTML = zones.map((tz) => '<option value="' + escapeHtml(tz) + '">' + escapeHtml(tz.replace(/_/g, ' ')) + '</option>').join('');
  select.value = state.tz;
  select.addEventListener('change', () => {
    state.tz = select.value;
    try { localStorage.setItem(TZ_STORAGE_KEY, state.tz); } catch (e) { /* storage blocked */ }
    const now = zoneParts(Date.now(), state.tz);
    state.month = { y: now.y, m: now.m };
    renderAll();
  });

  const now = zoneParts(Date.now(), state.tz);
  state.month = { y: now.y, m: now.m };
}

// ==========================================
// EVENTS
// ==========================================

function setupInteractions() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-ev], [data-day], [data-add], [data-join], [data-sub], [data-copy]');
    if (!target) return;

    if (target.matches('[data-sub]')) {
      track('CalendarSubscribe', { app: target.dataset.sub });
    } else if (target.matches('[data-join]')) {
      track('CalendarJoin');
    } else if (target.matches('[data-add]')) {
      track('CalendarAddEvent', { app: target.dataset.add });
      if (target.dataset.add === 'ics') downloadIcs(state.events[Number(target.dataset.ev)]);
    } else if (target.matches('[data-copy]')) {
      const input = target.parentNode.querySelector('.copy__input');
      copyText(state.link.feed, target, input).then((ok) => { if (ok) track('CalendarCopyLink', { link: 'calendar' }); });
    } else if (target.matches('[data-ev]')) {
      openEvent(Number(target.dataset.ev));
    } else if (target.matches('[data-day]')) {
      openDay(target.dataset.day);
    }
  });

  const dialog = $('eventDialog');
  $('dialogClose').addEventListener('click', closeDialog);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); });

  $('prevMonth').addEventListener('click', () => shiftMonth(-1));
  $('nextMonth').addEventListener('click', () => shiftMonth(1));
  $('todayBtn').addEventListener('click', () => {
    const now = zoneParts(Date.now(), state.tz);
    state.month = { y: now.y, m: now.m };
    renderMonth();
  });

  document.querySelectorAll('.views__btn').forEach((button) => {
    button.addEventListener('click', () => {
      $('scheduleBody').dataset.view = button.dataset.view;
      document.querySelectorAll('.views__btn').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    });
  });

  const pageButton = $('copyPageLink');
  pageButton.hidden = false;
  pageButton.addEventListener('click', () => {
    copyText(location.href, pageButton, null).then((ok) => { if (ok) track('CalendarCopyLink', { link: 'page' }); });
  });

  $('retry').addEventListener('click', load);
}

function shiftMonth(delta) {
  const date = new Date(Date.UTC(state.month.y, state.month.m - 1 + delta, 1));
  state.month = { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1 };
  renderMonth();
}

// Weglot loads asynchronously (tools.js): re-render once it is ready and on every language switch
function watchLanguage() {
  let tries = 0;
  (function hook() {
    if (window.Weglot && typeof Weglot.on === 'function') {
      Weglot.on('initialized', renderAll);
      Weglot.on('languageChanged', renderAll);
      renderAll();
      return;
    }
    if (++tries < 40) setTimeout(hook, 250);
  })();
}

// ==========================================
// INIT
// ==========================================

async function load() {
  $('loading').hidden = false;
  $('loadError').hidden = true;
  $('scheduleBody').hidden = true;

  try {
    const [ICAL, text] = await Promise.all([loadIcal(), fetchCalendar()]);
    const calendar = parseCalendar(ICAL, text);
    state.events = calendar.events;
    state.loaded = true;

    if (calendar.name) {
      state.name = calendar.name;
      $('calTitle').textContent = calendar.name;
      document.title = calendar.name;
      renderSubscribeLinks();
    }
    if (calendar.description) {
      $('calDescription').textContent = calendar.description;
      $('calDescription').hidden = false;
    }

    $('loading').hidden = true;
    $('scheduleBody').hidden = false;
    renderAll();
  } catch (e) {
    $('loading').hidden = true;
    if (e.code === 'NOT_FOUND') {
      $('content').hidden = true;
      $('notFoundError').hidden = false;
      return;
    }
    console.error('Calendar preview failed', e);
    $('loadError').hidden = false;
  }
}

function init() {
  state.link = readLink();
  if (!state.link) {
    $('linkError').hidden = false;
    return;
  }

  $('content').hidden = false;
  $('scheduleBody').dataset.view = 'list';
  setupTimeZones();
  setupApps();
  setupInteractions();
  watchLanguage();
  load();

  // Keep "Happening now", the Join buttons and the countdown up to date
  setInterval(() => {
    if (!state.loaded) return;
    renderNext();
    renderList();
  }, 30000);
}

init();
