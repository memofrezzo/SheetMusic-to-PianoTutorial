(() => {
  const MIN_MIDI = 21;
  const MAX_MIDI = 108;
  const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);
  const STEP_TO_SEMITONE = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  };
  const ROLE_COLORS = {
    voice: "#b875ff",
    pianoTreble: "#8ce063",
    pianoBass: "#7ab7ff"
  };
  const GENERIC_PART_COLORS = [
    "#ffd166",
    "#ff8fab",
    "#66d9e8",
    "#f7b267",
    "#95d5b2",
    "#e9c46a"
  ];
  const MIDI_CHANNEL_COLORS = [
    "#8ce063",
    "#7ab7ff",
    "#b875ff",
    "#ffd166",
    "#ff8fab",
    "#66d9e8",
    "#f7b267",
    "#95d5b2"
  ];
  const ALLOWED_SPEEDS = [0.25, 0.5, 0.75, 1, 2];
  const SEEK_STEP_SECONDS = 5;
  const BLACK_KEY_DARKEN_FACTOR = 0.66;
  const FS_PANEL_MIN_SCALE = 0.8;
  const FS_PANEL_MAX_SCALE = 1.8;
  const FS_PANEL_SCALE_STEP = 0.1;
  const PRELOADED_SCORE_DIR = "Partituras";
  const PRELOADED_AUDIO_DIR = "Musicas";
  // Para agregar nuevas melodias por defecto, suma una entrada aca
  // y coloca ambos archivos en Partituras/ y Musicas/ con el mismo nombre base.
  const DEFAULT_MELODIES = [
    {
      id: "legends-never-die-no-voice",
      label: "Legends Never Die no Voice",
      scoreBaseNames: ["Legends Never Die no Voice", "Legends Never Die No Voice"],
      audioBaseNames: ["Legends Never Die no Voice", "Legends Never Die No Voice"]
    },
    {
      id: "legends-never-die-voice",
      label: "Legends Never Die Voice",
      scoreBaseNames: ["Legends Never Die Voice", "Legends Never Die"],
      audioBaseNames: ["Legends Never Die Voice", "Legends Never Die"]
    },
    {
      id: "fotografia-la-plata",
      label: "Fotografia La Plata",
      scoreBaseNames: ["Fotografia La Plata", "Fotografia la plata"],
      audioBaseNames: ["Fotografia La Plata", "Fotografia la plata"]
    },
    {
      id: "epic-piano-music",
      label: "Epic Piano Music",
      scoreBaseNames: ["Epic Piano Music"],
      audioBaseNames: ["Epic Piano Music"]
    }
  ];
  const blackKeyColorCache = new Map();

  const state = {
    notes: [],
    totalDuration: 0,
    playhead: 0,
    isPlaying: false,
    sourceName: "",
    sourceFormat: "",
    visualOffset: 0,
    playbackRate: 1,
    lookAheadSeconds: 4.8,
    pixelsPerSecond: 130,
    nowMs: performance.now(),
    playStartedAtMs: 0,
    playheadAtStart: 0,
    audioVisualPlayhead: 0,
    audioVisualMs: 0,
    audioLastSampleMs: 0,
    audioObjectUrl: null,
    audioReady: false,
    isFullscreenMode: false,
    fsPanelHidden: false,
    fsPanelScale: 1,
    selectedDefaultMelodyId: "",
    defaultMelodyLoadSeq: 0,
    isUserSeeking: false,
    lastUiRefreshMs: 0,
    uiRefreshIntervalMs: 85,
    renderWidth: 0,
    renderHeight: 0,
    metadata: {
      tempoEvents: 0,
      noteCount: 0
    },
    piano: {
      keys: new Map(),
      whiteKeys: [],
      blackKeys: []
    }
  };

  const ui = {
    scoreFile: document.getElementById("scoreFile"),
    audioFile: document.getElementById("audioFile"),
    playBtn: document.getElementById("playBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    resetBtn: document.getElementById("resetBtn"),
    fullscreenBtn: document.getElementById("fullscreenBtn"),
    speedSelect: document.getElementById("speedSelect"),
    seekInput: document.getElementById("seekInput"),
    seekBtn: document.getElementById("seekBtn"),
    seekBar: document.getElementById("seekBar"),
    offsetInput: document.getElementById("offsetInput"),
    statusText: document.getElementById("statusText"),
    metaText: document.getElementById("metaText"),
    timeText: document.getElementById("timeText"),
    defaultMelodyList: document.getElementById("defaultMelodyList"),
    canvas: document.getElementById("rollCanvas"),
    stageWrap: document.querySelector(".stage-wrap"),
    fsPanel: document.getElementById("fsPanel"),
    fsPlayPauseBtn: document.getElementById("fsPlayPauseBtn"),
    fsResetBtn: document.getElementById("fsResetBtn"),
    fsSpeedSelect: document.getElementById("fsSpeedSelect"),
    fsSeekBar: document.getElementById("fsSeekBar"),
    fsTimeText: document.getElementById("fsTimeText"),
    fsExitBtn: document.getElementById("fsExitBtn"),
    fsSizeDownBtn: document.getElementById("fsSizeDownBtn"),
    fsSizeUpBtn: document.getElementById("fsSizeUpBtn"),
    fsPanelHideBtn: document.getElementById("fsPanelHideBtn"),
    fsPanelShowBtn: document.getElementById("fsPanelShowBtn")
  };

  const audio = new Audio();
  audio.preload = "auto";

  const ctx = ui.canvas.getContext("2d", { alpha: false });

  function setStatus(message, type = "") {
    ui.statusText.textContent = message;
    ui.statusText.classList.remove("ok", "error");
    if (type) {
      ui.statusText.classList.add(type);
    }
  }

  function setMeta(text) {
    ui.metaText.textContent = text;
  }

  function formatTime(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const hours = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = Math.floor(safe % 60);
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function updateTimeLabel() {
    ui.timeText.textContent = `Tiempo: ${formatTime(state.playhead)} / ${formatTime(state.totalDuration)} | Velocidad: ${state.playbackRate.toFixed(2)}x`;
    ui.fsTimeText.textContent = `${formatTime(state.playhead)} / ${formatTime(state.totalDuration)}`;
  }

  function setControlsEnabled(enabled) {
    ui.playBtn.disabled = !enabled;
    ui.pauseBtn.disabled = !enabled;
    ui.resetBtn.disabled = !enabled;
    ui.seekBtn.disabled = !enabled;
    ui.seekBar.disabled = !enabled;
    ui.seekInput.disabled = !enabled;
    ui.fsPlayPauseBtn.disabled = !enabled;
    ui.fsResetBtn.disabled = !enabled;
    ui.fsSpeedSelect.disabled = !enabled;
    ui.fsSeekBar.disabled = !enabled;
  }

  function updateFsPlayPauseLabel() {
    ui.fsPlayPauseBtn.textContent = state.isPlaying ? "Pausar" : "Reproducir";
  }

  function syncSpeedSelectors() {
    const value = String(state.playbackRate);
    ui.speedSelect.value = value;
    ui.fsSpeedSelect.value = value;
  }

  function setFsPanelScale(value) {
    const clamped = Math.max(FS_PANEL_MIN_SCALE, Math.min(FS_PANEL_MAX_SCALE, value));
    state.fsPanelScale = clamped;
    ui.fsPanel.style.setProperty("--fs-panel-scale", clamped.toFixed(2));
  }

  function refreshFsOverlayVisibility() {
    const panelVisible = state.isFullscreenMode && !state.fsPanelHidden;
    ui.fsPanel.style.display = panelVisible ? "block" : "none";

    const canShowHandle = state.isFullscreenMode && state.fsPanelHidden;
    ui.fsPanelShowBtn.hidden = !canShowHandle;
    ui.fsPanelShowBtn.classList.toggle("is-visible", canShowHandle);
  }

  function setFsPanelHidden(hidden) {
    state.fsPanelHidden = hidden;
    refreshFsOverlayVisibility();
  }

  function setDefaultMelodySelection(melodyId) {
    state.selectedDefaultMelodyId = melodyId || "";
    if (!ui.defaultMelodyList) {
      return;
    }
    const buttons = ui.defaultMelodyList.querySelectorAll(".default-melody-btn");
    for (const button of buttons) {
      const active = button.dataset.melodyId === state.selectedDefaultMelodyId;
      button.classList.toggle("is-active", active);
      if (active) {
        button.setAttribute("aria-current", "true");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  }

  function setDefaultMelodyLoading(loading) {
    if (!ui.defaultMelodyList) {
      return;
    }
    ui.defaultMelodyList.classList.toggle("is-loading", Boolean(loading));
  }

  function cancelDefaultMelodyLoad() {
    state.defaultMelodyLoadSeq += 1;
    setDefaultMelodyLoading(false);
  }

  function buildPreloadedFileCandidates(directory, baseNames, extensions) {
    const candidates = [];
    const seen = new Set();
    for (const baseName of baseNames) {
      if (typeof baseName !== "string" || !baseName.trim()) {
        continue;
      }
      for (const extension of extensions) {
        const safeExt = extension.startsWith(".") ? extension : `.${extension}`;
        const fileName = `${baseName}${safeExt}`;
        const dedupeKey = `${directory}/${fileName}`.toLowerCase();
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);
        candidates.push({
          url: `${directory}/${encodeURIComponent(baseName)}${safeExt}`,
          fileName
        });
      }
    }
    return candidates;
  }

  function createFileLikeFromBlob(blob, fileName) {
    try {
      return new File([blob], fileName, {
        type: blob.type || "application/octet-stream"
      });
    } catch (_error) {
      const fallbackBlob = blob;
      try {
        fallbackBlob.name = fileName;
      } catch (_assignError) {
        try {
          Object.defineProperty(fallbackBlob, "name", { value: fileName });
        } catch (_defineError) {
          // Si no se puede definir, seguimos igual y fallara con mensaje claro.
        }
      }
      return fallbackBlob;
    }
  }

  async function fetchFirstAvailableFile(candidates) {
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate.url, { cache: "no-store" });
        if (!response.ok) {
          continue;
        }
        const blob = await response.blob();
        return createFileLikeFromBlob(blob, candidate.fileName);
      } catch (_error) {
        // Probamos el siguiente candidato.
      }
    }
    return null;
  }

  async function loadDefaultMelody(melody) {
    if (!melody) {
      return;
    }
    if (window.location.protocol === "file:") {
      throw new Error("Para usar melodias por defecto abre la app con servidor local (run_local_server.bat o http://localhost:8080).");
    }

    const requestId = state.defaultMelodyLoadSeq + 1;
    state.defaultMelodyLoadSeq = requestId;
    setDefaultMelodyLoading(true);
    setDefaultMelodySelection(melody.id);

    pausePlayback();
    setStatus(`Cargando melodia por defecto: ${melody.label} ...`);

    try {
      const scoreCandidates = buildPreloadedFileCandidates(PRELOADED_SCORE_DIR, melody.scoreBaseNames, [".musicxml", ".xml"]);
      const audioCandidates = buildPreloadedFileCandidates(PRELOADED_AUDIO_DIR, melody.audioBaseNames, [".mp3", ".wav"]);

      const scoreFile = await fetchFirstAvailableFile(scoreCandidates);
      if (state.defaultMelodyLoadSeq !== requestId) {
        return;
      }
      if (!scoreFile) {
        throw new Error(`No se encontro la partitura de "${melody.label}" en ${PRELOADED_SCORE_DIR}/.`);
      }

      await loadScoreFile(scoreFile);
      if (state.defaultMelodyLoadSeq !== requestId) {
        return;
      }

      const audioFile = await fetchFirstAvailableFile(audioCandidates);
      if (state.defaultMelodyLoadSeq !== requestId) {
        return;
      }

      if (audioFile) {
        loadAudioFile(audioFile);
        setStatus(`Partitura cargada: ${melody.label}. Cargando audio...`, "ok");
      } else {
        loadAudioFile(null, { silent: true });
        setStatus(`Partitura cargada, pero no se encontro audio .mp3/.wav para "${melody.label}".`, "error");
      }

      if (ui.scoreFile) {
        ui.scoreFile.value = "";
      }
      if (ui.audioFile) {
        ui.audioFile.value = "";
      }
    } finally {
      if (state.defaultMelodyLoadSeq === requestId) {
        setDefaultMelodyLoading(false);
      }
    }
  }

  function renderDefaultMelodyButtons() {
    if (!ui.defaultMelodyList) {
      return;
    }
    ui.defaultMelodyList.innerHTML = "";
    const fragment = document.createDocumentFragment();
    for (const melody of DEFAULT_MELODIES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "default-melody-btn";
      button.dataset.melodyId = melody.id;
      button.textContent = melody.label;
      button.addEventListener("click", async () => {
        try {
          await loadDefaultMelody(melody);
        } catch (err) {
          setDefaultMelodySelection("");
          setStatus(err.message || `No se pudo cargar "${melody.label}".`, "error");
        }
      });
      fragment.appendChild(button);
    }
    ui.defaultMelodyList.appendChild(fragment);
    setDefaultMelodySelection(state.selectedDefaultMelodyId);
  }

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  }

  function isNativeFullscreenOnStage() {
    const fsElement = getFullscreenElement();
    return fsElement === ui.stageWrap;
  }

  function updateFullscreenState() {
    const nativeActive = isNativeFullscreenOnStage();
    const pseudoActive = document.body.classList.contains("pseudo-fullscreen");
    const active = nativeActive || pseudoActive;
    state.isFullscreenMode = active;

    document.body.classList.toggle("fullscreen-active", active);
    ui.fullscreenBtn.textContent = active ? "Salir pantalla completa" : "Pantalla completa";
    if (!active) {
      state.fsPanelHidden = false;
    }
    refreshFsOverlayVisibility();

    onResize();
  }

  async function enterFullscreenMode() {
    const request = ui.stageWrap.requestFullscreen || ui.stageWrap.webkitRequestFullscreen || ui.stageWrap.msRequestFullscreen;
    if (request) {
      try {
        const result = request.call(ui.stageWrap);
        if (result && typeof result.then === "function") {
          await result;
        }
        document.body.classList.remove("pseudo-fullscreen");
        updateFullscreenState();
        return;
      } catch (_error) {
        // Fallback abajo.
      }
    }

    document.body.classList.add("pseudo-fullscreen");
    updateFullscreenState();
  }

  async function exitFullscreenMode() {
    if (isNativeFullscreenOnStage()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) {
        try {
          const result = exit.call(document);
          if (result && typeof result.then === "function") {
            await result;
          }
        } catch (_error) {
          // Si falla, igual quitamos el fallback.
        }
      }
    }

    document.body.classList.remove("pseudo-fullscreen");
    updateFullscreenState();
  }

  async function toggleFullscreenMode() {
    if (state.isFullscreenMode) {
      await exitFullscreenMode();
    } else {
      await enterFullscreenMode();
    }
  }

  function parseTimeInputToSeconds(text) {
    const raw = (text || "").trim();
    if (!raw.length) {
      return null;
    }

    if (!raw.includes(":")) {
      const direct = Number(raw.replace(",", "."));
      if (!Number.isFinite(direct) || direct < 0) {
        return null;
      }
      return direct;
    }

    const parts = raw.split(":").map((part) => part.trim());
    if (!parts.length || parts.length > 3 || parts.some((part) => !part.length)) {
      return null;
    }

    let total = 0;
    for (const part of parts) {
      const value = Number(part.replace(",", "."));
      if (!Number.isFinite(value) || value < 0) {
        return null;
      }
      total = total * 60 + value;
    }
    return total;
  }

  function updateSeekBarMax() {
    const maxValue = String(Math.max(0, state.totalDuration));
    ui.seekBar.max = maxValue;
    ui.fsSeekBar.max = maxValue;
  }

  function refreshTransportUi(force = false, nowMs = performance.now()) {
    if (!force && nowMs - state.lastUiRefreshMs < state.uiRefreshIntervalMs) {
      return;
    }
    state.lastUiRefreshMs = nowMs;
    updateTimeLabel();
    if (!state.isUserSeeking) {
      const value = String(state.playhead);
      ui.seekBar.value = value;
      ui.fsSeekBar.value = value;
    }
  }

  function getAdaptiveAudioSampleIntervalMs(rate) {
    // Menor velocidad -> mas muestreos (intervalo menor) para suavidad visual.
    // Mayor velocidad -> menos muestreos para ahorrar recursos.
    return Math.max(20, Math.min(140, 55 * rate));
  }

  function resetAudioVisualClock(nowMs = performance.now(), knownPlayhead = null) {
    let anchor = knownPlayhead;
    if (!Number.isFinite(anchor)) {
      anchor = state.audioReady ? clampPlayhead(audio.currentTime - state.visualOffset) : state.playhead;
    }
    anchor = clampPlayhead(anchor);
    state.audioVisualPlayhead = anchor;
    state.audioVisualMs = nowMs;
    state.audioLastSampleMs = nowMs;
  }

  function seekTo(seconds, nowMs = performance.now()) {
    const target = clampPlayhead(seconds);
    state.playhead = target;

    if (state.audioReady) {
      const targetAudioTime = Math.max(0, target + state.visualOffset);
      audio.currentTime = targetAudioTime;
      resetAudioVisualClock(nowMs, target);
    } else {
      state.playheadAtStart = target;
      if (state.isPlaying) {
        state.playStartedAtMs = nowMs;
      }
    }

    refreshTransportUi(true, nowMs);
  }

  function seekRelative(deltaSeconds, nowMs = performance.now()) {
    if (state.isPlaying) {
      if (state.audioReady) {
        syncPlayheadFromAudio(nowMs, true);
      } else {
        state.playhead = clampPlayhead(getCurrentTimeFromClock(nowMs));
      }
    }
    seekTo(state.playhead + deltaSeconds, nowMs);
  }

  function setPlaybackRate(rate) {
    if (!Number.isFinite(rate)) {
      return;
    }
    const allowed = ALLOWED_SPEEDS.includes(rate) ? rate : 1;
    if (Math.abs(allowed - state.playbackRate) < 1e-9) {
      return;
    }

    const nowMs = performance.now();
    if (state.isPlaying) {
      if (state.audioReady) {
        syncPlayheadFromAudio(nowMs, true);
      } else {
        state.playhead = clampPlayhead(getCurrentTimeFromClock(nowMs));
        state.playheadAtStart = state.playhead;
        state.playStartedAtMs = nowMs;
      }
    }

    state.playbackRate = allowed;
    syncSpeedSelectors();

    if (state.audioReady) {
      audio.playbackRate = allowed;
      resetAudioVisualClock(nowMs, state.playhead);
    }

    refreshTransportUi(true, nowMs);
  }

  function jumpToTypedTime() {
    const parsed = parseTimeInputToSeconds(ui.seekInput.value);
    if (parsed === null) {
      setStatus("Tiempo invalido. Usa formato mm:ss o segundos.", "error");
      return;
    }
    seekTo(parsed);
    setStatus(`Posicionado en ${formatTime(state.playhead)}.`, "ok");
  }

  function isEditableElement(element) {
    if (!element) {
      return false;
    }
    const tag = (element.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || tag === "button" || element.isContentEditable;
  }

  function localTagName(node) {
    if (!node || !node.tagName) {
      return "";
    }
    const lower = node.tagName.toLowerCase();
    const idx = lower.indexOf(":");
    return idx >= 0 ? lower.slice(idx + 1) : lower;
  }

  function childElements(node) {
    return Array.from(node ? node.children : []);
  }

  function firstChildByTag(node, tagName) {
    return childElements(node).find((c) => localTagName(c) === tagName) || null;
  }

  function childrenByTag(node, tagName) {
    return childElements(node).filter((c) => localTagName(c) === tagName);
  }

  function textOfChild(node, tagName) {
    const child = firstChildByTag(node, tagName);
    if (!child) {
      return null;
    }
    const text = (child.textContent || "").trim();
    return text.length ? text : null;
  }

  function parseNumber(text, fallback = null) {
    if (text === null || text === undefined) {
      return fallback;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : fallback;
  }

  function clampByte(value) {
    return Math.max(0, Math.min(255, value));
  }

  function darkenHexColor(hexColor, factor) {
    if (typeof hexColor !== "string") {
      return hexColor;
    }
    const match = /^#([0-9a-fA-F]{6})$/.exec(hexColor.trim());
    if (!match) {
      return hexColor;
    }
    const hex = match[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const darkR = clampByte(Math.round(r * factor));
    const darkG = clampByte(Math.round(g * factor));
    const darkB = clampByte(Math.round(b * factor));
    return `#${darkR.toString(16).padStart(2, "0")}${darkG.toString(16).padStart(2, "0")}${darkB.toString(16).padStart(2, "0")}`;
  }

  function getKeyAdjustedColor(baseColor, isWhiteKey) {
    if (isWhiteKey) {
      return baseColor;
    }
    const cacheKey = `${baseColor}|${BLACK_KEY_DARKEN_FACTOR}`;
    if (blackKeyColorCache.has(cacheKey)) {
      return blackKeyColorCache.get(cacheKey);
    }
    const darkened = darkenHexColor(baseColor, BLACK_KEY_DARKEN_FACTOR);
    blackKeyColorCache.set(cacheKey, darkened);
    return darkened;
  }

  function normalizeLabelText(text) {
    return (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function classifyPartRole(partName, instrumentName) {
    const text = `${normalizeLabelText(partName)} ${normalizeLabelText(instrumentName)}`.trim();
    if (!text.length) {
      return "other";
    }

    const voicePattern = /\b(voz|voces|voice|vocal|choir|coro|soprano|alto|tenor|baritone|bariton|mezzo|contralto|basso)\b/;
    if (voicePattern.test(text)) {
      return "voice";
    }

    const pianoPattern = /\b(piano|grand piano|keyboard|teclado|klavier|fortepiano|pno)\b/;
    if (pianoPattern.test(text)) {
      return "piano";
    }

    return "other";
  }

  function pickMusicXMLColor(partRole, staff, partIndex) {
    if (partRole === "voice") {
      return ROLE_COLORS.voice;
    }
    if (partRole === "piano") {
      return staff === 2 ? ROLE_COLORS.pianoBass : ROLE_COLORS.pianoTreble;
    }
    return GENERIC_PART_COLORS[partIndex % GENERIC_PART_COLORS.length];
  }

  function pickMidiColor(channel, midi, singleChannel) {
    if (singleChannel) {
      return midi < 60 ? ROLE_COLORS.pianoBass : ROLE_COLORS.pianoTreble;
    }
    return MIDI_CHANNEL_COLORS[channel % MIDI_CHANNEL_COLORS.length];
  }

  function separateRepeatedNotes(notes, gapSeconds = 0.028) {
    const groups = new Map();
    for (const note of notes) {
      const partId = note.partId || "";
      const staff = note.staff || 0;
      const key = `${note.midi}|${partId}|${staff}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(note);
    }

    for (const group of groups.values()) {
      group.sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start));
      for (let i = 0; i < group.length - 1; i += 1) {
        const current = group[i];
        const next = group[i + 1];
        const touching = Math.abs(next.start - current.end) <= 0.001;
        if (!touching) {
          continue;
        }
        if (current.tieToNext && next.tieFromPrevious) {
          continue;
        }
        const maxShorten = Math.max(0, current.end - current.start - 0.035);
        const shorten = Math.min(gapSeconds, maxShorten);
        if (shorten > 0) {
          current.end -= shorten;
        }
      }
    }
  }

  function buildMusicXMLPartMap(scorePartwise) {
    const map = new Map();
    const partList = firstChildByTag(scorePartwise, "part-list");
    if (!partList) {
      return map;
    }

    for (const scorePart of childrenByTag(partList, "score-part")) {
      const partId = (scorePart.getAttribute("id") || "").trim();
      if (!partId) {
        continue;
      }
      const partName = textOfChild(scorePart, "part-name") || "";
      const scoreInstrument = childrenByTag(scorePart, "score-instrument")[0];
      const instrumentName = scoreInstrument ? textOfChild(scoreInstrument, "instrument-name") || "" : "";
      const role = classifyPartRole(partName, instrumentName);
      map.set(partId, {
        partName,
        instrumentName,
        role
      });
    }
    return map;
  }

  function parseMusicXMLTempoFromDirection(directionNode) {
    const tempos = [];

    const directSound = firstChildByTag(directionNode, "sound");
    if (directSound && directSound.hasAttribute("tempo")) {
      const bpm = parseNumber(directSound.getAttribute("tempo"));
      if (bpm) {
        tempos.push(bpm);
      }
    }

    for (const directionType of childrenByTag(directionNode, "direction-type")) {
      const metronome = firstChildByTag(directionType, "metronome");
      if (!metronome) {
        continue;
      }
      const beatUnitText = textOfChild(metronome, "beat-unit");
      const perMinuteText = textOfChild(metronome, "per-minute");
      if (!beatUnitText || !perMinuteText) {
        continue;
      }
      const perMinute = parseNumber(perMinuteText);
      if (!perMinute) {
        continue;
      }
      const beatUnitMap = {
        whole: 4,
        half: 2,
        quarter: 1,
        eighth: 0.5,
        "16th": 0.25,
        "32nd": 0.125,
        "64th": 0.0625
      };
      const baseLength = beatUnitMap[beatUnitText.toLowerCase()] || 1;
      const dotted = childrenByTag(metronome, "beat-unit-dot").length;
      const dotFactor = dotted > 0 ? 1.5 : 1;
      tempos.push(perMinute * baseLength * dotFactor);
    }

    return tempos;
  }

  function parsePitchToMidi(noteNode) {
    const pitch = firstChildByTag(noteNode, "pitch");
    if (!pitch) {
      return null;
    }
    const step = textOfChild(pitch, "step");
    const octave = parseNumber(textOfChild(pitch, "octave"));
    const alter = parseNumber(textOfChild(pitch, "alter"), 0);
    if (!step || octave === null) {
      return null;
    }
    const semitone = STEP_TO_SEMITONE[step.toUpperCase()];
    if (semitone === undefined) {
      return null;
    }
    return (octave + 1) * 12 + semitone + alter;
  }

  function normalizeTempoEventsQuarter(events) {
    const filtered = events
      .filter((evt) => Number.isFinite(evt.q) && evt.q >= 0 && Number.isFinite(evt.bpm) && evt.bpm > 0)
      .map((evt, index) => ({
        q: evt.q,
        bpm: Math.min(400, Math.max(20, evt.bpm)),
        index
      }))
      .sort((a, b) => (a.q === b.q ? a.index - b.index : a.q - b.q));

    const merged = [];
    for (const evt of filtered) {
      if (merged.length && Math.abs(merged[merged.length - 1].q - evt.q) < 1e-9) {
        merged[merged.length - 1] = { q: evt.q, bpm: evt.bpm };
      } else {
        merged.push({ q: evt.q, bpm: evt.bpm });
      }
    }

    if (!merged.length || merged[0].q > 0) {
      merged.unshift({ q: 0, bpm: 120 });
    }

    return merged;
  }

  function buildQuarterToSecondsConverter(tempoEvents) {
    const map = tempoEvents.map((evt) => ({ q: evt.q, bpm: evt.bpm, sec: 0 }));
    let accumulated = 0;

    for (let i = 0; i < map.length; i += 1) {
      map[i].sec = accumulated;
      const next = map[i + 1];
      if (next) {
        accumulated += (next.q - map[i].q) * (60 / map[i].bpm);
      }
    }

    function qToSec(q) {
      if (q <= 0) {
        return 0;
      }

      let lo = 0;
      let hi = map.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (map[mid].q <= q) {
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      const idx = Math.max(0, hi);
      const evt = map[idx];
      return evt.sec + (q - evt.q) * (60 / evt.bpm);
    }

    return qToSec;
  }

  function parseMusicXML(xmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");
    const errorNode = xml.getElementsByTagName("parsererror")[0];
    if (errorNode) {
      throw new Error("No se pudo leer el MusicXML. Verifica el archivo exportado.");
    }

    const scorePartwise = xml.getElementsByTagName("score-partwise")[0];
    if (!scorePartwise) {
      throw new Error("Solo se soporta MusicXML tipo score-partwise (.musicxml o .xml no comprimido).");
    }

    const parts = Array.from(scorePartwise.getElementsByTagName("part"));
    if (!parts.length) {
      throw new Error("El archivo no contiene partes musicales.");
    }

    const partInfoMap = buildMusicXMLPartMap(scorePartwise);
    const rawNotes = [];
    const tempoEvents = [{ q: 0, bpm: 120 }];

    parts.forEach((partNode, partIndex) => {
      const partId = (partNode.getAttribute("id") || `part-${partIndex + 1}`).trim();
      const partInfo = partInfoMap.get(partId) || {
        partName: "",
        instrumentName: "",
        role: "other"
      };
      let qCursor = 0;
      let divisions = 1;
      const lastStartByVoice = new Map();

      for (const measureNode of childrenByTag(partNode, "measure")) {
        for (const element of childElements(measureNode)) {
          const tag = localTagName(element);

          if (tag === "attributes") {
            const newDiv = parseNumber(textOfChild(element, "divisions"));
            if (newDiv && newDiv > 0) {
              divisions = newDiv;
            }
            continue;
          }

          if (tag === "direction") {
            const tempos = parseMusicXMLTempoFromDirection(element);
            for (const bpm of tempos) {
              tempoEvents.push({ q: qCursor, bpm });
            }
            continue;
          }

          if (tag === "sound" && element.hasAttribute("tempo")) {
            const bpm = parseNumber(element.getAttribute("tempo"));
            if (bpm) {
              tempoEvents.push({ q: qCursor, bpm });
            }
            continue;
          }

          if (tag === "backup" || tag === "forward") {
            const durationDiv = parseNumber(textOfChild(element, "duration"), 0);
            const deltaQ = durationDiv / divisions;
            qCursor += tag === "backup" ? -deltaQ : deltaQ;
            if (qCursor < 0) {
              qCursor = 0;
            }
            continue;
          }

          if (tag !== "note") {
            continue;
          }

          if (firstChildByTag(element, "grace")) {
            continue;
          }

          const durationDiv = parseNumber(textOfChild(element, "duration"), 0);
          const durationQ = durationDiv / divisions;
          const voice = textOfChild(element, "voice") || "1";
          const isChord = Boolean(firstChildByTag(element, "chord"));
          const isRest = Boolean(firstChildByTag(element, "rest"));

          let startQ;
          if (isChord) {
            startQ = lastStartByVoice.get(voice);
            if (startQ === undefined) {
              startQ = qCursor;
            }
          } else {
            startQ = qCursor;
            lastStartByVoice.set(voice, startQ);
          }

          const midi = parsePitchToMidi(element);
          const staff = parseNumber(textOfChild(element, "staff"), 1);
          const tieNodes = childrenByTag(element, "tie");
          const tieToNext = tieNodes.some((tieNode) => (tieNode.getAttribute("type") || "").toLowerCase() === "start");
          const tieFromPrevious = tieNodes.some((tieNode) => (tieNode.getAttribute("type") || "").toLowerCase() === "stop");

          if (!isRest && midi !== null && durationQ > 0) {
            rawNotes.push({
              midi,
              startQ,
              durationQ,
              staff,
              partId,
              partIndex,
              partRole: partInfo.role,
              tieToNext,
              tieFromPrevious
            });
          }

          if (!isChord && durationQ > 0) {
            qCursor += durationQ;
          }
        }
      }
    });

    const normalizedTempo = normalizeTempoEventsQuarter(tempoEvents);
    const qToSec = buildQuarterToSecondsConverter(normalizedTempo);

    const notes = rawNotes
      .map((n) => {
        const start = qToSec(n.startQ);
        const end = qToSec(n.startQ + n.durationQ);
        return {
          midi: n.midi,
          start,
          end,
          partId: n.partId,
          staff: n.staff,
          tieToNext: n.tieToNext,
          tieFromPrevious: n.tieFromPrevious,
          color: pickMusicXMLColor(n.partRole, n.staff, n.partIndex)
        };
      })
      .filter((n) => Number.isFinite(n.start) && Number.isFinite(n.end) && n.end > n.start)
      .sort((a, b) => (a.start === b.start ? a.midi - b.midi : a.start - b.start));

    separateRepeatedNotes(notes);

    return {
      notes,
      tempoEvents: normalizedTempo
    };
  }

  function readVarLen(bytes, positionRef, end) {
    let value = 0;
    let count = 0;
    while (positionRef.pos < end) {
      const byte = bytes[positionRef.pos];
      positionRef.pos += 1;
      value = (value << 7) | (byte & 0x7f);
      count += 1;
      if (!(byte & 0x80)) {
        return value;
      }
      if (count >= 4) {
        break;
      }
    }
    return value;
  }

  function readU16(bytes, pos) {
    return (bytes[pos] << 8) | bytes[pos + 1];
  }

  function readU32(bytes, pos) {
    return ((bytes[pos] << 24) >>> 0) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
  }

  function readAscii(bytes, pos, len) {
    let out = "";
    for (let i = 0; i < len; i += 1) {
      out += String.fromCharCode(bytes[pos + i]);
    }
    return out;
  }

  function normalizeTempoEventsTick(events) {
    const sorted = events
      .filter((e) => Number.isFinite(e.tick) && e.tick >= 0 && Number.isFinite(e.mpq) && e.mpq > 0)
      .map((e, idx) => ({ ...e, idx }))
      .sort((a, b) => (a.tick === b.tick ? a.idx - b.idx : a.tick - b.tick));

    const merged = [];
    for (const evt of sorted) {
      if (merged.length && merged[merged.length - 1].tick === evt.tick) {
        merged[merged.length - 1] = { tick: evt.tick, mpq: evt.mpq };
      } else {
        merged.push({ tick: evt.tick, mpq: evt.mpq });
      }
    }

    if (!merged.length || merged[0].tick > 0) {
      merged.unshift({ tick: 0, mpq: 500000 });
    }

    return merged;
  }

  function buildTickToSecondsConverter(tempoEvents, ticksPerQuarter) {
    const map = tempoEvents.map((evt) => ({ tick: evt.tick, mpq: evt.mpq, sec: 0 }));
    let accumulated = 0;

    for (let i = 0; i < map.length; i += 1) {
      map[i].sec = accumulated;
      const next = map[i + 1];
      if (next) {
        const deltaTicks = next.tick - map[i].tick;
        accumulated += (deltaTicks * map[i].mpq) / (ticksPerQuarter * 1_000_000);
      }
    }

    function tickToSec(tick) {
      if (tick <= 0) {
        return 0;
      }

      let lo = 0;
      let hi = map.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (map[mid].tick <= tick) {
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      const idx = Math.max(0, hi);
      const evt = map[idx];
      const deltaTicks = tick - evt.tick;
      return evt.sec + (deltaTicks * evt.mpq) / (ticksPerQuarter * 1_000_000);
    }

    return tickToSec;
  }

  function parseMidi(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length < 14) {
      throw new Error("Archivo MIDI invalido.");
    }

    let pos = 0;
    const headerId = readAscii(bytes, pos, 4);
    pos += 4;
    if (headerId !== "MThd") {
      throw new Error("No es un archivo MIDI valido (falta cabecera MThd).");
    }

    const headerLength = readU32(bytes, pos);
    pos += 4;
    if (headerLength < 6 || pos + headerLength > bytes.length) {
      throw new Error("Cabecera MIDI invalida.");
    }

    const format = readU16(bytes, pos);
    const trackCount = readU16(bytes, pos + 2);
    const division = readU16(bytes, pos + 4);
    pos += headerLength;

    if (division & 0x8000) {
      throw new Error("MIDI con division SMPTE no soportado.");
    }

    const ticksPerQuarter = division;
    const tempoEvents = [{ tick: 0, mpq: 500000 }];
    const rawNotes = [];

    for (let t = 0; t < trackCount; t += 1) {
      if (pos + 8 > bytes.length) {
        break;
      }

      const trackId = readAscii(bytes, pos, 4);
      pos += 4;
      if (trackId !== "MTrk") {
        throw new Error(`Track MIDI invalido en indice ${t}.`);
      }

      const trackLength = readU32(bytes, pos);
      pos += 4;
      const end = pos + trackLength;
      if (end > bytes.length) {
        throw new Error("Longitud de track MIDI fuera de rango.");
      }

      let tick = 0;
      let runningStatus = 0;
      const activeNotes = new Map();

      const positionRef = { pos };

      while (positionRef.pos < end) {
        const delta = readVarLen(bytes, positionRef, end);
        tick += delta;
        if (positionRef.pos >= end) {
          break;
        }

        let status = bytes[positionRef.pos];
        positionRef.pos += 1;

        if (status < 0x80) {
          if (!runningStatus) {
            throw new Error("Running status MIDI invalido.");
          }
          positionRef.pos -= 1;
          status = runningStatus;
        } else {
          runningStatus = status;
        }

        if (status === 0xff) {
          if (positionRef.pos >= end) {
            break;
          }
          const metaType = bytes[positionRef.pos];
          positionRef.pos += 1;
          const len = readVarLen(bytes, positionRef, end);
          if (positionRef.pos + len > end) {
            break;
          }

          if (metaType === 0x51 && len === 3) {
            const mpq = (bytes[positionRef.pos] << 16) | (bytes[positionRef.pos + 1] << 8) | bytes[positionRef.pos + 2];
            tempoEvents.push({ tick, mpq });
          }

          positionRef.pos += len;
          if (metaType === 0x2f) {
            break;
          }
          continue;
        }

        if (status === 0xf0 || status === 0xf7) {
          const len = readVarLen(bytes, positionRef, end);
          positionRef.pos = Math.min(end, positionRef.pos + len);
          continue;
        }

        const eventType = status & 0xf0;
        const channel = status & 0x0f;

        if (eventType === 0x90 || eventType === 0x80) {
          if (positionRef.pos + 2 > end) {
            break;
          }
          const note = bytes[positionRef.pos];
          const velocity = bytes[positionRef.pos + 1];
          positionRef.pos += 2;

          const key = `${channel}-${note}`;
          const isNoteOn = eventType === 0x90 && velocity > 0;

          if (isNoteOn) {
            if (!activeNotes.has(key)) {
              activeNotes.set(key, []);
            }
            activeNotes.get(key).push(tick);
          } else {
            const starts = activeNotes.get(key);
            if (starts && starts.length) {
              const startTick = starts.shift();
              if (tick > startTick) {
                rawNotes.push({
                  midi: note,
                  startTick,
                  endTick: tick,
                  channel
                });
              }
            }
          }
          continue;
        }

        if (eventType === 0xa0 || eventType === 0xb0 || eventType === 0xe0) {
          positionRef.pos = Math.min(end, positionRef.pos + 2);
          continue;
        }

        if (eventType === 0xc0 || eventType === 0xd0) {
          positionRef.pos = Math.min(end, positionRef.pos + 1);
          continue;
        }

        throw new Error(`Evento MIDI no soportado: 0x${status.toString(16)}`);
      }

      pos = end;
      if (format === 0 && pos >= bytes.length) {
        break;
      }
    }

    const normalizedTempo = normalizeTempoEventsTick(tempoEvents);
    const tickToSec = buildTickToSecondsConverter(normalizedTempo, ticksPerQuarter);
    const channelsUsed = new Set(rawNotes.map((n) => n.channel));
    const singleChannel = channelsUsed.size <= 1;

    const notes = rawNotes
      .map((n) => {
        const start = tickToSec(n.startTick);
        const end = tickToSec(n.endTick);
        return {
          midi: n.midi,
          start,
          end,
          partId: `ch-${n.channel}`,
          staff: 1,
          tieToNext: false,
          tieFromPrevious: false,
          color: pickMidiColor(n.channel, n.midi, singleChannel)
        };
      })
      .filter((n) => Number.isFinite(n.start) && Number.isFinite(n.end) && n.end > n.start)
      .sort((a, b) => (a.start === b.start ? a.midi - b.midi : a.start - b.start));

    separateRepeatedNotes(notes);

    const quarterTempo = normalizedTempo.map((e) => ({ q: e.tick / ticksPerQuarter, bpm: 60000000 / e.mpq }));

    return {
      notes,
      tempoEvents: normalizeTempoEventsQuarter(quarterTempo)
    };
  }

  function rebuildPianoLayout() {
    const cssWidth = Math.max(320, ui.stageWrap.clientWidth);
    const cssHeight = Math.max(320, ui.canvas.clientHeight || Math.min(window.innerHeight * 0.72, 680));
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    state.renderWidth = cssWidth;
    state.renderHeight = cssHeight;

    ui.canvas.width = Math.floor(cssWidth * dpr);
    ui.canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const whiteCount = 52;
    const whiteW = cssWidth / whiteCount;
    const blackW = whiteW * 0.62;

    const keys = new Map();
    const whiteKeys = [];
    const blackKeys = [];

    let whiteIndex = 0;
    for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi += 1) {
      const pitchClass = ((midi % 12) + 12) % 12;
      const isWhite = WHITE_PITCH_CLASSES.has(pitchClass);
      if (isWhite) {
        const key = {
          midi,
          isWhite: true,
          x: whiteIndex * whiteW,
          width: whiteW,
          pitchClass
        };
        keys.set(midi, key);
        whiteKeys.push(key);
        whiteIndex += 1;
      }
    }

    for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi += 1) {
      if (keys.has(midi)) {
        continue;
      }
      let prev = null;
      let next = null;

      for (let m = midi - 1; m >= MIN_MIDI; m -= 1) {
        const key = keys.get(m);
        if (key && key.isWhite) {
          prev = key;
          break;
        }
      }
      for (let m = midi + 1; m <= MAX_MIDI; m += 1) {
        const key = keys.get(m);
        if (key && key.isWhite) {
          next = key;
          break;
        }
      }

      if (!prev || !next) {
        continue;
      }

      const x = prev.x + prev.width - blackW / 2;
      const key = {
        midi,
        isWhite: false,
        x,
        width: blackW,
        pitchClass: ((midi % 12) + 12) % 12
      };
      keys.set(midi, key);
      blackKeys.push(key);
    }

    state.piano.keys = keys;
    state.piano.whiteKeys = whiteKeys;
    state.piano.blackKeys = blackKeys;
  }

  function drawBackground(width, fallingHeight, keyboardTop, currentTime) {
    const grad = ctx.createLinearGradient(0, 0, 0, keyboardTop);
    grad.addColorStop(0, "#171b24");
    grad.addColorStop(1, "#10131a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, fallingHeight);

    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (const key of state.piano.whiteKeys) {
      ctx.beginPath();
      ctx.moveTo(key.x, 0);
      ctx.lineTo(key.x, keyboardTop);
      ctx.stroke();
    }

    const firstSecond = Math.floor(currentTime);
    for (let s = firstSecond; s < currentTime + state.lookAheadSeconds + 2; s += 1) {
      const y = keyboardTop - (s - currentTime) * state.pixelsPerSecond;
      if (y < 0 || y > keyboardTop) {
        continue;
      }
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      if (s % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "12px Segoe UI";
        ctx.fillText(`${s}s`, 6, y - 4);
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.moveTo(0, keyboardTop + 0.5);
    ctx.lineTo(width, keyboardTop + 0.5);
    ctx.stroke();
  }

  function drawFallingNotes(width, keyboardTop, currentTime, _activeMidiMap) {
    if (!state.notes.length) {
      return;
    }

    const windowStart = Math.max(0, currentTime - 10);
    const windowEnd = currentTime + state.lookAheadSeconds + 8;

    let lo = 0;
    let hi = state.notes.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (state.notes[mid].start < windowStart) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    let i = Math.max(0, lo - 220);
    const minH = 4;

    for (; i < state.notes.length; i += 1) {
      const note = state.notes[i];
      if (note.start > windowEnd) {
        break;
      }
      if (note.end < windowStart) {
        continue;
      }

      const key = state.piano.keys.get(note.midi);
      if (!key) {
        continue;
      }

      const bottomY = keyboardTop - (note.start - currentTime) * state.pixelsPerSecond;
      const height = Math.max(minH, (note.end - note.start) * state.pixelsPerSecond);
      const topY = bottomY - height;

      if (bottomY < -2 || topY > keyboardTop + 2) {
        continue;
      }

      const color = getKeyAdjustedColor(note.color, key.isWhite);
      const xPad = key.isWhite ? 1 : 0;
      const widthPad = key.isWhite ? 2 : 0;
      const drawX = key.x + xPad;
      const drawW = Math.max(2, key.width - widthPad);
      const radius = key.isWhite ? 4 : 3;

      ctx.fillStyle = color;
      ctx.globalAlpha = 1;
      drawRoundedRect(drawX, topY, drawW, height, radius);

      ctx.globalAlpha = 0.32;
      ctx.fillStyle = "#ffffff";
      drawRoundedRect(drawX, topY, drawW, 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawRoundedRect(x, y, width, height, radius) {
    const safeRadius = Math.max(0, Math.min(radius, width * 0.5, height * 0.5));
    if (safeRadius <= 0) {
      ctx.fillRect(x, y, width, height);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawPiano(width, height, keyboardTop, activeMidiMap) {
    const keyboardHeight = height - keyboardTop;
    const blackHeight = keyboardHeight * 0.62;

    for (const key of state.piano.whiteKeys) {
      const activeColor = activeMidiMap.get(key.midi) || null;
      const active = Boolean(activeColor);
      ctx.fillStyle = active ? getKeyAdjustedColor(activeColor, true) : "#f4f6fa";
      ctx.fillRect(key.x, keyboardTop, key.width, keyboardHeight);
      ctx.strokeStyle = "#9aa3b2";
      ctx.lineWidth = 1;
      ctx.strokeRect(key.x, keyboardTop, key.width, keyboardHeight);
    }

    for (const key of state.piano.blackKeys) {
      const activeColor = activeMidiMap.get(key.midi) || null;
      const active = Boolean(activeColor);
      ctx.fillStyle = active ? getKeyAdjustedColor(activeColor, false) : "#1f232b";
      ctx.fillRect(key.x, keyboardTop, key.width, blackHeight);
      ctx.strokeStyle = "#0d1016";
      ctx.lineWidth = 1;
      ctx.strokeRect(key.x, keyboardTop, key.width, blackHeight);
    }

    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(0, keyboardTop, width, 2);
  }

  function getCurrentTimeFromClock(nowMs) {
    return state.playheadAtStart + ((nowMs - state.playStartedAtMs) / 1000) * state.playbackRate;
  }

  function clampPlayhead(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(state.totalDuration, value));
  }

  function syncPlayheadFromAudio(nowMs = performance.now(), forceSample = false) {
    if (!state.audioReady) {
      return;
    }

    if (state.audioVisualMs <= 0 || nowMs < state.audioVisualMs) {
      const measured = clampPlayhead(audio.currentTime - state.visualOffset);
      state.playhead = measured;
      resetAudioVisualClock(nowMs, measured);
      return;
    }

    let dt = (nowMs - state.audioVisualMs) / 1000;
    if (!Number.isFinite(dt) || dt < 0) {
      dt = 0;
    }
    if (dt > 0.2) {
      dt = 0.2;
    }

    let visual = clampPlayhead(state.audioVisualPlayhead + dt * state.playbackRate);

    const sampleIntervalMs = getAdaptiveAudioSampleIntervalMs(state.playbackRate);
    const shouldSample = forceSample || nowMs - state.audioLastSampleMs >= sampleIntervalMs;
    if (shouldSample) {
      const measured = clampPlayhead(audio.currentTime - state.visualOffset);
      const error = measured - visual;

      if (Math.abs(error) > 0.32) {
        visual = measured;
      } else {
        visual = clampPlayhead(visual + error * 0.28);
      }
      state.audioLastSampleMs = nowMs;
    }

    if (state.isPlaying && visual < state.playhead && state.playhead - visual < 0.03) {
      visual = state.playhead;
    }

    state.playhead = visual;
    state.audioVisualPlayhead = visual;
    state.audioVisualMs = nowMs;
  }

  function startPlayback() {
    if (!state.notes.length) {
      return;
    }

    if (state.isPlaying) {
      return;
    }

    const nowMs = performance.now();
    if (state.audioReady) {
      const targetAudioTime = Math.max(0, state.playhead + state.visualOffset);
      audio.currentTime = targetAudioTime;
      audio.playbackRate = state.playbackRate;
      resetAudioVisualClock(nowMs, state.playhead);
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => {
          setStatus(`No se pudo iniciar audio: ${err.message}`, "error");
          state.isPlaying = false;
          updateFsPlayPauseLabel();
        });
      }
    } else {
      state.playheadAtStart = state.playhead;
      state.playStartedAtMs = nowMs;
    }

    state.isPlaying = true;
    updateFsPlayPauseLabel();
    setStatus("Reproduccion en curso.", "ok");
    refreshTransportUi(true, nowMs);
  }

  function pausePlayback() {
    if (!state.isPlaying) {
      return;
    }

    const nowMs = performance.now();
    if (state.audioReady) {
      syncPlayheadFromAudio(nowMs, true);
      audio.pause();
    } else {
      state.playhead = clampPlayhead(getCurrentTimeFromClock(nowMs));
      state.playheadAtStart = state.playhead;
      state.playStartedAtMs = nowMs;
    }

    state.isPlaying = false;
    updateFsPlayPauseLabel();
    setStatus("Reproduccion pausada.");
    refreshTransportUi(true, nowMs);
  }

  function resetPlayback() {
    state.isPlaying = false;
    updateFsPlayPauseLabel();
    if (state.audioReady) {
      audio.pause();
    }
    seekTo(0);
    setStatus("Reproduccion reiniciada.");
  }

  function loadAudioFile(file, options = {}) {
    const silent = Boolean(options && options.silent);

    if (state.audioObjectUrl) {
      URL.revokeObjectURL(state.audioObjectUrl);
      state.audioObjectUrl = null;
    }

    state.audioReady = false;
    if (!file) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      state.audioVisualMs = 0;
      state.audioLastSampleMs = 0;
      state.audioVisualPlayhead = state.playhead;
      if (state.isPlaying) {
        state.playheadAtStart = state.playhead;
        state.playStartedAtMs = performance.now();
      }
      if (!silent) {
        setStatus("Audio quitado. Se usa solo el tempo de la partitura.");
      }
      return;
    }

    state.audioObjectUrl = URL.createObjectURL(file);
    audio.src = state.audioObjectUrl;
    audio.load();

    audio.onloadedmetadata = () => {
      state.audioReady = true;
      audio.playbackRate = state.playbackRate;
      if (!silent) {
        setStatus(`Audio cargado: ${file.name}`, "ok");
      }
      seekTo(state.playhead);
    };

    audio.onerror = () => {
      state.audioReady = false;
      if (!silent) {
        setStatus("No se pudo cargar el audio seleccionado.", "error");
      }
    };
  }

  function computeDuration(notes) {
    let maxEnd = 0;
    for (const n of notes) {
      if (n.end > maxEnd) {
        maxEnd = n.end;
      }
    }
    return maxEnd;
  }

  async function loadScoreFile(file) {
    if (!file) {
      return;
    }

    setStatus(`Leyendo partitura: ${file.name} ...`);

    const extension = file.name.toLowerCase().split(".").pop();
    let parsed;

    if (extension === "mid" || extension === "midi") {
      const buffer = await file.arrayBuffer();
      parsed = parseMidi(buffer);
      state.sourceFormat = "MIDI";
    } else if (extension === "xml" || extension === "musicxml") {
      const text = await file.text();
      parsed = parseMusicXML(text);
      state.sourceFormat = "MusicXML";
    } else {
      throw new Error("Formato no soportado. Usa .musicxml/.xml o .mid/.midi");
    }

    if (!parsed.notes.length) {
      throw new Error("No se encontraron notas utiles en la partitura.");
    }

    state.notes = parsed.notes;
    state.totalDuration = computeDuration(parsed.notes);
    state.playhead = 0;
    state.playheadAtStart = 0;
    state.isPlaying = false;
    updateFsPlayPauseLabel();
    state.sourceName = file.name;
    state.metadata = {
      tempoEvents: parsed.tempoEvents.length,
      noteCount: parsed.notes.length
    };

    setControlsEnabled(true);
    updateSeekBarMax();
    seekTo(0);
    setMeta(`Formato: ${state.sourceFormat} | Notas: ${state.metadata.noteCount} | Cambios de tempo: ${state.metadata.tempoEvents}`);
    setStatus(`Partitura cargada: ${file.name}`, "ok");
  }

  function getActiveMidiMap(currentTime) {
    const active = new Map();
    if (!state.notes.length) {
      return active;
    }

    const startWindow = Math.max(0, currentTime - 8);
    const endWindow = currentTime + 0.02;

    let lo = 0;
    let hi = state.notes.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (state.notes[mid].start < startWindow) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    for (let i = Math.max(0, lo - 220); i < state.notes.length; i += 1) {
      const note = state.notes[i];
      if (note.start > endWindow) {
        break;
      }
      if (note.start <= currentTime && note.end >= currentTime) {
        active.set(note.midi, note.color);
      }
    }

    return active;
  }

  function render(nowMs) {
    state.nowMs = nowMs;

    if (state.isPlaying) {
      if (state.audioReady) {
        syncPlayheadFromAudio(nowMs);
      } else {
        state.playhead = clampPlayhead(getCurrentTimeFromClock(nowMs));
      }

      if (state.playhead >= state.totalDuration) {
        pausePlayback();
      }
    }

    const width = state.renderWidth || ui.canvas.clientWidth;
    const height = state.renderHeight || ui.canvas.clientHeight;
    const keyboardHeight = Math.max(100, height * 0.24);
    const keyboardTop = height - keyboardHeight;

    const activeMidiMap = getActiveMidiMap(state.playhead);

    drawBackground(width, keyboardTop, keyboardTop, state.playhead);
    drawFallingNotes(width, keyboardTop, state.playhead, activeMidiMap);
    drawPiano(width, height, keyboardTop, activeMidiMap);

    refreshTransportUi(false, nowMs);
    requestAnimationFrame(render);
  }

  function onResize() {
    rebuildPianoLayout();
  }

  function initialize() {
    setControlsEnabled(false);
    updateSeekBarMax();
    syncSpeedSelectors();
    setFsPanelScale(1);
    setFsPanelHidden(false);
    updateFsPlayPauseLabel();
    refreshTransportUi(true);
    updateFullscreenState();
    renderDefaultMelodyButtons();

    ui.offsetInput.addEventListener("change", () => {
      const value = parseNumber(ui.offsetInput.value, 0);
      state.visualOffset = Math.max(-10, Math.min(10, value));
      ui.offsetInput.value = String(state.visualOffset);
      if (state.audioReady) {
        seekTo(state.playhead);
      }
    });

    ui.speedSelect.addEventListener("change", () => {
      const rate = parseNumber(ui.speedSelect.value, 1);
      setPlaybackRate(rate);
    });

    ui.fsSpeedSelect.addEventListener("change", () => {
      const rate = parseNumber(ui.fsSpeedSelect.value, 1);
      setPlaybackRate(rate);
    });

    ui.seekBtn.addEventListener("click", jumpToTypedTime);
    ui.seekInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        jumpToTypedTime();
      }
    });

    ui.seekBar.addEventListener("pointerdown", () => {
      state.isUserSeeking = true;
    });

    ui.seekBar.addEventListener("input", () => {
      const target = parseNumber(ui.seekBar.value, 0);
      seekTo(target);
    });

    ui.seekBar.addEventListener("change", () => {
      state.isUserSeeking = false;
      refreshTransportUi(true);
    });

    ui.fsSeekBar.addEventListener("pointerdown", () => {
      state.isUserSeeking = true;
    });

    ui.fsSeekBar.addEventListener("input", () => {
      const target = parseNumber(ui.fsSeekBar.value, 0);
      seekTo(target);
    });

    ui.fsSeekBar.addEventListener("change", () => {
      state.isUserSeeking = false;
      refreshTransportUi(true);
    });

    ui.playBtn.addEventListener("click", startPlayback);
    ui.pauseBtn.addEventListener("click", pausePlayback);
    ui.resetBtn.addEventListener("click", resetPlayback);
    ui.fsPlayPauseBtn.addEventListener("click", () => {
      if (state.isPlaying) {
        pausePlayback();
      } else {
        startPlayback();
      }
    });
    ui.fsResetBtn.addEventListener("click", resetPlayback);

    ui.fullscreenBtn.addEventListener("click", () => {
      toggleFullscreenMode();
    });
    ui.fsExitBtn.addEventListener("click", () => {
      exitFullscreenMode();
    });
    ui.fsSizeDownBtn.addEventListener("click", () => {
      setFsPanelScale(state.fsPanelScale - FS_PANEL_SCALE_STEP);
    });
    ui.fsSizeUpBtn.addEventListener("click", () => {
      setFsPanelScale(state.fsPanelScale + FS_PANEL_SCALE_STEP);
    });
    ui.fsPanelHideBtn.addEventListener("click", () => {
      setFsPanelHidden(true);
    });
    ui.fsPanelShowBtn.addEventListener("click", () => {
      setFsPanelHidden(false);
    });

    ui.scoreFile.addEventListener("change", async (event) => {
      try {
        cancelDefaultMelodyLoad();
        setDefaultMelodySelection("");
        pausePlayback();
        const file = event.target.files && event.target.files[0];
        await loadScoreFile(file);
      } catch (err) {
        setStatus(err.message || "Error al cargar partitura.", "error");
      }
    });

    ui.audioFile.addEventListener("change", (event) => {
      cancelDefaultMelodyLoad();
      const file = event.target.files && event.target.files[0];
      loadAudioFile(file);
    });

    window.addEventListener("keydown", (event) => {
      if (isEditableElement(event.target)) {
        return;
      }
      if (!state.notes.length) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        if (state.isPlaying) {
          pausePlayback();
        } else {
          startPlayback();
        }
        return;
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekRelative(-SEEK_STEP_SECONDS);
        return;
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        seekRelative(SEEK_STEP_SECONDS);
      }
    });

    audio.addEventListener("ended", () => {
      if (state.isPlaying) {
        pausePlayback();
      }
    });

    audio.addEventListener("ratechange", () => {
      if (!state.audioReady) {
        return;
      }
      if (Math.abs(audio.playbackRate - state.playbackRate) > 1e-9) {
        audio.playbackRate = state.playbackRate;
      }
    });

    document.addEventListener("fullscreenchange", updateFullscreenState);
    document.addEventListener("webkitfullscreenchange", updateFullscreenState);
    document.addEventListener("msfullscreenchange", updateFullscreenState);

    window.addEventListener("resize", onResize);

    const resizeObserver = new ResizeObserver(() => {
      onResize();
    });
    resizeObserver.observe(ui.stageWrap);

    onResize();
    requestAnimationFrame(render);
  }

  initialize();
})();
