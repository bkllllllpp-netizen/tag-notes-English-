import { createClient } from "@supabase/supabase-js";

const palettes = [
  ["#ff6b6b", "#ffd6a5"],
  ["#845ef7", "#b197fc"],
  ["#339af0", "#a5d8ff"],
  ["#22b8cf", "#99e9f2"],
  ["#82c91e", "#d8f5a2"],
  ["#fcc419", "#ffe066"],
  ["#f76707", "#ffd8a8"],
  ["#f03e3e", "#ffa8a8"]
];

const escapeHtml = value =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const paletteFor = tag => {
  if (!tag) return palettes[0];
  const key = String(tag).trim().toLowerCase();
  if (!key) return palettes[0];
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  const paletteIndex = hash % palettes.length;
  return palettes[paletteIndex];
};

const STORAGE_KEY = "tag-notebook-state-v1";
const STORAGE_VERSION = 1;
const defaultTags = ["灵感速记", "学习计划", "阅读摘录", "会议纪要", "手写草稿", "待办事项", "思路整理"];

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          detectSessionInUrl: true
        }
      })
    : null;

const dom = {
  authOverlay: document.getElementById("authOverlay"),
  authTitle: document.getElementById("authTitle"),
  authSubtitle: document.getElementById("authSubtitle"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  authSwitchButton: document.getElementById("authSwitchButton"),
  authSwitchHint: document.getElementById("authSwitchHint"),
  authError: document.getElementById("authError"),
  tagContextMenu: document.getElementById("tagContextMenu"),
  tagContextRename: document.querySelector("#tagContextMenu [data-action='rename']"),
  tagContextDelete: document.querySelector("#tagContextMenu [data-action='delete']"),
  tagView: document.getElementById("tagView"),
  listView: document.getElementById("listView"),
  editorView: document.getElementById("editorView"),
  tagCloud: document.getElementById("tagCloud"),
  tagEmptyHint: document.getElementById("tagEmptyHint"),
  tagSearch: document.getElementById("tagSearch"),
  tagTitle: document.getElementById("tagTitle"),
  tagMeta: document.getElementById("tagMeta"),
  noteList: document.getElementById("noteList"),
  fab: document.querySelector(".fab"),
  backHero: document.querySelector(".app-header .back-button"),
  primaryTitle: document.getElementById("primaryTitle"),
  deleteNoteButton: document.getElementById("deleteNoteButton"),
  logoutButton: document.getElementById("logoutButton"),
  saveButton: document.getElementById("saveButton"),
  saveStatus: document.getElementById("saveStatus"),
  syncStatus: document.getElementById("syncStatus"),
  noteTitleInput: document.getElementById("noteTitleInput"),
  richEditor: document.getElementById("richEditor"),
  inlineTags: document.getElementById("inlineTags"),
  editorTagStrip: document.getElementById("editorTagStrip"),
  tagSuggestions: document.getElementById("tagSuggestions"),
  modeTabs: document.querySelectorAll(".mode-tab"),
  handwritePanel: document.getElementById("handwritePanel"),
  inkCanvas: document.getElementById("inkCanvas"),
  penSize: document.getElementById("penSize"),
  lastEdited: document.getElementById("lastEdited"),
  wordCount: document.getElementById("wordCount"),
  listFilterChips: document.querySelectorAll(".list-filters .chip")
};

const state = {
  notes: [],
  activeNoteId: null,
  activeTag: null,
  view: "tags",
  listFilter: "latest",
  editorMode: "keyboard",
  editorTags: new Set(),
  strokes: [],
  isDirty: false,
  lastTriggerKey: null,
  tagSearchTerm: "",
  tagSignature: "",
  tagLibrary: new Map(),
  defaultsSeeded: false,
  session: null,
  user: null,
  authMode: "login",
  isAuthBusy: false,
  isLoadingNotes: false,
  tagMenu: {
    tag: null,
    visible: false
  }
};

const defaultPlain = [
  "Sample notes help you explore the tag-first workflow.",
  "",
  "Highlights:",
  "1. Keep tags consistent across every view.",
  "2. Switch seamlessly between handwriting and keyboard input.",
  "3. Use #hashtags while typing to create tags automatically."
].join("\n");

const cloneStrokes = strokes =>
  Array.isArray(strokes) ? JSON.parse(JSON.stringify(strokes)) : [];

const generateId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;



const storageKeyForUser = () => (state.user && state.user.id ? `${STORAGE_KEY}:${state.user.id}` : null);

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

const isUuid = value =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const requestJson = async (path, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const init = { ...options, signal: controller.signal };
    init.headers = { ...(options.headers || {}) };
    if (state.session?.access_token) {
      init.headers.Authorization = `Bearer ${state.session.access_token}`;
    }
    if (init.body && !(init.body instanceof FormData)) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(init.body);
    }
    const response = await fetch(`${API_BASE_URL}${path}`, init);
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`Request failed (${response.status}): ${message || response.statusText}`);
    }
    if (response.status === 204) return null;
    const data = await response.json();
    return data;
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeRemoteNote = note => ({
  id: note.id,
  title: note.title || "",
  content: note.content || "",
  tags: Array.isArray(note.tags) ? note.tags : [],
  strokes: cloneStrokes(note.strokes),
  createdAt: note.createdAt ? Date.parse(note.createdAt) : Date.now(),
  updatedAt: note.updatedAt ? Date.parse(note.updatedAt) : Date.now(),
  userId: note.userId || null,
  isRemote: true
});

const normalizeLocalNote = note => ({
  ...note,
  title: note.title || "",
  content: note.content || "",
  tags: Array.isArray(note.tags) ? note.tags : [],
  strokes: cloneStrokes(note.strokes),
  createdAt: typeof note.createdAt === "number" ? note.createdAt : Date.now(),
  updatedAt: typeof note.updatedAt === "number" ? note.updatedAt : Date.now(),
  userId: note.userId || state.user?.id || null,
  isRemote: isUuid(note.id)
});

const api = {
  async listNotes() {
    const data = await requestJson("/notes", { method: "GET" });
    return Array.isArray(data?.notes) ? data.notes.map(normalizeRemoteNote) : [];
  },
  async createNote(payload) {
    const data = await requestJson("/notes", { method: "POST", body: payload });
    return normalizeRemoteNote(data);
  },
  async updateNote(id, payload) {
    const data = await requestJson(`/notes/${id}`, { method: "PATCH", body: payload });
    return normalizeRemoteNote(data);
  },
  async deleteNote(id) {
    await requestJson(`/notes/${id}`, { method: "DELETE" });
  }
};

const setAuthMode = mode => {
  state.authMode = mode;
  if (!dom.loginForm || !dom.registerForm) return;
  dom.loginForm.classList.toggle("hidden", mode !== "login");
  dom.registerForm.classList.toggle("hidden", mode !== "register");
  if (dom.authTitle) {
    dom.authTitle.textContent = mode === "login" ? "Sign in" : "Create account";
  }
  if (dom.authSubtitle) {
    dom.authSubtitle.textContent =
      mode === "login" ? "Sign in to sync your notes" : "Create an account to start syncing";
  }
  if (dom.authSwitchHint) {
    dom.authSwitchHint.textContent = mode === "login" ? "Need an account?" : "Already have an account?";
  }
  if (dom.authSwitchButton) {
    dom.authSwitchButton.textContent = mode === "login" ? "Sign up" : "Sign in";
  }
  setAuthError("");
};

const setAuthError = message => {
  if (!dom.authError) return;
  if (message) {
    dom.authError.textContent = message;
    dom.authError.classList.remove("hidden");
  } else {
    dom.authError.textContent = "";
    dom.authError.classList.add("hidden");
  }
};

const setAuthBusy = busy => {
  state.isAuthBusy = busy;
  [dom.loginForm, dom.registerForm].forEach(form => {
    if (!form) return;
    form.querySelectorAll("input, button").forEach(element => {
      element.disabled = busy;
    });
  });
  if (dom.authSwitchButton) {
    dom.authSwitchButton.disabled = busy;
  }
};

const showAuthOverlay = (mode = state.authMode) => {
  setAuthMode(mode);
  dom.authOverlay?.classList.remove("hidden");
  if (dom.syncStatus) dom.syncStatus.textContent = "Sign in to sync";
};

const hideAuthOverlay = () => {
  dom.authOverlay?.classList.add("hidden");
  setAuthError("");
};

const resetStateForLogout = () => {
  state.notes = [];
  state.activeNoteId = null;
  state.activeTag = null;
  state.view = "tags";
  state.listFilter = "latest";
  state.editorMode = "keyboard";
  state.editorTags = new Set();
  state.strokes = [];
  state.isDirty = false;
  state.tagLibrary = new Map();
  state.defaultsSeeded = false;
  state.tagMenu = { tag: null, visible: false };
  dom.noteList.innerHTML = "";
  dom.tagCloud.innerHTML = "";
  dom.tagEmptyHint?.classList.add("hidden");
  dom.noteTitleInput.value = "";
  dom.richEditor.innerHTML = "";
  dom.inlineTags.innerHTML = "";
  dom.editorTagStrip.innerHTML = "";
  dom.tagSuggestions.innerHTML = "";
  dom.lastEdited.textContent = "-";
  dom.wordCount.textContent = "0";
  markSaved();
  ensureTagLibrarySeeded();
  renderTagCloud();
  renderListView();
  setView("tags");
};

const applySession = session => {
  state.session = session;
  state.user = session?.user ?? null;
  if (state.user) {
    hideAuthOverlay();
    dom.logoutButton?.classList.remove("hidden");
    if (dom.fab) dom.fab.disabled = false;
    if (dom.saveButton) dom.saveButton.disabled = false;
    if (dom.syncStatus) {
      dom.syncStatus.disabled = true;
      dom.syncStatus.textContent = "Syncing...";
    }
    loadState()
      .then(() => {
        renderTagCloud();
        renderListView();
      })
      .catch(error => {
        console.error("Failed to load notes after login", error);
        dom.syncStatus.textContent = "Sync failed";
        setAuthError("Unable to load notes, please try again soon.");
      });
  } else {
    dom.logoutButton?.classList.add("hidden");
    if (dom.fab) dom.fab.disabled = true;
    if (dom.saveButton) dom.saveButton.disabled = true;
    resetStateForLogout();
    showAuthOverlay("login");
    if (dom.syncStatus) {
      dom.syncStatus.disabled = false;
      dom.syncStatus.textContent = "Sign in to sync";
    }
  }
};

const initializeAuth = async () => {
  if (!supabase) {
    console.error(
      "Supabase auth is not configured. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env."
    );
    showAuthOverlay("login");
    setAuthError("Missing Supabase configuration. Please update client/.env.");
    if (dom.syncStatus) dom.syncStatus.textContent = "Auth misconfigured";
    return;
  }

  showAuthOverlay("login");

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Failed to get initial session", error);
      setAuthError("Unable to load session, please try again.");
    }
    applySession(data?.session ?? null);
  } catch (error) {
    console.error("Unexpected auth initialization failure", error);
    setAuthError("There was a problem initialising authentication.");
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });
};

const extractFormCredentials = form => {
  const data = new FormData(form);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "").trim();
  return { email, password };
};

const handleLoginSubmit = async event => {
  event.preventDefault();
  if (!supabase || state.isAuthBusy) return;
  const { email, password } = extractFormCredentials(event.currentTarget);
  if (!email || !password) {
    setAuthError("Enter your email and password");
    return;
  }
  setAuthBusy(true);
  setAuthError("");
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
    } else {
      event.currentTarget.reset();
    }
  } catch (error) {
    console.error("Login failed", error);
    setAuthError("Sign in failed, please try again later.");
  } finally {
    setAuthBusy(false);
  }
};

const handleRegisterSubmit = async event => {
  event.preventDefault();
  if (!supabase || state.isAuthBusy) return;
  const { email, password } = extractFormCredentials(event.currentTarget);
  if (!email || !password) {
    setAuthError("Enter your email and password");
    return;
  }
  if (password.length < 6) {
    setAuthError("Password must be at least 6 characters long");
    return;
  }
  setAuthBusy(true);
  setAuthError("");
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
      return;
    }
    event.currentTarget.reset();
    if (!data.session) {
      setAuthError("Registration almost done - check your email to confirm before signing in.");
    } else {
      setAuthError("");
    }
    setAuthMode("login");
  } catch (error) {
    console.error("Register failed", error);
    setAuthError("Sign up failed, please try again later.");
  } finally {
    setAuthBusy(false);
  }
};

const handleAuthSwitch = () => {
  if (state.isAuthBusy) return;
  const targetMode = state.authMode === "login" ? "register" : "login";
  setAuthMode(targetMode);
};

const handleLogout = async () => {
  if (!supabase) return;
  try {
    dom.syncStatus.textContent = "Signing out...";
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Logout failed", error);
    dom.syncStatus.textContent = "Sign out failed";
    setAuthError("Sign out failed, please try again.");
  }
};

const getAllTagStats = () => {
  const stats = new Map();
  state.notes.forEach(note => {
    note.tags.forEach(tag => {
      if (!stats.has(tag)) {
        stats.set(tag, { count: 0, latest: 0 });
      }
      const entry = stats.get(tag);
      entry.count += 1;
      entry.latest = Math.max(entry.latest, note.updatedAt);
    });
  });
  return stats;
};

const ensureTagExists = tag => {
  if (!tag) return;
  if (!state.tagLibrary.has(tag)) {
    state.tagLibrary.set(tag, { name: tag, createdAt: Date.now() });
  }
};

const ensureTagLibrarySeeded = () => {
  if (!(state.tagLibrary instanceof Map)) {
    state.tagLibrary = new Map();
  }
  if (!state.defaultsSeeded) {
    defaultTags.forEach(ensureTagExists);
    state.defaultsSeeded = true;
  }
  state.notes.forEach(note => note.tags.forEach(ensureTagExists));
};

const collectAllTags = () => {
  ensureTagLibrarySeeded();
  const uniq = new Set(defaultTags);
  state.tagLibrary.forEach((_, tag) => uniq.add(tag));
  state.notes.forEach(note => note.tags.forEach(tag => uniq.add(tag)));
  return Array.from(uniq);
};

const formatRelativeTime = timestamp => {
  if (!timestamp) return "-";
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const countWords = text => {
  if (!text) return 0;
  const cjkCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const alphabetic = text
    .replace(/[\u4e00-\u9fff]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return cjkCount + alphabetic.length;
};

const plainToHtmlWithTags = plain => {
  const safe = escapeHtml(plain);
  return safe
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(line =>
      line.replace(/#([^\s#]+)/g, (_, tag) => {
        const [color] = paletteFor(tag);
        return `<span class="tag-bubble" contenteditable="false" data-tag="${tag}" style="background:${color}1f;color:${color};"><span>#${tag}</span><button class="tag-bubble-remove" tabindex="-1" aria-label="移除标签 ${tag}">&#x00D7;</button></span>`;
      })
    )
    .join("<br>");
};

const htmlToPlainString = html => {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  temp.querySelectorAll(".tag-bubble").forEach(bubble => {
    bubble.replaceWith(document.createTextNode(`#${bubble.dataset.tag}`));
  });
  return temp.innerText;
};

const hydrateTagBubbleHandlers = () => {
  dom.richEditor.querySelectorAll(".tag-bubble").forEach(bubble => {
    const remove = bubble.querySelector(".tag-bubble-remove");
    if (remove && !remove.dataset.bound) {
      remove.dataset.bound = "true";
      remove.addEventListener("click", event => {
        event.stopPropagation();
        bubble.replaceWith(document.createTextNode(`#${bubble.dataset.tag} `));
        markDirty();
        syncEditorTags();
      });
    }
  });
};

const collectTagsFromEditor = () => {
  hydrateTagBubbleHandlers();
  const tags = new Set();
  dom.richEditor.querySelectorAll(".tag-bubble").forEach(bubble => {
    tags.add(bubble.dataset.tag);
  });
  state.editorTags = tags;
  return tags;
};

const setCaretAfterNode = node => {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
};

const createInlineTagBubble = tag => {
  const [color] = paletteFor(tag);
  const bubble = document.createElement("span");
  bubble.className = "tag-bubble";
  bubble.contentEditable = "false";
  bubble.dataset.tag = tag;
  bubble.style.background = `${color}1f`;
  bubble.style.color = color;

  const text = document.createElement("span");
  text.textContent = `#${tag}`;

  const remove = document.createElement("button");
  remove.className = "tag-bubble-remove";
  remove.type = "button";
  remove.textContent = "\u00D7";
  remove.title = `移除标签 ${tag}`;
  remove.addEventListener("click", event => {
    event.stopPropagation();
    bubble.replaceWith(document.createTextNode(`#${tag} `));
    markDirty();
    syncEditorTags();
  });

  bubble.append(text, remove);
  return bubble;
};

const convertTagAtCaret = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const container = range.startContainer;
  if (container.nodeType !== Node.TEXT_NODE) return;

  const textBeforeCaret = container.textContent.slice(0, range.startOffset);
  const trailingChar = textBeforeCaret.slice(-1);
  if (!/\s/.test(trailingChar || "")) return;
  const withoutTrigger = textBeforeCaret.slice(0, -1);
  const match = withoutTrigger.match(/#([^\s#]+)$/);
  if (!match) return;

  const tag = match[1];
  const startIndex = withoutTrigger.length - match[0].length;
  const endIndex = withoutTrigger.length;

  const leading = container.textContent.slice(0, startIndex);
  const trailing = container.textContent.slice(range.startOffset);
  container.textContent = leading;

  const bubble = createInlineTagBubble(tag);
  container.parentNode.insertBefore(bubble, container.nextSibling);

  const spacer = document.createTextNode(trailingChar);
  container.parentNode.insertBefore(spacer, bubble.nextSibling);

  if (trailing.length) {
    const rest = document.createTextNode(trailing);
    container.parentNode.insertBefore(rest, spacer.nextSibling);
  }

  setCaretAfterNode(spacer);
  markDirty();
  syncEditorTags();
};

const syncEditorTags = () => {
  const tags = collectTagsFromEditor();
  tags.forEach(ensureTagExists);
  const sortedSignature = Array.from(tags).sort().join("|");
  if (state.tagSignature !== sortedSignature) {
    state.tagSignature = sortedSignature;
    const note = getActiveNote();
    if (note) {
      note.tags = Array.from(tags);
    }
    renderTagCloud();
    renderListView();
  }
  renderInlineTags(tags);
  renderEditorTagStrip(tags);
  renderTagSuggestions(tags);
};

const renderInlineTags = tags => {
  dom.inlineTags.innerHTML = "";
  if (!tags.size) {
    dom.inlineTags.innerHTML = `<p class="subtitle">输入 #标签名 后按空格即可生成彩色标签。</p>`;
    return;
  }
  tags.forEach(tag => {
    const [color] = paletteFor(tag);
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.style.background = color;
    chip.textContent = `#${tag}`;
    dom.inlineTags.appendChild(chip);
  });
};

const renderEditorTagStrip = tags => {
  dom.editorTagStrip.innerHTML = "";
  tags.forEach(tag => {
    const [color] = paletteFor(tag);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag-chip";
    chip.style.background = color;
    chip.textContent = `#${tag}`;
    chip.addEventListener("click", () => removeTagFromEditor(tag));
    dom.editorTagStrip.appendChild(chip);
  });
};

const renderTagSuggestions = tags => {
  dom.tagSuggestions.innerHTML = "";
  const stats = getAllTagStats();
  const candidates = Array.from(stats.entries())
    .filter(([tag]) => !tags.has(tag))
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 6);
  if (!candidates.length) return;
  candidates.forEach(([tag]) => {
    const [color] = paletteFor(tag);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag-chip";
    chip.style.background = color;
    chip.textContent = `#${tag}`;
    chip.addEventListener("click", () => {
      const bubble = createInlineTagBubble(tag);
      dom.richEditor.appendChild(document.createTextNode(" "));
      dom.richEditor.appendChild(bubble);
      dom.richEditor.appendChild(document.createTextNode(" "));
      setCaretAfterNode(bubble);
      markDirty();
      syncEditorTags();
    });
    dom.tagSuggestions.appendChild(chip);
  });
};

const removeTagFromEditor = tag => {
  dom.richEditor.querySelectorAll(`.tag-bubble[data-tag="${tag}"]`).forEach(bubble => {
    bubble.replaceWith(document.createTextNode(`#${tag} `));
  });
  markDirty();
  syncEditorTags();
};

const getActiveNote = () => state.notes.find(note => note.id === state.activeNoteId) || null;

function refreshActiveEditor() {
  if (state.view !== "editor") return;
  const note = getActiveNote();
  if (!note) return;
  renderEditor(note);
}

const setView = view => {
  state.view = view;
  const targetId = view === "tags" ? "tagView" : `${view}View`;
  [dom.tagView, dom.listView, dom.editorView].forEach(section => {
    section.classList.toggle("visible", section.id === targetId);
  });
  dom.backHero.classList.toggle("hidden", view === "tags");
  dom.deleteNoteButton.classList.toggle("hidden", view !== "editor" || !state.activeNoteId);
  if (view === "tags") {
    dom.primaryTitle.textContent = "我的笔记";
  } else if (view === "list") {
    dom.primaryTitle.textContent = state.activeTag ? `#${state.activeTag}` : "全部笔记";
  } else {
    dom.primaryTitle.textContent = "编辑笔记";
  }
};

const markDirty = () => {
  if (!state.activeNoteId) return;
  if (!state.isDirty) {
    dom.saveStatus.textContent = "Unsaved changes";
    if (dom.syncStatus) dom.syncStatus.textContent = "Pending sync";
    dom.saveButton.disabled = false;
  }
  state.isDirty = true;
};

const markSaved = () => {
  state.isDirty = false;
  dom.saveStatus.textContent = "Saved";
  if (dom.syncStatus) dom.syncStatus.textContent = "Synced";
  dom.saveButton.disabled = true;
};

const markSyncing = () => {
  dom.saveStatus.textContent = "Saving...";
  if (dom.syncStatus) dom.syncStatus.textContent = "Syncing...";
  dom.saveButton.disabled = true;
};

const markSyncError = () => {
  dom.saveStatus.textContent = "Save failed";
  if (dom.syncStatus) dom.syncStatus.textContent = "Sync failed";
  dom.saveButton.disabled = false;
};

const hideTagContextMenu = () => {
  if (!dom.tagContextMenu || !state.tagMenu.visible) return;
  dom.tagContextMenu.classList.add("hidden");
  state.tagMenu = { tag: null, visible: false };
};

const showTagContextMenu = (tag, clientX, clientY) => {
  if (!dom.tagContextMenu) return;
  hideTagContextMenu();
  const menu = dom.tagContextMenu;
  menu.classList.remove("hidden");
  menu.style.left = `${clientX}px`;
  menu.style.top = `${clientY}px`;
  const { offsetWidth, offsetHeight } = menu;
  let x = clientX;
  let y = clientY;
  if (x + offsetWidth > window.innerWidth) {
    x = window.innerWidth - offsetWidth - 8;
  }
  if (y + offsetHeight > window.innerHeight) {
    y = window.innerHeight - offsetHeight - 8;
  }
  menu.style.left = `${Math.max(8, x)}px`;
  menu.style.top = `${Math.max(8, y)}px`;
  state.tagMenu = { tag, visible: true };
  dom.tagContextRename?.focus();
};

const renderTagCloud = () => {
  hideTagContextMenu();
  const stats = getAllTagStats();
  const keywords = state.tagSearchTerm.trim().toLowerCase();
  const entries = collectAllTags()
    .filter(tag => (!keywords ? true : tag.toLowerCase().includes(keywords)))
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  dom.tagCloud.innerHTML = "";
  if (!entries.length) {
    dom.tagEmptyHint.classList.remove("hidden");
    return;
  }
  dom.tagEmptyHint.classList.add("hidden");

  entries.forEach(tag => {
    const meta = stats.get(tag) || { count: 0, latest: 0 };
    const container = document.createElement("div");
    container.className = "tag-item";

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag-chip";
    const [color] = paletteFor(tag);
    chip.style.background = color;
    chip.innerHTML = `#${tag} <span>${meta.count}</span>`;
    chip.title = meta.count
      ? `${meta.count} 条笔记 · 最近更新 ${formatRelativeTime(meta.latest)}`
      : "暂未有笔记关联该标签";
    chip.addEventListener("click", () => {
      state.activeTag = tag;
      state.listFilter = "latest";
      setView("list");
      renderListView();
    });
    chip.addEventListener("contextmenu", event => {
      event.preventDefault();
      showTagContextMenu(tag, event.clientX, event.clientY);
    });
    chip.addEventListener("keydown", event => {
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        const rect = chip.getBoundingClientRect();
        showTagContextMenu(tag, rect.left + rect.width / 2, rect.bottom);
      }
    });

    container.appendChild(chip);
    dom.tagCloud.appendChild(container);
  });
};

async function renameTagEverywhere(tag) {
  hideTagContextMenu();
  if (!state.user) {
    showAuthOverlay("login");
    return;
  }
  const input = prompt(`Rename tag "${tag}" to:`, tag);
  if (input === null) return;
  const next = input.replace(/^#/, "").trim();
  if (!next || next === tag) return;

  try {
    await flushActiveNoteIfDirty();
  } catch (error) {
    console.error("Failed to flush dirty note before renaming tag", error);
    dom.syncStatus.textContent = "Sync failed";
    alert("Please save the current note before trying again.");
    return;
  }

  const affected = state.notes.filter(note => note.tags.includes(tag));
  const backups = affected.map(note => ({
    note,
    tags: [...note.tags],
    updatedAt: note.updatedAt
  }));

  if (affected.length && dom.syncStatus) {
    dom.syncStatus.textContent = "Syncing...";
  }

  try {
    for (const { note } of backups) {
      const updatedTags = Array.from(new Set(note.tags.map(t => (t === tag ? next : t))));
      if (updatedTags.join("|") === note.tags.join("|")) continue;
      note.tags = updatedTags;
      note.updatedAt = Date.now();
      await syncNoteAfterExternalChange(note);
    }
  } catch (error) {
    console.error("Failed to rename tag across notes", error);
    backups.forEach(({ note, tags, updatedAt }) => {
      note.tags = tags;
      note.updatedAt = updatedAt;
    });
    if (dom.syncStatus) {
      dom.syncStatus.textContent = "Sync failed";
    }
    alert("Unable to rename the tag right now. Please try again later.");
    return;
  }

  const originalMeta = state.tagLibrary.get(tag);
  state.tagLibrary.delete(tag);
  const targetMeta = state.tagLibrary.get(next);
  const createdAt = targetMeta?.createdAt ?? originalMeta?.createdAt ?? Date.now();
  state.tagLibrary.set(next, { name: next, createdAt });

  if (state.activeTag === tag) {
    state.activeTag = next;
  }

  persistState();
  renderTagCloud();
  renderListView();
  refreshActiveEditor();
  if (dom.syncStatus) {
    dom.syncStatus.textContent = "Synced";
  }
}

async function deleteTagEverywhere(tag) {
  hideTagContextMenu();
  if (!state.user) {
    showAuthOverlay("login");
    return;
  }
  const confirmed = confirm(
    `Remove the tag "${tag}" from all notes? The notes themselves will stay intact.`
  );
  if (!confirmed) return;

  try {
    await flushActiveNoteIfDirty();
  } catch (error) {
    console.error("Failed to flush dirty note before deleting tag", error);
    dom.syncStatus.textContent = "Sync failed";
    alert("Please save the current note before trying again.");
    return;
  }

  const affected = state.notes.filter(note => note.tags.includes(tag));
  const backups = affected.map(note => ({
    note,
    tags: [...note.tags],
    updatedAt: note.updatedAt
  }));

  if (affected.length && dom.syncStatus) {
    dom.syncStatus.textContent = "Syncing...";
  }

  try {
    for (const { note } of backups) {
      const updatedTags = note.tags.filter(t => t !== tag);
      if (updatedTags.length === note.tags.length) continue;
      note.tags = updatedTags;
      note.updatedAt = Date.now();
      await syncNoteAfterExternalChange(note);
    }
  } catch (error) {
    console.error("Failed to delete tag across notes", error);
    backups.forEach(({ note, tags, updatedAt }) => {
      note.tags = tags;
      note.updatedAt = updatedAt;
    });
    dom.syncStatus.textContent = "Sync failed";
    alert("Unable to remove the tag right now. Please try again later.");
    return;
  }

  state.tagLibrary.delete(tag);
  if (state.activeTag === tag) {
    state.activeTag = null;
    setView("tags");
  }

  persistState();
  renderTagCloud();
  renderListView();
  refreshActiveEditor();
  if (dom.syncStatus) {
    dom.syncStatus.textContent = "Synced";
  }
}

const formatTagMeta = notes => {
  if (!notes.length) return "0 条笔记 · 暂无更新";
  const latest = Math.max(...notes.map(note => note.updatedAt));
  return `${notes.length} 条笔记 · 更新于 ${formatRelativeTime(latest)}`;
};

async function deleteNoteById(noteId, options = {}) {
  if (!state.user) {
    showAuthOverlay("login");
    return false;
  }
  const note = state.notes.find(item => item.id === noteId);
  if (!note) return false;
  if (!options.skipConfirm) {
    const confirmed = confirm("Delete this note? This action cannot be undone.");
    if (!confirmed) return false;
  }

  dom.syncStatus.textContent = "Syncing...";

  try {
    if (note.isRemote && isUuid(note.id)) {
      await api.deleteNote(note.id);
    }
    state.notes = state.notes.filter(item => item.id !== noteId);
    const removedActive = state.activeNoteId === noteId;
    if (removedActive) {
      state.activeNoteId = null;
      state.isDirty = false;
      markSaved();
    }
    persistState();
    renderTagCloud();
    renderListView();
    if (removedActive && state.view === "editor") {
      setView("tags");
    }
    dom.syncStatus.textContent = "Synced";
    return true;
  } catch (error) {
    console.error("Failed to delete note", error);
    dom.syncStatus.textContent = "Sync failed";
    alert("Unable to delete the note right now. Please try again later.");
    throw error;
  }
}

const getNotePreview = note => {
  const text = htmlToPlainString(note.content || "");
  return text.length > 160 ? `${text.slice(0, 160)}…` : text || "No content yet";
};

const renderNoteList = dataset => {
  dom.noteList.innerHTML = "";
  if (!dataset.length) {
    dom.noteList.innerHTML = `<p class="subtitle">No notes yet. Use the + button to create the first one.</p>`;
    return;
  }

  dataset.forEach(note => {
    const card = document.createElement("article");
    card.className = "note-card";
    card.innerHTML = `
      <div class="note-card-header">
        <h3>${escapeHtml(note.title || "Untitled note")}</h3>
        <button type="button" class="note-card-delete" aria-label="Delete note">Delete</button>
      </div>
      <p>${escapeHtml(getNotePreview(note))}</p>
      <div class="note-meta">
        <span>${formatRelativeTime(note.updatedAt)}</span>
        <span>${countWords(htmlToPlainString(note.content || ""))} words</span>
        ${note.strokes?.length ? "<span>Handwriting</span>" : ""}
      </div>
      <div class="tag-inline"></div>
    `;
    const tagInline = card.querySelector(".tag-inline");
    note.tags.forEach(tag => {
      const [color] = paletteFor(tag);
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.style.background = color;
      chip.textContent = `#${tag}`;
      tagInline.appendChild(chip);
    });
    const deleteButton = card.querySelector(".note-card-delete");
    deleteButton.addEventListener("click", event => {
      event.stopPropagation();
      deleteNoteById(note.id);
    });
    card.addEventListener("click", () => openNote(note.id));
    dom.noteList.appendChild(card);
  });
};

const renderListView = () => {
  const dataset = state.notes.filter(note =>
    state.activeTag ? note.tags.includes(state.activeTag) : true
  );
  state.listFilter === "handwrite"
    ? dataset.sort((a, b) => b.updatedAt - a.updatedAt)
    : dataset.sort((a, b) =>
        state.listFilter === "latest" ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt
      );
  const filtered =
    state.listFilter === "handwrite" ? dataset.filter(note => note.strokes?.length) : dataset;
  renderNoteList(filtered);
  dom.tagTitle.textContent = state.activeTag ? `# ${state.activeTag}` : "All notes";
  dom.tagMeta.textContent = formatTagMeta(filtered);

  dom.listFilterChips.forEach(chip => {
    chip.classList.toggle("active", chip.dataset.sort === state.listFilter);
  });
};

const updateWordCount = () => {
  const plain = htmlToPlainString(dom.richEditor.innerHTML);
  dom.wordCount.textContent = countWords(plain);
};

const renderEditor = note => {
  dom.noteTitleInput.value = note.title || "";
  dom.richEditor.innerHTML = note.content || "";
  hydrateTagBubbleHandlers();
  state.editorTags = new Set(note.tags);
  state.tagSignature = note.tags.slice().sort().join("|");
  state.strokes = cloneStrokes(note.strokes);
  updateWordCount();
  dom.lastEdited.textContent = note.updatedAt ? formatRelativeTime(note.updatedAt) : "-";
  markSaved();
  syncEditorTags();
  redrawCanvas();
};

const saveCurrentNote = async ({ silent } = { silent: false }) => {
  const note = getActiveNote();
  if (!note) return null;
  if (!state.user) {
    showAuthOverlay("login");
    return null;
  }

  const plain = htmlToPlainString(dom.richEditor.innerHTML);
  const tags = new Set(state.editorTags);
  (plain.match(/#[^\s#]+/g) || []).forEach(match => tags.add(match.slice(1)));
  tags.forEach(ensureTagExists);

  note.title = dom.noteTitleInput.value.trim();
  note.content = dom.richEditor.innerHTML;
  note.tags = Array.from(tags);
  note.strokes = cloneStrokes(state.strokes);
  if (!note.createdAt) note.createdAt = Date.now();
  note.updatedAt = Date.now();
  note.userId = state.user.id;

  markSyncing();

  const payload = {
    title: note.title,
    content: note.content,
    tags: note.tags,
    strokes: note.strokes
  };

  try {
    const syncedNote =
      !note.isRemote || !isUuid(note.id)
        ? await api.createNote(payload)
        : await api.updateNote(note.id, payload);

    Object.assign(note, syncedNote, { isRemote: true });
    state.activeNoteId = note.id;
    state.strokes = cloneStrokes(note.strokes);
    note.tags.forEach(ensureTagExists);
    persistState();
    dom.lastEdited.textContent = formatRelativeTime(note.updatedAt);
    markSaved();
    if (!silent) {
      renderTagCloud();
      renderListView();
    }
    return note;
  } catch (error) {
    console.error("Failed to sync note", error);
    markSyncError();
    if (!silent) {
      alert("保存失败，请稍后重试。");
    }
    throw error;
  }
};

async function flushActiveNoteIfDirty() {
  if (!state.isDirty) return;
  await saveCurrentNote({ silent: true });
}

async function syncNoteAfterExternalChange(note) {
  if (!note) return null;
  if (!state.user) {
    showAuthOverlay("login");
    throw new Error("Authentication required");
  }
  if (!note.isRemote || !isUuid(note.id)) {
    persistState();
    return note;
  }
  const payload = {
    title: note.title,
    content: note.content,
    tags: note.tags,
    strokes: note.strokes
  };
  const synced = await api.updateNote(note.id, payload);
  Object.assign(note, synced, { isRemote: true });
  persistState();
  return note;
}

const deleteCurrentNote = async () => {
  const note = getActiveNote();
  if (!note) return;
  await deleteNoteById(note.id);
};

const openNote = async id => {
  if (state.isDirty) {
    try {
      await saveCurrentNote({ silent: true });
    } catch (error) {
      console.warn("Aborted navigation due to pending changes", error);
      return;
    }
  }
  state.activeNoteId = id;
  const note = getActiveNote();
  if (!note) return;
  renderEditor(note);
  setView("editor");
};

const createNewNote = async () => {
  if (!state.user) {
    showAuthOverlay("login");
    return;
  }
  if (state.isDirty) {
    try {
      await saveCurrentNote({ silent: true });
    } catch (error) {
      console.warn("Aborted new note creation due to pending changes", error);
      return;
    }
  }
  const id = generateId();
  const initialTags = state.activeTag ? [state.activeTag] : [];
  const note = {
    id,
    title: "",
    content: "",
    tags: initialTags.slice(),
    strokes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    userId: state.user.id,
    isRemote: false
  };
  state.notes.unshift(note);
  state.activeNoteId = id;
  persistState();
  renderEditor(note);
  if (initialTags.length) {
    initialTags.forEach(tag => {
      ensureTagExists(tag);
      const bubble = createInlineTagBubble(tag);
      dom.richEditor.appendChild(bubble);
      dom.richEditor.appendChild(document.createTextNode(" "));
    });
    syncEditorTags();
  }
  setView("editor");
  markDirty();
};

const handleNavigationBack = async target => {
  if (state.isDirty) {
    try {
      await saveCurrentNote({ silent: true });
    } catch (error) {
      console.warn("Aborted navigation due to pending changes", error);
      return;
    }
  }
  if (target === "tags") {
    state.activeTag = null;
    setView("tags");
    renderTagCloud();
  } else if (target === "list") {
    setView("list");
    renderListView();
  } else {
    setView("tags");
  }
};

const handleEditorInput = event => {
  if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
    markDirty();
    syncEditorTags();
    updateWordCount();
    return;
  }
  markDirty();
  updateWordCount();
  if (state.lastTriggerKey) {
    convertTagAtCaret();
    state.lastTriggerKey = null;
  } else {
    syncEditorTags();
  }
};

const handlePaste = event => {
  event.preventDefault();
  const text = event.clipboardData.getData("text/plain");
  document.execCommand("insertText", false, text);
};

const persistState = () => {
  const storageKey = storageKeyForUser();
  if (!storageKey) return;
  const payload = {
    version: STORAGE_VERSION,
    notes: state.notes,
    tags: Array.from(state.tagLibrary.values())
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist local state", error);
  }
};

const loadStateFromStorage = () => {
  const storageKey = storageKeyForUser();
  if (!storageKey) return false;
  let hadLocalData = true;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) throw new Error("no storage");
    const parsed = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.notes)) {
      throw new Error("incompatible");
    }
    state.notes = parsed.notes.map(normalizeLocalNote);
    state.tagLibrary = new Map();
    if (Array.isArray(parsed.tags)) {
      parsed.tags.forEach(entry => {
        if (entry?.name) {
          state.tagLibrary.set(entry.name, {
            name: entry.name,
            createdAt: entry.createdAt || Date.now()
          });
        }
      });
    }
    state.defaultsSeeded = true;
  } catch (error) {
    hadLocalData = false;
    state.notes = [
      normalizeLocalNote({
        id: generateId(),
        title: "Quick Start",
        content: plainToHtmlWithTags(defaultPlain),
        tags: ["灵感速记", "手写草稿"],
        strokes: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    ];
    state.tagLibrary = new Map();
    state.defaultsSeeded = false;
  }
  ensureTagLibrarySeeded();
  return hadLocalData;
};

const loadState = async () => {
  if (!state.user || state.isLoadingNotes) return;
  state.isLoadingNotes = true;

  if (dom.syncStatus) {
    dom.syncStatus.textContent = "Syncing...";
  }
  try {
    const notes = await api.listNotes();
    if (notes.length) {
      state.notes = notes;
      state.tagLibrary = new Map();
      state.defaultsSeeded = false;
      ensureTagLibrarySeeded();
      persistState();
      if (dom.syncStatus) {
        dom.syncStatus.textContent = "Synced";
      }
      return;
    }
    const hadLocal = loadStateFromStorage();
    if (!hadLocal) {
      persistState();
    }
    if (dom.syncStatus) {
      dom.syncStatus.textContent = hadLocal ? "Local draft" : "Sample ready";
    }
  } catch (error) {
    console.warn("Failed to load notes from API", error);
    const hadLocal = loadStateFromStorage();
    if (!hadLocal) {
      persistState();
    }
    if (dom.syncStatus) {
      dom.syncStatus.textContent = "Sync failed";
    }
  } finally {
    state.isLoadingNotes = false;
  }
};

const setupModeToggle = () => {
  dom.modeTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      dom.modeTabs.forEach(button => button.classList.remove("active"));
      tab.classList.add("active");
      state.editorMode = tab.dataset.mode;
      dom.handwritePanel.classList.toggle("visible", state.editorMode === "handwrite");
    });
  });
};

let canvasContext;
const pointer = {
  drawing: false,
  currentStroke: null
};

const resizeCanvas = () => {
  if (!dom.inkCanvas) return;
  const ratio = window.devicePixelRatio || 1;
  const rect = dom.inkCanvas.getBoundingClientRect();
  dom.inkCanvas.width = rect.width * ratio;
  dom.inkCanvas.height = rect.height * ratio;
  canvasContext.scale(ratio, ratio);
  redrawCanvas();
};

const redrawCanvas = () => {
  if (!canvasContext) return;
  canvasContext.clearRect(0, 0, dom.inkCanvas.width, dom.inkCanvas.height);
  state.strokes.forEach(stroke => {
    canvasContext.lineWidth = stroke.size;
    canvasContext.lineJoin = "round";
    canvasContext.lineCap = "round";
    canvasContext.strokeStyle = "#1f2430";
    canvasContext.beginPath();
    stroke.points.forEach((point, index) => {
      if (!index) {
        canvasContext.moveTo(point.x, point.y);
      } else {
        canvasContext.lineTo(point.x, point.y);
      }
    });
    canvasContext.stroke();
  });
};

const pointerPosition = event => {
  const rect = dom.inkCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
};

const startStroke = event => {
  pointer.drawing = true;
  pointer.currentStroke = {
    size: Number(dom.penSize.value),
    points: []
  };
  state.strokes.push(pointer.currentStroke);
  addPoint(event);
};

const addPoint = event => {
  if (!pointer.drawing) return;
  const point = pointerPosition(event);
  pointer.currentStroke.points.push(point);
  redrawCanvas();
  markDirty();
};

const endStroke = () => {
  pointer.drawing = false;
  pointer.currentStroke = null;
};

const setupCanvas = () => {
  if (!dom.inkCanvas) return;
  canvasContext = dom.inkCanvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  dom.inkCanvas.addEventListener("pointerdown", event => {
    event.preventDefault();
    dom.inkCanvas.setPointerCapture(event.pointerId);
    startStroke(event);
  });
  dom.inkCanvas.addEventListener("pointermove", addPoint);
  dom.inkCanvas.addEventListener("pointerup", endStroke);
  dom.inkCanvas.addEventListener("pointerleave", endStroke);

  document.querySelector('[data-action="clear"]').addEventListener("click", () => {
    state.strokes = [];
    redrawCanvas();
    markDirty();
  });

  document.querySelector('[data-action="undo"]').addEventListener("click", () => {
    state.strokes.pop();
    redrawCanvas();
    markDirty();
  });
};

const bindEvents = () => {
  dom.tagContextRename?.addEventListener("click", () => {
    const tag = state.tagMenu.tag;
    hideTagContextMenu();
    if (tag) renameTagEverywhere(tag);
  });

  dom.tagContextDelete?.addEventListener("click", () => {
    const tag = state.tagMenu.tag;
    hideTagContextMenu();
    if (tag) deleteTagEverywhere(tag);
  });

  document.addEventListener("click", event => {
    if (
      state.tagMenu.visible &&
      dom.tagContextMenu &&
      !dom.tagContextMenu.contains(event.target)
    ) {
      hideTagContextMenu();
    }
  });

  document.addEventListener("contextmenu", event => {
    if (!state.tagMenu.visible || !dom.tagContextMenu) return;
    if (dom.tagContextMenu.contains(event.target)) return;
    if (event.target.closest && event.target.closest(".tag-chip")) return;
    hideTagContextMenu();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      hideTagContextMenu();
    }
  });

  window.addEventListener("resize", hideTagContextMenu);
  window.addEventListener("scroll", hideTagContextMenu, true);

  dom.loginForm?.addEventListener("submit", handleLoginSubmit);
  dom.registerForm?.addEventListener("submit", handleRegisterSubmit);
  dom.authSwitchButton?.addEventListener("click", handleAuthSwitch);
  dom.logoutButton?.addEventListener("click", handleLogout);
  dom.fab.addEventListener("click", createNewNote);

  dom.backHero.addEventListener("click", () => handleNavigationBack("tags"));
  document
    .querySelectorAll(".view .back-button.inline")
    .forEach(button =>
      button.addEventListener("click", () => handleNavigationBack(button.dataset.target))
    );

  dom.deleteNoteButton.addEventListener("click", () => {
    deleteCurrentNote();
  });

  dom.saveButton.addEventListener("click", async () => {
    try {
      await saveCurrentNote();
    } catch (error) {
      console.warn("Manual save failed", error);
    }
  });

  dom.noteTitleInput.addEventListener("input", markDirty);

  dom.richEditor.addEventListener("keydown", event => {
    if ([" ", "Enter", "Tab", ",", ";"].includes(event.key)) {
      state.lastTriggerKey = event.key;
    } else {
      state.lastTriggerKey = null;
    }
  });

  dom.richEditor.addEventListener("input", handleEditorInput);
  dom.richEditor.addEventListener("paste", handlePaste);

  dom.tagSearch.addEventListener("input", event => {
    state.tagSearchTerm = event.target.value;
    renderTagCloud();
  });

  dom.listFilterChips.forEach(chip =>
    chip.addEventListener("click", () => {
      state.listFilter = chip.dataset.sort;
      renderListView();
    })
  );

  setupModeToggle();
  setupCanvas();
};

const init = async () => {
  bindEvents();
  ensureTagLibrarySeeded();
  setView("tags");
  try {
    await initializeAuth();
  } catch (error) {
    console.error("Failed to initialize auth", error);
    setAuthError("Something went wrong while initializing login. Please refresh and try again.");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  init().catch(error => {
    console.error("Failed to initialize app", error);
  });
});
