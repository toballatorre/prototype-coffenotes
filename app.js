// ============================================
// STATE
// ============================================
let currentScreen = 'screen-home';
let selectedCafe = null;
let selectedMetodo = null;
let selectedMolienda = null;
let bloomingEnabled = true;

let timerInterval = null;
let elapsedSeconds = 0;
let timerRunning = false;
let timerStarted = false;
let events = []; // {name, seconds, done}

let currentRating = 0;
let currentReviewTitle = '';

const RECIPES = {
  'V60': { grams: 16, water: 230, temp: 90 },
  'Aeropress': { grams: 15, water: 200, temp: 85 },
  'Prensa Francesa': { grams: 20, water: 300, temp: 94 },
  'Chemex': { grams: 30, water: 480, temp: 96 }
};

// ============================================
// PERSISTENCE
// ============================================
function getStoredPreps() {
  try {
    const raw = localStorage.getItem('brew_preparations');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function savePrep(prep) {
  const all = getStoredPreps();
  all.unshift(prep);
  localStorage.setItem('brew_preparations', JSON.stringify(all));
}

function renderRecentChips() {
  const preps = getStoredPreps();
  const row = document.getElementById('recent-row');
  if (preps.length === 0) {
    row.innerHTML = '<span class="caption" style="color:var(--neutral-500)">Aún no tienes preparaciones guardadas</span>';
    return;
  }
  const recent = preps.slice(0, 3);
  row.innerHTML = recent.map((p, i) =>
    `<button class="chip" onclick="openDetailById('${p.id}')">${p.title || p.cafe + ' · ' + p.metodo}</button>`
  ).join('') + '<button class="chip chip-action">Ver historial...</button>';
}

function openDetailById(id) {
  const preps = getStoredPreps();
  const prep = preps.find(p => p.id === id);
  if (prep) renderDetailScreen(prep);
}

// ============================================
// NAVIGATION
// ============================================
function goTo(screenId) {
  document.getElementById(currentScreen).classList.remove('active');
  document.getElementById(screenId).classList.add('active');
  currentScreen = screenId;
  document.querySelector('.app-shell').scrollTop = 0;
  const content = document.querySelector(`#${screenId} .screen-content`);
  if (content) content.scrollTop = 0;
}

function startNewPrep() {
  // reset state for a clean form
  selectedCafe = null;
  selectedMetodo = null;
  selectedMolienda = null;
  document.getElementById('cafe-trigger-text').textContent = 'Selecciona un café';
  document.getElementById('cafe-trigger-text').classList.add('placeholder-text');
  document.getElementById('cafe-trigger').classList.remove('filled');
  document.getElementById('metodo-trigger-text').textContent = 'Selecciona un método';
  document.getElementById('metodo-trigger-text').classList.add('placeholder-text');
  document.getElementById('metodo-trigger').classList.remove('filled');
  document.getElementById('molienda-trigger-text').textContent = 'Selecciona molienda';
  document.getElementById('molienda-trigger-text').classList.add('placeholder-text');
  document.getElementById('molienda-trigger').classList.remove('filled');
  document.getElementById('suggested-recipe').style.display = 'none';
  document.getElementById('param-cafe').value = 15;
  document.getElementById('param-agua').value = 225;
  document.getElementById('param-ratio').value = '1:15';
  document.getElementById('param-temp').value = 91;
  document.getElementById('comenzar-btn').disabled = true;
  goTo('screen-new-prep');
}

// ============================================
// DROPDOWNS
// ============================================
function toggleDropdown(name) {
  const menu = document.getElementById(name + '-menu');
  const trigger = document.getElementById(name + '-trigger');
  const isOpen = menu.classList.contains('open');
  // close all dropdowns first
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.dropdown-trigger').forEach(t => t.classList.remove('open'));
  if (!isOpen) {
    menu.classList.add('open');
    trigger.classList.add('open');
  }
}

document.addEventListener('click', function (e) {
  if (!e.target.closest('.field-group')) {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.dropdown-trigger').forEach(t => t.classList.remove('open'));
  }
});

function selectOption(name, value) {
  const trigger = document.getElementById(name + '-trigger');
  const text = document.getElementById(name + '-trigger-text');
  text.textContent = value;
  text.classList.remove('placeholder-text');
  trigger.classList.add('filled');
  trigger.classList.remove('open');
  document.getElementById(name + '-menu').classList.remove('open');

  if (name === 'cafe') selectedCafe = value;
  if (name === 'metodo') {
    selectedMetodo = value;
    maybeShowSuggestedRecipe();
  }
  if (name === 'molienda') selectedMolienda = value;

  checkComenzarEnabled();
}

function filterOptions(input, menuId) {
  const query = input.value.toLowerCase();
  const menu = document.getElementById(menuId);
  menu.querySelectorAll('.dropdown-option').forEach(opt => {
    const match = opt.textContent.toLowerCase().includes(query);
    opt.style.display = match ? 'block' : 'none';
  });
}

function maybeShowSuggestedRecipe() {
  const card = document.getElementById('suggested-recipe');
  const recipe = RECIPES[selectedMetodo];
  if (recipe && selectedCafe) {
    document.getElementById('suggested-method-name').textContent = selectedMetodo;
    card.querySelector('.recipe-specs').textContent = `${recipe.grams}gr / ${recipe.water}gr / ${recipe.temp}°C`;
    card.style.display = 'flex';
  } else {
    card.style.display = 'none';
  }
}

function dismissRecipe() {
  document.getElementById('suggested-recipe').style.display = 'none';
}

function useRecipe() {
  const recipe = RECIPES[selectedMetodo];
  if (!recipe) return;
  document.getElementById('param-cafe').value = recipe.grams;
  document.getElementById('param-agua').value = recipe.water;
  document.getElementById('param-ratio').value = '1:' + Math.round(recipe.water / recipe.grams);
  document.getElementById('param-temp').value = recipe.temp;
  document.getElementById('suggested-recipe').style.display = 'none';
  showToast('Receta aplicada');
}

function checkComenzarEnabled() {
  const btn = document.getElementById('comenzar-btn');
  btn.disabled = !(selectedCafe && selectedMetodo);
}

// ============================================
// TIMER SCREEN SETUP
// ============================================
function comenzarPreparacion() {
  // reset timer state
  elapsedSeconds = 0;
  timerRunning = false;
  timerStarted = false;
  events = [];
  bloomingEnabled = true;

  document.getElementById('timer-subtitle').textContent = `${selectedCafe} · ${selectedMetodo}`;
  document.getElementById('timer-display').textContent = '00:00';
  document.getElementById('timer-display').classList.remove('running');

  // reset segmented control
  const seg = document.getElementById('blooming-segmented');
  seg.classList.remove('locked');
  seg.querySelectorAll('.segmented-option').forEach((opt, i) => {
    opt.classList.toggle('selected', i === 0);
  });

  // reset main button
  const mainBtn = document.getElementById('timer-main-btn');
  mainBtn.classList.remove('is-disabled');
  mainBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 18 21" fill="currentColor"><path d="M6 2V0H12V2H6ZM5.512 20.288C4.42067 19.8127 3.46667 19.1667 2.65 18.35C1.83333 17.5333 1.18767 16.579 0.713001 15.487C0.238335 14.395 0.000668065 13.2327 1.3986e-06 12C-0.000665268 10.7673 0.237001 9.60467 0.713001 8.512C1.189 7.41933 1.83467 6.46533 2.65 5.65C3.46533 4.83467 4.41967 4.189 5.513 3.713C6.60633 3.237 7.76867 2.99933 9 3C10.0333 3 11.025 3.16667 11.975 3.5C12.925 3.83333 13.8167 4.31667 14.65 4.95L16.05 3.55L17.45 4.95L16.05 6.35C16.6833 7.18333 17.1667 8.075 17.5 9.025C17.8333 9.975 18 10.9667 18 12C18 13.2333 17.7623 14.396 17.287 15.488C16.8117 16.58 16.166 17.534 15.35 18.35C14.534 19.166 13.5797 19.812 12.487 20.288C11.3943 20.764 10.232 21.0013 9 21C7.768 20.9987 6.60533 20.7613 5.512 20.288ZM13.95 16.95C15.3167 15.5833 16 13.9333 16 12C16 10.0667 15.3167 8.41667 13.95 7.05C12.5833 5.68333 10.9333 5 9 5C7.06667 5 5.41667 5.68333 4.05 7.05C2.68333 8.41667 2 10.0667 2 12C2 13.9333 2.68333 15.5833 4.05 16.95C5.41667 18.3167 7.06667 19 9 19C10.9333 19 12.5833 18.3167 13.95 16.95ZM7 16L13 12L7 8V16Z"/></svg> Iniciar Cronómetro`;

  const finishBtn = document.getElementById('timer-finish-btn');
  finishBtn.classList.remove('btn-primary', 'is-loading');
  finishBtn.classList.add('btn-ghost');

  renderEventList();
  goTo('screen-timer');
}

function setBlooming(value) {
  if (timerStarted) return; // locked once running
  bloomingEnabled = value;
  const seg = document.getElementById('blooming-segmented');
  seg.querySelectorAll('.segmented-option').forEach((opt, i) => {
    opt.classList.toggle('selected', value ? i === 0 : i === 1);
  });
  renderEventList();
}

function nextEventName() {
  if (events.length === 0) {
    return bloomingEnabled ? 'Blooming' : 'Vertido 1';
  }
  const doneCount = events.length;
  const offset = bloomingEnabled ? 1 : 0;
  const pourNumber = doneCount - offset + 1;
  return `Vertido ${pourNumber}`;
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderEventList() {
  const list = document.getElementById('event-list');
  let html = '';

  events.forEach((ev) => {
    html += eventRowHTML(ev.name, formatTime(ev.seconds), 'done', null);
  });

  if (timerStarted && timerRunning) {
    html += eventRowHTML(nextEventName(), formatTime(elapsedSeconds), 'active', null);
  } else if (!timerStarted) {
    html += eventRowHTML(nextEventName(), '00:00', 'preview', null);
  }

  list.innerHTML = html;
}

function eventRowHTML(name, time, state, editIndex) {
  let icon = '';
  if (state === 'done') {
    icon = `<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M14.59 5.58L8 12.17L4.41 8.59L3 10L8 15L16 7L14.59 5.58ZM10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM10 18C5.58 18 2 14.42 2 10C2 5.58 5.58 2 10 2C14.42 2 18 5.58 18 10C18 14.42 14.42 18 10 18Z"/></svg>`;
  } else if (state === 'active') {
    icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 8.64L15.27 12L10 15.36V8.64ZM8 5V19L19 12L8 5Z"/></svg>`;
  } else {
    icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/></svg>`;
  }

  const editBtn = (state === 'done' && editIndex !== null)
    ? `<button class="event-row-edit-btn" onclick="startEditEvent(${editIndex})" aria-label="Editar evento">
         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
       </button>`
    : '';

  return `<div class="event-row ${state}">
    <div class="event-row-left">
      <span class="event-row-icon">${icon}</span>
      <span class="event-row-name">${name}</span>
    </div>
    <span class="event-row-time">${time}</span>
    ${editBtn}
  </div>`;
}


// ============================================
// TIMER LOGIC
// ============================================
function timerMainAction() {
  if (!timerStarted) {
    const seg = document.getElementById('blooming-segmented');
    seg.classList.add('locked');

    const mainBtn = document.getElementById('timer-main-btn');
    mainBtn.classList.add('is-disabled');

    const overlay = document.getElementById('countdown-overlay');
    const countEl = document.getElementById('countdown-number');
    let count = 3;
    countEl.textContent = count;
    overlay.style.display = 'flex';

    const countdownId = setInterval(() => {
      count--;
      if (count > 0) {
        countEl.textContent = count;
      } else {
        clearInterval(countdownId);
        overlay.style.display = 'none';

        timerStarted = true;
        timerRunning = true;
        elapsedSeconds = 0;

        mainBtn.classList.remove('is-disabled');
        mainBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 22 18" fill="currentColor"><path d="M2.188 15.813C0.729333 14.3543 0 12.5833 0 10.5C0 8.41667 0.729333 6.646 2.188 5.188C3.64667 3.73 5.41733 3.00067 7.5 3C8.36667 3 9.18333 3.13767 9.95 3.413C10.7167 3.68833 11.4167 4.06733 12.05 4.55L13.1 3.5L14.5 4.9L13.45 5.95C13.9333 6.58333 14.3127 7.28767 14.588 8.063C14.8633 8.83833 15.0007 9.65067 15 10.5C15 12.5833 14.271 14.3543 12.813 15.813C11.355 17.2717 9.584 18.0007 7.5 18C5.416 17.9993 3.64533 17.2703 2.188 15.813ZM18.5 18L15 14.5L16.4 13.1L17.5 14.2V2H19.5V14.175L20.575 13.1L22 14.5L18.5 18ZM5 2V0H10V2H5ZM11.4 14.4C12.4667 13.3333 13 12.0333 13 10.5C13 8.96667 12.4667 7.66667 11.4 6.6C10.3333 5.53333 9.03333 5 7.5 5C5.96667 5 4.66667 5.53333 3.6 6.6C2.53333 7.66667 2 8.96667 2 10.5C2 12.0333 2.53333 13.3333 3.6 14.4C4.66667 15.4667 5.96667 16 7.5 16C9.03333 16 10.3333 15.4667 11.4 14.4ZM6.5 11.5H8.5V6.5H6.5V11.5Z"/></svg> Registrar evento`;

        startInterval();
        renderEventList();
      }
    }, 1000);
  } else {
    registrarEvento();
  }
}

function startInterval() {
  clearInterval(timerInterval);
  const display = document.getElementById('timer-display');
  display.classList.add('running');
  timerInterval = setInterval(() => {
    if (!timerRunning) return;
    elapsedSeconds++;
    display.textContent = formatTime(elapsedSeconds);
    renderEventList();
  }, 1000);
}

function registrarEvento() {
  if (bloomingEnabled && events.length === 0) {
    events.push({ name: 'Blooming', seconds: elapsedSeconds, done: true });
    events.push({ name: 'Vertido 1', seconds: elapsedSeconds, done: true });
    showToast('Blooming y Vertido 1 registrados');
  } else {
    events.push({ name: nextEventName(), seconds: elapsedSeconds, done: true });
    showToast(`${events[events.length - 1].name} registrado`);
  }
  renderEventList();
}

function finalizarPreparacion() {
  if (!timerStarted) {
    showToast('Inicia el cronómetro primero');
    return;
  }
  // register final event as "Término"
  events.push({ name: 'Término', seconds: elapsedSeconds, done: true });
  timerRunning = false;
  clearInterval(timerInterval);

  // disable register button
  const mainBtn = document.getElementById('timer-main-btn');
  mainBtn.classList.add('is-disabled');

  // finish button -> loading state, primary
  const finishBtn = document.getElementById('timer-finish-btn');
  finishBtn.classList.remove('btn-ghost');
  finishBtn.classList.add('btn-primary', 'is-loading');

  renderEventList();

  setTimeout(() => {
    finishBtn.classList.remove('is-loading');
    openReview();
  }, 900);
}

function confirmLeaveTimer() {
  if (timerStarted && timerRunning) {
    if (!confirm('¿Salir cancelará la preparación en curso. ¿Continuar?')) return;
    clearInterval(timerInterval);
  }
  goTo('screen-home');
}

// ============================================
// REVIEW SCREEN
// ============================================
function renderReviewTitleDisplay() {
  const area = document.getElementById('review-title-area');
  area.innerHTML = `
    <span id="review-title" style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${currentReviewTitle}</span>
    <button class="event-row-edit-btn" onclick="startEditReviewTitle()" aria-label="Editar título">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
  `;
}

function startEditReviewTitle() {
  const area = document.getElementById('review-title-area');
  area.innerHTML = `
    <input type="text" class="event-row-input review-title-input" id="rev-title-input" value="${currentReviewTitle.replace(/"/g, '&quot;')}" onkeydown="if(event.key==='Enter')confirmEditReviewTitle()">
    <div class="event-row-edit-actions">
      <button class="event-row-confirm" onclick="confirmEditReviewTitle()" aria-label="Confirmar">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <button class="event-row-cancel" onclick="cancelEditReviewTitle()" aria-label="Cancelar">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
  const input = document.getElementById('rev-title-input');
  input.focus();
  input.select();
}

function confirmEditReviewTitle() {
  const newTitle = document.getElementById('rev-title-input').value.trim();
  if (newTitle) currentReviewTitle = newTitle;
  renderReviewTitleDisplay();
}

function cancelEditReviewTitle() {
  renderReviewTitleDisplay();
}

function openReview() {
  currentReviewTitle = `${selectedCafe} · ${selectedMetodo}`;
  renderReviewTitleDisplay();
  document.getElementById('review-total-time').textContent = `Tiempo total: ${formatTime(elapsedSeconds)}`;
  document.getElementById('review-event-count').textContent = `Eventos: ${events.length}`;

  const cafeG = document.getElementById('param-cafe').value;
  const aguaG = document.getElementById('param-agua').value;
  const temp = document.getElementById('param-temp').value;
  document.getElementById('review-params').textContent = `${cafeG}gr / ${aguaG}gr / ${temp}°C`;

  const list = document.getElementById('review-event-list');
  list.innerHTML = events.map((ev, i) => `
    <div class="event-row plain">
      <div class="event-row-left">
        <span class="event-row-icon"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M14.59 5.58L8 12.17L4.41 8.59L3 10L8 15L16 7L14.59 5.58ZM10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM10 18C5.58 18 2 14.42 2 10C2 5.58 5.58 2 10 2C14.42 2 18 5.58 18 10C18 14.42 14.42 18 10 18Z"/></svg></span>
        <span class="event-row-name">${ev.name}</span>
      </div>
      <span class="event-row-time">${formatTime(ev.seconds)}</span>
      <button class="event-row-edit-btn" onclick="startEditReviewEvent(${i})" aria-label="Editar evento">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  `).join('');

  currentRating = 0;
  renderRating('review-rating', 0, false);
  document.getElementById('review-notes').value = '';

  goTo('screen-review');
}

function startEditReviewEvent(index) {
  const list = document.getElementById('review-event-list');
  const rows = list.querySelectorAll('.event-row');
  const row = rows[index];
  const ev = events[index];

  row.innerHTML = `
    <div class="event-row-left">
      <span class="event-row-icon"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M14.59 5.58L8 12.17L4.41 8.59L3 10L8 15L16 7L14.59 5.58ZM10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM10 18C5.58 18 2 14.42 2 10C2 5.58 5.58 2 10 2C14.42 2 18 5.58 18 10C18 14.42 14.42 18 10 18Z"/></svg></span>
      <input type="text" class="event-row-input" id="rev-edit-name">${''}</input>
    </div>
    <input type="text" class="event-row-input event-row-time-input" id="rev-edit-time" value="${formatTime(ev.seconds)}">
    <div class="event-row-edit-actions">
      <button class="event-row-confirm" onclick="confirmEditReviewEvent(${index})" aria-label="Confirmar">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <button class="event-row-cancel" onclick="openReview()" aria-label="Cancelar">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
  document.getElementById('rev-edit-name').value = ev.name;
}

function confirmEditReviewEvent(index) {
  const newName = document.getElementById('rev-edit-name').value.trim() || events[index].name;
  const timeVal = document.getElementById('rev-edit-time').value.trim();
  let newSeconds = events[index].seconds;
  const match = timeVal.match(/^(\d{1,2}):(\d{2})$/);
  if (match) newSeconds = parseInt(match[1]) * 60 + parseInt(match[2]);

  events[index].name = newName;
  events[index].seconds = newSeconds;
  openReview();
}

// ============================================
// RATING COMPONENT
// ============================================
function renderRating(containerId, value, readonly) {
  const container = document.getElementById(containerId);
  container.className = 'rating' + (readonly ? ' readonly' : '');
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= value;
    html += `<button class="star-btn ${filled ? 'filled' : ''} ${readonly ? 'readonly' : ''}"
      ${readonly ? '' : `onclick="setRating(${i})"`} aria-label="${i} estrellas">
      <svg viewBox="0 0 20 19" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="0.8">
        <path d="M3.825 19L5.45 11.975L0 7.25L7.2 6.625L10 0L12.8 6.625L20 7.25L14.55 11.975L16.175 19L10 15.275L3.825 19Z"/>
      </svg>
    </button>`;
  }
  container.innerHTML = html;
}

function setRating(value) {
  currentRating = value;
  renderRating('review-rating', value, false);
}

// ============================================
// SAVE PREPARATION
// ============================================
function guardarPreparacion(addFavorite) {
  const id = 'prep_' + Date.now();
  const openTitleInput = document.getElementById('rev-title-input');
  if (openTitleInput) {
    const val = openTitleInput.value.trim();
    if (val) currentReviewTitle = val;
  }
  const prepTitle = currentReviewTitle || `${selectedCafe} · ${selectedMetodo}`;
  const prep = {
    id,
    title: prepTitle,
    cafe: selectedCafe,
    metodo: selectedMetodo,
    tostador: 'Café XYZ',
    origen: selectedCafe,
    cafeGr: document.getElementById('param-cafe').value,
    aguaGr: document.getElementById('param-agua').value,
    ratio: document.getElementById('param-ratio').value,
    temp: document.getElementById('param-temp').value,
    molienda: selectedMolienda || 'Media',
    totalTime: elapsedSeconds,
    events: events,
    rating: currentRating,
    notes: document.getElementById('review-notes').value.trim(),
    favorite: addFavorite,
    createdAt: Date.now()
  };

  savePrep(prep);
  renderRecentChips();
  showToast(addFavorite ? 'Guardado en favoritos' : 'Preparación guardada');

  setTimeout(() => {
    renderDetailScreen(prep);
  }, 350);
}

// ============================================
// DETAIL SCREEN
// ============================================
function renderDetailScreen(prep) {
  document.getElementById('detail-title').textContent = prep.title || `${prep.cafe} · ${prep.metodo}`;
renderRating('detail-rating-stars', prep.rating, true);

  document.getElementById('detail-cafe-info').innerHTML =
    `Nombre: ${prep.cafe}<br>Tostador (Marca): ${prep.tostador}<br>Origen: ${prep.origen}`;
  document.getElementById('detail-metodo-info').textContent = prep.metodo;

  document.getElementById('detail-params-list').innerHTML = `
    <div class="params-row"><span class="label">Café</span><span class="value">${prep.cafeGr}gr</span></div>
    <div class="params-row"><span class="label">Agua</span><span class="value">${prep.aguaGr}gr</span></div>
    <div class="params-row"><span class="label">Ratio</span><span class="value">${prep.ratio}</span></div>
    <div class="params-row"><span class="label">Temperatura</span><span class="value">${prep.temp}°C</span></div>
    <div class="params-row"><span class="label">Molienda</span><span class="value">${prep.molienda}</span></div>
  `;

  document.getElementById('detail-event-list').innerHTML = prep.events.map(ev => `
    <div class="event-row plain">
      <div class="event-row-left"><span class="event-row-name">${ev.name}</span></div>
      <span class="event-row-time">${formatTime(ev.seconds)}</span>
    </div>
  `).join('');

  document.getElementById('detail-notes').textContent = prep.notes || 'Sin notas para esta preparación.';

  window._currentDetailPrep = prep;
  goTo('screen-detail');
}

function editFromDetail() {
  showToast('La edición de eventos se hace en la pantalla Review');
}

function shareDetail() {
  const prep = window._currentDetailPrep;
  if (!prep) return;
  showToast('Compartiendo preparación...');
}

// ============================================
// TOAST
// ============================================
let toastTimeout;
function showToast(text) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-text').textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  renderRecentChips();
});
