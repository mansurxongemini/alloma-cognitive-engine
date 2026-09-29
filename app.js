// Helper to safely read env variables without crashing in non-Vite environments
const getEnv = (key, fallback = "") => {
  try {
    if (typeof import.meta !== "undefined" && import.meta && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}
  try {
    if (typeof window !== "undefined" && window.process && window.process.env && window.process.env[key]) {
      return window.process.env[key];
    }
  } catch (e) {}
  return fallback;
};

const CONFIG = {
  SUPABASE_URL: 'https://kkxkrtvthipfamssdcjr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtreGtydHZ0aGlwZmFtc3NkY2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNTcwMDQsImV4cCI6MjA5OTkzMzAwNH0.x6_QPSlFiDZ04jE8z5NMu_67U0kpxihXgdIwyPlIGVE',
  OPENROUTER_API_KEY: getEnv('VITE_OPENROUTER_API_KEY', ''),
  OPENROUTER_MODEL: getEnv("VITE_OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"),
  EMBEDDING_MODEL: "nvidia/llama-nemotron-embed-vl-1b-v2:free"
};

// ==================== SUPABASE CLIENT & GLOBAL STATE ====================
let supabase = null;
let currentUser = null;
let tags = [];
let nodes = [];
let syllabus = [];
let uploadedSources = [];
let realtimeChannel = null;

let activeTagIds = []; // Array of tag IDs selected for filtering directory
let activeNodeId = null; // Active knowledge node being viewed
let activeSyllabusId = null; // Active syllabus item being focused
let editingNodeId = null; // Node currently being edited in form
let currentView = 'form'; // 'form' | 'syllabus' | 'node' | 'chat' | 'settings'

// Multi-select state variables
let formSelectedTagIds = new Set();
let syllabusSelectedTagIds = new Set();

// Stopwatch Timer State
let timerInterval = null;
let elapsedSeconds = 0;
let isTimerRunning = false;

// Active Recall State
let isRecallModeActive = false;

// User-created custom folders (stored in localStorage)
let userFolders = JSON.parse(localStorage.getItem('userFolders') || '[]');

// ==================== DOM ELEMENT REFERENCES ====================
const loginOverlay = document.getElementById("login-overlay");
const btnLogin = document.getElementById("btn-login");
const loginError = document.getElementById("login-error");
const appContainer = document.getElementById("app-container");

// Navigation Sidebar Elements
const navNewEntry = document.getElementById("nav-new-entry");
const navSyllabusPlanner = document.getElementById("nav-syllabus-planner");
const navAnalyticsChat = document.getElementById("nav-analytics-chat");
const sidebarProfile = document.getElementById("sidebar-profile");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");

// Tag Directory & Sidebar Elements
const tagCloudContainer = document.getElementById("tag-cloud-container");
const btnClearFilters = document.getElementById("btn-clear-filters");
const nodeDirectoryContainer = document.getElementById("node-directory");
const btnToggleNewTag = document.getElementById("btn-toggle-new-tag");
const inlineTagForm = document.getElementById("inline-tag-form");
const inputTagName = document.getElementById("input-tag-name");
const btnSaveTag = document.getElementById("btn-save-tag");
const btnCancelTag = document.getElementById("btn-cancel-tag");

// Theme Toggle Button
const btnThemeToggle = document.getElementById("btn-theme-toggle");
const themeIconLight = document.getElementById("theme-icon-light");
const themeIconDark = document.getElementById("theme-icon-dark");

// Form Station (View 1) Elements
const viewForm = document.getElementById("view-form");
const metricsForm = document.getElementById("metrics-form");
const inputDate = document.getElementById("input-date");
const inputDuration = document.getElementById("input-duration");
const inputRange = document.getElementById("input-range");
const inputContradiction = document.getElementById("input-contradiction");
const scratchpadEditor = document.getElementById("scratchpad-editor");
const btnScratchpadClear = document.getElementById("btn-scratchpad-clear");
const btnScratchpadLoad = document.getElementById("btn-scratchpad-load");
const formTagSelection = document.getElementById("form-tag-selection");

// Stopwatch Timer DOM Elements
const timerDisplay = document.getElementById("timer-display");
const timerDot = document.getElementById("timer-dot");
const btnTimerToggle = document.getElementById("btn-timer-toggle");
const btnTimerReset = document.getElementById("btn-timer-reset");
const btnTimerCommit = document.getElementById("btn-timer-commit");

// Syllabus Planner (View 2) Elements
const viewSyllabus = document.getElementById("view-syllabus");
const syllabusForm = document.getElementById("syllabus-form");
const inputSyllabusTitle = document.getElementById("input-syllabus-title");
const syllabusList = document.getElementById("syllabus-list");
const syllabusActiveNotifier = document.getElementById("syllabus-active-notifier");
const activeSyllabusName = document.getElementById("active-syllabus-name");
const btnUnlinkSyllabus = document.getElementById("btn-unlink-syllabus");

// Active Node Viewer (View 3) Elements
const viewNode = document.getElementById("view-node");
const nodeTitle = document.getElementById("node-title");
const nodeDate = document.getElementById("node-date");
const nodeDuration = document.getElementById("node-duration");
const nodeRange = document.getElementById("node-range");
const nodeTagsList = document.getElementById("node-tags-list");
const nodeContradiction = document.getElementById("node-contradiction");
const nodeAiAnalysis = document.getElementById("node-ai-analysis");
const btnToggleRecall = document.getElementById("btn-toggle-recall");
const btnExportNode = document.getElementById("btn-export-node");
const btnDeleteNode = document.getElementById("btn-delete-node");

// Historic Reflection Chat (View 4) Elements
const viewChat = document.getElementById("view-chat");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

// Settings (View 5) Elements
const viewSettings = document.getElementById("view-settings");
const settingsAvatar = document.getElementById("settings-avatar");
const settingsName = document.getElementById("settings-name");
const settingsEmail = document.getElementById("settings-email");
const settingsUid = document.getElementById("settings-uid");
const inputSettingsKey = document.getElementById("input-settings-key");
const inputSettingsModel = document.getElementById("input-settings-model");
const btnSaveSettings = document.getElementById("btn-save-settings");
const btnSettingsLogout = document.getElementById("btn-settings-logout");
const settingsStatusMessage = document.getElementById("settings-status-message");

// Asynchronous Safeguards (Loading Spinner & Confirmation Modal)
const workspaceLoading = document.getElementById("workspace-loading");
const loadingText = document.getElementById("loading-text");
const confirmModal = document.getElementById("confirm-modal");

// ==================== APP INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", () => {
  // Load local settings overrides
  let storedKey = localStorage.getItem("openrouter_api_key");
  let storedModel = localStorage.getItem("openrouter_model");
  let storedSupaUrl = localStorage.getItem("supabase_url");
  let storedSupaKey = localStorage.getItem("supabase_anon_key");

  if (storedKey) CONFIG.OPENROUTER_API_KEY = storedKey;
  if (storedModel) CONFIG.OPENROUTER_MODEL = storedModel;
  if (storedSupaUrl) CONFIG.SUPABASE_URL = storedSupaUrl;
  if (storedSupaKey) CONFIG.SUPABASE_ANON_KEY = storedSupaKey;

  initTheme();
  setupNavigators();
  setupTagFormToggle();
  setupSettingsHandlers();
  setupRecallMode();
  setupDragDropIngestion();
  setupScratchpad();
  setupSyllabusActions();
  setupTimer();

  if (btnClearFilters) btnClearFilters.addEventListener("click", clearFilters);

  // Initialize Supabase Client
  const windowSupabase = window.supabase?.createClient;
  if (windowSupabase && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    try {
      supabase = windowSupabase(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
      initSupabaseAuth();
    } catch (err) {
      console.error("Supabase Client Init Error:", err);
      showConfigRequiredError(err.message);
    }
  } else {
    // Attempt dynamic ESM import fallback
    import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(({ createClient }) => {
        if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
          supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
          initSupabaseAuth();
        } else {
          showConfigRequiredError();
        }
      })
      .catch(err => {
        console.error("Supabase ESM import failed:", err);
        showConfigRequiredError(err.message);
      });
  }
});

function showConfigRequiredError(errMsg = "") {
  if (!loginError) return;
  loginError.classList.remove("hidden");
  loginError.innerHTML = `
    <strong>Configuration Required:</strong><br>
    Please configure <code>CONFIG.SUPABASE_URL</code> and <code>CONFIG.SUPABASE_ANON_KEY</code> inside <code>app.js</code> or update environment variables.
    ${errMsg ? `<br><span class="text-xs text-red-400">${errMsg}</span>` : ''}
  `;
}

// ==================== THEME CONTROLLER ====================
function initTheme() {
  if (!btnThemeToggle || !themeIconLight || !themeIconDark) return;

  const currentTheme = localStorage.getItem("notion_theme") || "light";
  if (currentTheme === "dark") {
    document.documentElement.classList.add("theme-dark");
    document.body.classList.add("theme-dark");
    themeIconLight.classList.remove("hidden");
    themeIconDark.classList.add("hidden");
  } else {
    document.documentElement.classList.remove("theme-dark");
    document.body.classList.remove("theme-dark");
    themeIconLight.classList.add("hidden");
    themeIconDark.classList.remove("hidden");
  }

  btnThemeToggle.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("theme-dark");
    document.body.classList.toggle("theme-dark", isDark);
    
    if (isDark) {
      localStorage.setItem("notion_theme", "dark");
      themeIconLight.classList.remove("hidden");
      themeIconDark.classList.add("hidden");
    } else {
      localStorage.setItem("notion_theme", "light");
      themeIconLight.classList.add("hidden");
      themeIconDark.classList.remove("hidden");
    }
  });
}

// ==================== AUTHENTICATION HANDLERS (SUPABASE AUTH) ====================
function initSupabaseAuth() {
  if (!supabase) return;

  // Check existing active session
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      handleAuthStateChanged(session.user);
    }
  });

  // Observe Auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      handleAuthStateChanged(session.user);
    } else {
      handleAuthStateChanged(null);
    }
  });
}

if (btnLogin) {
  btnLogin.addEventListener("click", async () => {
    if (loginError) loginError.classList.add("hidden");
    if (!supabase) {
      alert("Supabase Client is not initialized. Please verify configuration.");
      return;
    }

    try {
      showLoading("Google orqali tizimga kirilmoqda...");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error("Login failed:", error);
      hideLoading();
      if (loginError) {
        loginError.classList.remove("hidden");
        loginError.textContent = "Kirishda xatolik: " + error.message;
      }
    }
  });
}

if (btnSettingsLogout) {
  btnSettingsLogout.addEventListener("click", () => {
    confirmAction(
      "Sign Out",
      "Are you sure you want to log out of the Workspace?",
      async () => {
        if (supabase) await supabase.auth.signOut();
      }
    );
  });
}

function handleAuthStateChanged(user) {
  hideLoading();
  if (user) {
    currentUser = user;
    
    // Set up Profile Card
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || "https://picsum.photos/100";
    const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || "Tadqiqotchi";
    
    if (userAvatar) userAvatar.src = avatarUrl;
    if (userName) userName.textContent = name;
    
    // Set default date input value to today (local YYYY-MM-DD)
    const today = new Date().toLocaleDateString('sv');
    if (inputDate) inputDate.value = today;

    // Show app structure
    if (loginOverlay) {
      loginOverlay.classList.add("opacity-0", "pointer-events-none");
      setTimeout(() => loginOverlay.classList.add("hidden"), 500);
    }
    if (appContainer) appContainer.classList.remove("hidden");

    // Establish live PostgREST data fetching & Realtime synchronization
    subscribeToDatabase();
    switchView("form");
  } else {
    // Teardown state
    currentUser = null;
    tags = [];
    nodes = [];
    syllabus = [];
    activeTagIds = [];
    activeNodeId = null;
    
    if (realtimeChannel && supabase) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    if (appContainer) appContainer.classList.add("hidden");
    if (loginOverlay) {
      loginOverlay.classList.remove("hidden", "opacity-0", "pointer-events-none");
    }
  }
}

// ==================== DATABASE OPERATIONS & REAL-TIME SYNC ====================
async function subscribeToDatabase() {
  if (!supabase || !currentUser) return;

  // Initial Fetch for all collections
  await fetchAllUserData();

  // Clean up any existing channel
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }

  // Subscribe to Supabase Postgres Changes
  realtimeChannel = supabase.channel('public:db_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes', filter: `user_id=eq.${currentUser.id}` }, () => {
      fetchNodes();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'syllabus', filter: `user_id=eq.${currentUser.id}` }, () => {
      fetchSyllabus();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: `user_id=eq.${currentUser.id}` }, () => {
      fetchTags();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sources', filter: `user_id=eq.${currentUser.id}` }, () => {
      fetchSources();
    })
    .subscribe();
}

async function fetchAllUserData() {
  await Promise.all([fetchTags(), fetchNodes(), fetchSyllabus(), fetchSources()]);
}

async function fetchTags() {
  if (!supabase || !currentUser) return;
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Fetch tags error:", error);
    return;
  }

  tags = (data || []).map(t => ({
    id: t.id,
    name: t.name,
    userId: t.user_id,
    createdAt: t.created_at
  }));

  renderTags();
  renderFormTags();
}

async function fetchNodes() {
  if (!supabase || !currentUser) return;
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('date', { ascending: false });

  if (error) {
    console.error("Fetch nodes error:", error);
    return;
  }

  nodes = (data || []).map(r => ({
    id: r.id,
    userId: r.user_id,
    tagIds: r.tag_ids || [],
    customFolder: r.custom_folder || null,
    aiAnalysis: r.ai_analysis || "",
    obsidianContent: r.obsidian_content || "",
    sm2: r.sm2 || null,
    createdAt: r.created_at,
    rawFormFields: {
      date: r.date || "",
      focusDuration: r.focus_duration || 0,
      studyRange: r.study_range || "",
      contradiction: r.contradiction || "",
      scratchpadContent: ""
    }
  }));

  renderNodeDirectory();
  if (activeNodeId) selectNode(activeNodeId);
}

async function fetchSyllabus() {
  if (!supabase || !currentUser) return;
  const { data, error } = await supabase
    .from('syllabus')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Fetch syllabus error:", error);
    return;
  }

  syllabus = (data || []).map(s => ({
    id: s.id,
    title: s.title,
    status: s.status,
    userId: s.user_id,
    createdAt: s.created_at
  }));

  renderSyllabusList();
}

async function fetchSources() {
  if (!supabase || !currentUser) return;
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Fetch sources error:", error);
    return;
  }

  uploadedSources = (data || []).map(src => ({
    id: src.id,
    fileName: src.filename,
    pageCount: src.page_count || 0,
    chunkCount: src.chunk_count || 0,
    status: src.status,
    errorMessage: src.source_error_message
  }));

  renderUploadedSources();
}

// ==================== WORKSPACE NAVIGATION ====================
function setupNavigators() {
  if (navNewEntry) navNewEntry.addEventListener("click", () => switchView("form"));
  if (navSyllabusPlanner) navSyllabusPlanner.addEventListener("click", () => switchView("syllabus"));
  if (navAnalyticsChat) navAnalyticsChat.addEventListener("click", () => switchView("chat"));
  if (sidebarProfile) sidebarProfile.addEventListener("click", () => switchView("settings"));

  const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
  const mainSidebar = document.getElementById("main-sidebar");
  if (btnToggleSidebar && mainSidebar) {
    btnToggleSidebar.addEventListener("click", (e) => {
      e.stopPropagation();
      const isCollapsed = mainSidebar.classList.toggle("sidebar-collapsed");
      mainSidebar.classList.toggle("w-16", isCollapsed);
      mainSidebar.classList.toggle("w-72", !isCollapsed);

      // Hide all text labels
      document.querySelectorAll(".sidebar-label").forEach(el => {
        el.classList.toggle("hidden", isCollapsed);
      });

      // Hide directory section wrapper
      const dirWrapper = document.getElementById("sidebar-directory-wrapper");
      if (dirWrapper) dirWrapper.classList.toggle("hidden", isCollapsed);

      // Compact nav buttons
      const navBtns = [navNewEntry, navSyllabusPlanner, navAnalyticsChat];
      navBtns.forEach(btn => {
        if (!btn) return;
        const span = btn.querySelector("span");
        if (span) span.classList.toggle("hidden", isCollapsed);
        btn.classList.toggle("justify-center", isCollapsed);
        btn.classList.toggle("px-3.5", !isCollapsed);
        btn.classList.toggle("px-0", isCollapsed);
        btn.classList.toggle("py-2.5", !isCollapsed);
        btn.classList.toggle("py-3", isCollapsed);
      });

      // Compact profile banner
      const profileBanner = document.getElementById("sidebar-profile");
      if (profileBanner) {
        const profileLabel = profileBanner.querySelector(".sidebar-label");
        if (profileLabel) profileLabel.classList.toggle("hidden", isCollapsed);
        profileBanner.classList.toggle("justify-center", isCollapsed);
      }
    });
  }
}

function switchView(viewName) {
  currentView = viewName;
  
  const navItems = [navNewEntry, navSyllabusPlanner, navAnalyticsChat];
  navItems.forEach(nav => {
    if (!nav) return;
    nav.classList.remove("bg-gradient-to-r", "from-blue-600", "via-purple-600", "to-pink-500", "text-white", "shadow-md", "shadow-purple-500/20", "font-bold");
    nav.classList.add("text-slate-600", "hover:text-purple-700", "hover:bg-purple-50", "border-transparent");
  });

  if (viewForm) viewForm.classList.add("hidden");
  if (viewSyllabus) viewSyllabus.classList.add("hidden");
  if (viewNode) viewNode.classList.add("hidden");
  if (viewChat) viewChat.classList.add("hidden");
  if (viewSettings) viewSettings.classList.add("hidden");

  let activeNav = null;
  let targetView = null;

  if (viewName === "form") {
    if (viewForm) viewForm.classList.remove("hidden");
    activeNav = navNewEntry;
    targetView = viewForm;
  } else if (viewName === "syllabus") {
    if (viewSyllabus) viewSyllabus.classList.remove("hidden");
    activeNav = navSyllabusPlanner;
    targetView = viewSyllabus;
  } else if (viewName === "node") {
    if (viewNode) viewNode.classList.remove("hidden");
    targetView = viewNode;
  } else if (viewName === "chat") {
    if (viewChat) viewChat.classList.remove("hidden");
    activeNav = navAnalyticsChat;
    targetView = viewChat;
  } else if (viewName === "settings") {
    if (viewSettings) viewSettings.classList.remove("hidden");
    targetView = viewSettings;
    if (currentUser) {
      const avatarUrl = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || "https://picsum.photos/100";
      const name = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || "Tadqiqotchi";
      if (settingsAvatar) settingsAvatar.src = avatarUrl;
      if (settingsName) settingsName.textContent = name;
      if (settingsEmail) settingsEmail.textContent = currentUser.email || "---";
      if (settingsUid) settingsUid.textContent = currentUser.id;
      if (inputSettingsKey) inputSettingsKey.value = CONFIG.OPENROUTER_API_KEY || "";
      if (inputSettingsModel) inputSettingsModel.value = CONFIG.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
    }
  }

  if (activeNav) {
    activeNav.classList.remove("text-slate-600", "hover:text-purple-700", "hover:bg-purple-50", "border-transparent");
    activeNav.classList.add("bg-gradient-to-r", "from-blue-600", "via-purple-600", "to-pink-500", "text-white", "shadow-md", "shadow-purple-500/20", "font-bold");
  }

  if (window.gsap && targetView) {
    gsap.fromTo(targetView, 
      { opacity: 0, y: 10 }, 
      { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
    );
  }
}

// ==================== TAG DIRECTORY ACTIONS ====================
function setupTagFormToggle() {
  if (btnToggleNewTag && inlineTagForm) {
    btnToggleNewTag.addEventListener("click", () => {
      inlineTagForm.classList.toggle("hidden");
      if (!inlineTagForm.classList.contains("hidden") && inputTagName) {
        inputTagName.focus();
      }
    });
  }

  if (btnCancelTag && inlineTagForm) {
    btnCancelTag.addEventListener("click", () => {
      inlineTagForm.classList.add("hidden");
      if (inputTagName) inputTagName.value = "";
    });
  }

  if (btnSaveTag) btnSaveTag.addEventListener("click", createTag);
  if (inputTagName) {
    inputTagName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") createTag();
      if (e.key === "Escape" && btnCancelTag) btnCancelTag.click();
    });
  }
}

function getTagStyles(tagName) {
  const colors = [
    { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
    { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
    { bg: '#ede9fe', text: '#5b21b6', border: '#ddd6fe' },
    { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' },
    { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
    { bg: '#ffedd5', text: '#9a3412', border: '#fed7aa' }
  ];
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

async function createTag() {
  const name = inputTagName.value.trim();
  if (!name) return;

  if (tags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    alert("Bu teg allaqachon mavjud.");
    return;
  }

  try {
    showLoading("Teg yaratilmoqda...");
    const { data, error } = await supabase
      .from('tags')
      .insert([{
        name: name,
        user_id: currentUser.id
      }])
      .select();

    if (error) throw error;
    
    inputTagName.value = "";
    if (inlineTagForm) inlineTagForm.classList.add("hidden");
    await fetchTags();
  } catch (error) {
    alert("Teg yaratishda xatolik: " + error.message);
  } finally {
    hideLoading();
  }
}

function renderTags() {
  if (!tagCloudContainer) return;
  if (tags.length === 0) {
    tagCloudContainer.innerHTML = `<span class="text-[10px] text-slate-400 italic font-mono p-1">Mavjud teglar yo'q.</span>`;
    return;
  }

  tagCloudContainer.innerHTML = "";

  tags.forEach(tag => {
    const isFiltered = activeTagIds.includes(tag.id);
    
    const tagBadge = document.createElement("span");
    tagBadge.className = `tag-badge ${isFiltered ? 'tag-badge-active' : ''}`;
    
    const usageCount = nodes.filter(n => n.tagIds && n.tagIds.includes(tag.id)).length;
    tagBadge.textContent = `#${tag.name} (${usageCount})`;
    
    const styles = getTagStyles(tag.name);
    if (isFiltered) {
      tagBadge.style.backgroundColor = '#a142f4';
      tagBadge.style.color = '#ffffff';
      tagBadge.style.borderColor = '#a142f4';
    } else {
      tagBadge.style.backgroundColor = styles.bg;
      tagBadge.style.color = styles.text;
      tagBadge.style.borderColor = styles.border;
    }
    
    tagBadge.addEventListener("click", () => toggleFilterTag(tag.id));
    tagCloudContainer.appendChild(tagBadge);
  });
}

function toggleFilterTag(tagId) {
  const index = activeTagIds.indexOf(tagId);
  if (index > -1) {
    activeTagIds.splice(index, 1);
  } else {
    activeTagIds.push(tagId);
  }

  if (activeTagIds.length > 0) {
    if (btnClearFilters) btnClearFilters.classList.remove("hidden");
  } else {
    if (btnClearFilters) btnClearFilters.classList.add("hidden");
  }

  renderTags();
  renderNodeDirectory();
}

function clearFilters() {
  activeTagIds = [];
  if (btnClearFilters) btnClearFilters.classList.add("hidden");
  renderTags();
  renderNodeDirectory();
}

// Helper: SM-2 Spaced Repetition SuperMemo Algorithm
function calculateSM2(q, prevInterval = 0, prevEF = 2.5, reviewCount = 0) {
  let nextEF = prevEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (nextEF < 1.3) nextEF = 1.3;

  let nextInterval = 1;
  if (q < 3) {
    nextInterval = 1;
    reviewCount = 0;
  } else {
    reviewCount += 1;
    if (reviewCount === 1) {
      nextInterval = 1;
    } else if (reviewCount === 2) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(prevInterval * nextEF);
    }
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + nextInterval);
  const nextReviewDateStr = nextDate.toISOString().split('T')[0];

  return {
    interval: nextInterval,
    easeFactor: Number(nextEF.toFixed(2)),
    reviewCount: reviewCount,
    nextReviewDate: nextReviewDateStr
  };
}

// Helper: Dynamic Folder Hierarchy & SM-2 Classifier with Drag & Drop customFolder Support
function groupNodesByFolder(nodesList) {
  const folders = {};
  const todayStr = new Date().toISOString().split('T')[0];

  // Pre-seed user-created empty folders so they always render
  userFolders.forEach(name => {
    if (!folders[name]) folders[name] = [];
  });

  nodesList.forEach(node => {
    // If explicit customFolder assigned via Drag & Drop
    if (node.customFolder) {
      if (!folders[node.customFolder]) {
        folders[node.customFolder] = [];
      }
      folders[node.customFolder].push(node);
      return;
    }

    // Check if node is due for SM-2 interval review
    if (node.sm2 && node.sm2.nextReviewDate && node.sm2.nextReviewDate <= todayStr) {
      if (!folders["📌 Bugungi Takrorlash (Due Review)"]) {
        folders["📌 Bugungi Takrorlash (Due Review)"] = [];
      }
      folders["📌 Bugungi Takrorlash (Due Review)"].push(node);
      return;
    }

    const range = (node.rawFormFields && node.rawFormFields.studyRange) ? node.rawFormFields.studyRange.trim() : "Umumiy Yozuvlar";
    
    let folderName = "Umumiy Yozuvlar";
    const match = range.match(/^([^\d:]+)/);
    if (match && match[1].trim().length >= 3) {
      folderName = match[1].trim();
    } else {
      folderName = range;
    }

    if (!folders[folderName]) {
      folders[folderName] = [];
    }
    folders[folderName].push(node);
  });

  return folders;
}

// ==================== EXPANDABLE FOLDER DIRECTORY & DRAG & DROP SYSTEM ====================
function renderNodeDirectory() {
  if (!nodeDirectoryContainer) return;

  let filteredNodes = nodes;
  if (activeTagIds.length > 0) {
    filteredNodes = nodes.filter(node => 
      node.tagIds && node.tagIds.some(id => activeTagIds.includes(id))
    );
  }

  if (filteredNodes.length === 0 && userFolders.length === 0) {
    nodeDirectoryContainer.innerHTML = `
      <div class="text-slate-400 text-xs text-center py-6 italic font-mono bg-slate-50 rounded-xl border border-slate-200">
        ${activeTagIds.length > 0 ? 'Filtr bo\'yicha yozuvlar topilmadi.' : 'Saqlangan yozuvlar yo\'q.'}
      </div>
    `;
    return;
  }

  nodeDirectoryContainer.innerHTML = "";
  const groupedFolders = groupNodesByFolder(filteredNodes);

  Object.keys(groupedFolders).forEach(folderName => {
    const itemsInFolder = groupedFolders[folderName];
    const isDueFolder = folderName.includes("Bugungi Takrorlash");

    const folderContainer = document.createElement("div");
    folderContainer.className = "space-y-1";

    // Folder Header Component with Drag & Drop Drop Target Handlers
    const folderHeader = document.createElement("div");
    folderHeader.className = `flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer user-select-none ${
      isDueFolder 
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 font-bold' 
        : 'bg-white border-slate-200/80 hover:border-purple-300 text-slate-700'
    }`;
    
    folderHeader.innerHTML = `
      <div class="flex items-center space-x-2 truncate">
        <span class="transform transition-transform text-[10px] text-slate-400">▼</span>
        <span class="text-xs ${isDueFolder ? 'text-amber-500' : 'text-purple-600'}">📁</span>
        <span class="text-xs font-semibold truncate font-sans">${folderName}</span>
      </div>
      <span class="text-[10px] px-2 py-0.5 rounded-full font-mono ${
        isDueFolder ? 'bg-amber-500 text-white font-bold' : 'bg-slate-100 text-slate-500'
      }">${itemsInFolder.length}</span>
    `;

    // Sub-items container
    const subItemsContainer = document.createElement("div");
    subItemsContainer.className = "pl-3 space-y-1 mt-1 transition-all";

    // Toggle collapse/expand
    let isExpanded = true;
    folderHeader.addEventListener("click", (e) => {
      if (e.target.closest('.drag-indicator')) return;
      isExpanded = !isExpanded;
      subItemsContainer.classList.toggle("hidden", !isExpanded);
      const arrow = folderHeader.querySelector("span");
      if (arrow) arrow.style.transform = isExpanded ? "rotate(0deg)" : "rotate(-90deg)";
    });

    // Drag Over & Drop listeners on Folder Header (Async Supabase custom_folder update)
    folderHeader.addEventListener("dragover", (e) => {
      e.preventDefault();
      folderHeader.classList.add("border-purple-500", "bg-purple-50");
    });

    folderHeader.addEventListener("dragleave", () => {
      folderHeader.classList.remove("border-purple-500", "bg-purple-50");
    });

    folderHeader.addEventListener("drop", async (e) => {
      e.preventDefault();
      folderHeader.classList.remove("border-purple-500", "bg-purple-50");
      const draggedNodeId = e.dataTransfer.getData("text/plain");
      if (!draggedNodeId) return;

      const targetNode = nodes.find(n => n.id === draggedNodeId);
      if (targetNode) {
        targetNode.customFolder = folderName;
        renderNodeDirectory();

        // Update database asynchronously in Supabase
        if (supabase) {
          const { error } = await supabase
            .from('nodes')
            .update({ custom_folder: folderName })
            .eq('id', draggedNodeId);

          if (error) {
            console.error("Update custom_folder failed:", error);
          }
        }
      }
    });

    // Render nodes inside folder
    itemsInFolder.forEach(node => {
      const isSelected = activeNodeId === node.id;
      const f = node.rawFormFields;

      const itemCard = document.createElement("div");
      itemCard.className = `p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
        isSelected 
          ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20' 
          : 'bg-white border-slate-200/70 hover:border-purple-200 hover:bg-slate-50/80 text-slate-800'
      }`;
      itemCard.setAttribute("draggable", "true");

      itemCard.innerHTML = `
        <div class="flex items-center space-x-2 truncate min-w-0">
          <span class="text-xs ${isSelected ? 'text-purple-200' : 'text-slate-400'}">📄</span>
          <div class="flex flex-col truncate">
            <span class="text-xs font-semibold truncate font-sans">${f.studyRange}</span>
            <span class="text-[9px] ${isSelected ? 'text-purple-200' : 'text-slate-400'} font-mono truncate">"${f.contradiction.slice(0, 30)}..."</span>
          </div>
        </div>
        <div class="flex items-center space-x-1 flex-shrink-0">
          <span class="text-[9px] ${isSelected ? 'text-purple-200' : 'text-slate-400'} font-mono">${f.date}</span>
        </div>
      `;

      itemCard.addEventListener("click", () => {
        selectNode(node.id);
        switchView("node");
      });

      // Drag Start Handler
      itemCard.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", node.id);
        itemCard.classList.add("opacity-50");
      });

      itemCard.addEventListener("dragend", () => {
        itemCard.classList.remove("opacity-50");
      });

      subItemsContainer.appendChild(itemCard);
    });

    folderContainer.appendChild(folderHeader);
    folderContainer.appendChild(subItemsContainer);
    nodeDirectoryContainer.appendChild(folderContainer);
  });
}

// ==================== SCRATCHPAD HANDLERS ====================
function setupScratchpad() {
  if (btnScratchpadClear) {
    btnScratchpadClear.addEventListener("click", () => {
      if (scratchpadEditor) scratchpadEditor.value = "";
    });
  }

  if (btnScratchpadLoad) {
    btnScratchpadLoad.addEventListener("click", () => {
      if (scratchpadEditor) {
        scratchpadEditor.value = `# SAMPLE CASE BRIEF CONSTITUTIONAL LAW

**Case**: Gibbons v. Ogden, 22 U.S. 1 (1824)
**Facts**: New York granted an exclusive license to Aaron Ogden to operate steamboats between NY and NJ. Thomas Gibbons operated steamboats in the same waters under a federal coasting license.
**Issue**: Does the Congressional power to regulate interstate commerce (Art. 1, Sec. 8, Cl. 3) override a state-granted monopoly within state waters?

## Logical Contradiction / Bottleneck
State argument claims exclusive sovereignty over commercial navigation within state boundaries, asserting that "commerce" only means "buying and selling". Federal argument claims "commerce" includes "intercourse and navigation" and the Supremacy clause invalidates state monopolies.

## Socratic Query Trigger
Verify if the NY monopoly constitutes a protectionist measure that disrupts the unified national market planned by the framers.`;
      }
    });
  }
}

// ==================== FORM INPUT METRICS ACTIONS ====================
function renderFormTags() {
  if (!formTagSelection) return;
  if (tags.length === 0) {
    formTagSelection.innerHTML = `<span class="text-[10px] text-slate-400 italic font-mono p-1">Yon paneldagi '+' orqali birinchi tegni yarating.</span>`;
    return;
  }

  formTagSelection.innerHTML = "";

  tags.forEach(tag => {
    const isSelected = formSelectedTagIds.has(tag.id);

    const selectionBadge = document.createElement("span");
    selectionBadge.className = `form-tag-badge ${isSelected ? 'form-tag-badge-selected' : ''}`;
    selectionBadge.textContent = `#${tag.name}`;
    
    const styles = getTagStyles(tag.name);
    if (isSelected) {
      selectionBadge.style.backgroundColor = '#a142f4';
      selectionBadge.style.color = '#ffffff';
      selectionBadge.style.borderColor = '#a142f4';
    } else {
      selectionBadge.style.backgroundColor = styles.bg;
      selectionBadge.style.color = styles.text;
      selectionBadge.style.borderColor = styles.border;
    }

    selectionBadge.addEventListener("click", () => {
      if (formSelectedTagIds.has(tag.id)) {
        formSelectedTagIds.delete(tag.id);
      } else {
        formSelectedTagIds.add(tag.id);
      }
      renderFormTags();
    });

    formTagSelection.appendChild(selectionBadge);
  });
}

if (metricsForm) {
  metricsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentUser || !supabase) return;

    const selectedTagsArray = Array.from(formSelectedTagIds);
    
    if (selectedTagsArray.length === 0) {
      alert("Iltimos, ushbu yozuvga kamida bitta tegni biriktiring.");
      return;
    }

    const formData = {
      date: inputDate.value,
      focusDuration: parseInt(inputDuration.value, 10) || 0,
      studyRange: inputRange.value.trim(),
      contradiction: inputContradiction.value.trim(),
      scratchpadContent: scratchpadEditor ? scratchpadEditor.value.trim() : ""
    };

    try {
      showLoading("OpenRouter AI orqali mantiqiy audit bajarilmoqda...");
      const aiAnalysis = await fetchOpenRouterAnalysis(formData);
      
      if (editingNodeId) {
        showLoading("Yozuv Supabase'da yangilanmoqda...");
        const { error } = await supabase
          .from('nodes')
          .update({
            tag_ids: selectedTagsArray,
            study_range: formData.studyRange,
            date: formData.date,
            focus_duration: formData.focusDuration,
            contradiction: formData.contradiction,
            ai_analysis: aiAnalysis
          })
          .eq('id', editingNodeId);

        if (error) throw error;
        editingNodeId = null;
      } else {
        showLoading("Seans metrikasi Supabase'ga saqlanmoqda...");
        const { error } = await supabase
          .from('nodes')
          .insert([{
            user_id: currentUser.id,
            tag_ids: selectedTagsArray,
            study_range: formData.studyRange,
            date: formData.date,
            focus_duration: formData.focusDuration,
            contradiction: formData.contradiction,
            ai_analysis: aiAnalysis
          }]);

        if (error) throw error;
      }

      if (activeSyllabusId) {
        showLoading("O'quv dasturi maqsadi yangilanmoqda...");
        await supabase
          .from('syllabus')
          .update({ status: 'completed' })
          .eq('id', activeSyllabusId);
        unlinkSyllabusItem();
      }

      metricsForm.reset();
      formSelectedTagIds.clear();
      renderFormTags();
      
      if (inputDate) inputDate.value = new Date().toLocaleDateString('sv');
      
      const submitBtn = metricsForm.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.textContent = "Seans Metrikasini Saqlash";
      }

      alert("Seans metrikasi muvaffaqiyatli saqlandi va AI audit qilindi!");
      await fetchNodes();
    } catch (error) {
      console.error("Save failed:", error);
      alert("Saqlashda xatolik yuz berdi: " + error.message);
    } finally {
      hideLoading();
    }
  });
}

// ==================== OPENROUTER AI ENGINE & VECTOR RAG SEARCH ====================
async function fetchOpenRouterAnalysis(fields) {
  if (!CONFIG.OPENROUTER_API_KEY || CONFIG.OPENROUTER_API_KEY.trim() === "") {
    throw new Error("OpenRouter API key missing. Please configure it in System Settings.");
  }

  // Perform Vector Search on Student's Xulosa against Uploaded RAG Documents
  let RAGContextText = "";
  if (uploadedSources.length > 0) {
    try {
      showLoading("Vektor Bazadan (Supabase pgvector) eng mos manba parchalari qidirilmoqda...");
      const matchedPassages = await performVectorSearch(fields.contradiction, 3);
      if (matchedPassages.length > 0) {
        RAGContextText = matchedPassages.map((m, idx) => 
          `[MANBA PARCHASI ${idx+1} | ${m.fileName}, ${m.pageNum}-bet | Semantik Moslik: ${(m.score * 100).toFixed(0)}%]:\n${m.passage}`
        ).join("\n\n");
      }
    } catch (e) {
      console.warn("Vector Search execution note:", e);
    }
  }

  // Token-efficient Fallback Excerpt Extraction from Mutolaa Sandbox
  let sourceExcerpt = "";
  if (fields.scratchpadContent && fields.scratchpadContent.length > 0) {
    sourceExcerpt = fields.scratchpadContent.slice(0, 3000);
  }

  const systemPrompt = `Siz Google NotebookLM arxitekturasi kabi 100% Manba Ma'lumotiga Asoslangan (Grounded Intelligence) universal akademik tahlilchisiz va intellektual audit dvigatelsiz.
Vazifangiz: Talabaning yuklagan manba fayllari (muhandislik, tibbiyot, iqtisod, huquq, dasturlash yoki tarix) va o'zining yozgan <XULOSA> fikrini tahlil qilib, professional akademik audit berish.

QAT'IY UNIVERSAL STRUKTURA (Jadval va Markdown sarlavhalari bilan):
### 📌 1. Asosiy Tushunchalar & Faktlar
### 🧠 2. Mantiqiy Ziddiyat / Asosiy Muammo
### ⚙️ 3. Tamoyillar, Qoidalar & Formulalar
### 🔬 4. Amaliy Tatbiq & Misollar
### 🎯 5. Yakuniy Xulosa

QAT'IY QOIDALAR:
1. FAQAT TAQDIM ETILGAN VEKTOR MANBA PARCHALARIGA VA TALABA XULOSASIGA ASOSLANG. Tashqi ko'r-korona umumiy ma'lumot qoshmang.
2. Har bir fikr ostida manba betini ko'rsatuvchi pinpoint citation kiriting: [Manba: filename.pdf, p. X].
3. Javobingizni o'zbek tilida, akademik ravon va o'ta tartibli chiqaring.`;

  let userContent = `SANA: ${fields.date}
FOKUS DAVOMIYLIGI: ${fields.focusDuration} daqiqa
O'RGANILGAN MAVZU / MANBA: ${fields.studyRange}

TALABA XULOSASI:
"${fields.contradiction}"`;

  if (RAGContextText) {
    userContent += `\n\n==================== VEKTOR BAZADAN (RAG) TOPILGAN ENG MOS MANBA PARCHALARI ====\n${RAGContextText}\n================================================================================`;
  } else if (sourceExcerpt) {
    userContent += `\n\n==================== MUTOLAA SANDBOXI MATNI ====================\n${sourceExcerpt}\n================================================================================`;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
        "HTTP-Referer": window.location.origin || "http://localhost:5000",
        "X-Title": "Alloma AI Cognitive Logger"
      },
      body: JSON.stringify({
        model: CONFIG.OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenRouter Error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    } else {
      throw new Error("Malformed response format received from OpenRouter API.");
    }
  } catch (err) {
    console.error("AI node extraction failed:", err);
    throw err;
  }
}

// ==================== ACTIVE NODE VIEWER ====================
function selectNode(nodeId) {
  activeNodeId = nodeId;
  const node = nodes.find(n => n.id === nodeId);
  
  if (!node) return;

  if (nodeTitle) nodeTitle.textContent = node.rawFormFields.studyRange;
  if (nodeDate) nodeDate.textContent = node.rawFormFields.date;
  if (nodeDuration) nodeDuration.textContent = node.rawFormFields.focusDuration;
  if (nodeRange) nodeRange.textContent = node.rawFormFields.studyRange;
  if (nodeContradiction) nodeContradiction.textContent = node.rawFormFields.contradiction;
  
  if (nodeAiAnalysis) {
    nodeAiAnalysis.innerHTML = parseMarkdown(node.aiAnalysis);
  }

  // Populate Obsidian Editor
  const obsidianEditor = document.getElementById("node-obsidian-editor");
  if (obsidianEditor) {
    obsidianEditor.value = node.obsidianContent || "";
  }

  // Render Tags List
  if (nodeTagsList) {
    if (node.tagIds && node.tagIds.length > 0) {
      nodeTagsList.innerHTML = "";
      node.tagIds.forEach(id => {
        const tag = tags.find(t => t.id === id);
        if (tag) {
          const badge = document.createElement("span");
          badge.className = "node-meta-pill";
          badge.textContent = `#${tag.name}`;
          nodeTagsList.appendChild(badge);
        }
      });
    } else {
      nodeTagsList.innerHTML = `<span class="text-[11px] text-slate-300 italic">Teglar yo'q</span>`;
    }
  }

  // Update SM-2 Status Display
  const dueText = document.getElementById("sm2-next-due-text");
  if (dueText) {
    if (node.sm2 && node.sm2.nextReviewDate) {
      dueText.textContent = `Keyingi: ${node.sm2.nextReviewDate} (${node.sm2.interval} kundan so'ng)`;
    } else {
      dueText.textContent = `Keyingi: —`;
    }
  }

  renderNodeDirectory();
}

if (btnDeleteNode) {
  btnDeleteNode.addEventListener("click", () => {
    if (!activeNodeId) return;
    confirmAction(
      "Yozuvni o'chirish",
      "Ushbu bilim tugunini qayta tiklab bo'lmaydigan qilib o'chirishni tasdiqlaysizmi?",
      async () => {
        try {
          showLoading("Yozuv Supabase'dan o'chirilmoqda...");
          const { error } = await supabase
            .from('nodes')
            .delete()
            .eq('id', activeNodeId);

          if (error) throw error;

          activeNodeId = null;
          switchView("form");
          await fetchNodes();
        } catch (err) {
          alert("O'chirishda xatolik: " + err.message);
        } finally {
          hideLoading();
        }
      }
    );
  });
}

// ==================== SYLLABUS PLANNER HANDLERS ====================
function setupSyllabusActions() {
  if (syllabusForm) {
    syllabusForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = inputSyllabusTitle.value.trim();
      if (!title || !currentUser || !supabase) return;

      try {
        showLoading("Maqsad o'quv dasturiga qo'shilmoqda...");
        const { error } = await supabase
          .from('syllabus')
          .insert([{
            title: title,
            user_id: currentUser.id,
            status: 'pending'
          }]);

        if (error) throw error;
        inputSyllabusTitle.value = "";
        await fetchSyllabus();
      } catch (err) {
        alert("Maqsad qo'shishda xatolik: " + err.message);
      } finally {
        hideLoading();
      }
    });
  }

  if (btnUnlinkSyllabus) {
    btnUnlinkSyllabus.addEventListener("click", unlinkSyllabusItem);
  }
}

function renderSyllabusList() {
  if (!syllabusList) return;
  if (syllabus.length === 0) {
    syllabusList.innerHTML = `
      <div class="text-slate-400 text-xs text-center py-8 italic font-mono bg-slate-50/50 rounded-2xl border border-slate-100">
        O'quv dasturi bo'sh. Birinchi maqsadingizni kiriting.
      </div>
    `;
    return;
  }

  syllabusList.innerHTML = "";

  syllabus.forEach(item => {
    const isCompleted = item.status === 'completed';
    const isFocused = activeSyllabusId === item.id;

    const card = document.createElement("div");
    card.className = `p-4 rounded-2xl border transition-all flex items-center justify-between group ${
      isCompleted 
        ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
        : isFocused
          ? 'bg-purple-50 border-purple-300 text-purple-900 font-semibold shadow-sm'
          : 'bg-white border-slate-200/80 hover:border-purple-200 text-slate-800'
    }`;

    card.innerHTML = `
      <div class="flex items-center space-x-3 truncate">
        <button class="btn-toggle-syllabus w-5 h-5 rounded-md border flex items-center justify-center text-xs font-bold transition-all ${
          isCompleted ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 hover:border-purple-500'
        }">
          ${isCompleted ? '✓' : ''}
        </button>
        <span class="text-xs truncate font-sans">${item.title}</span>
      </div>
      <div class="flex items-center space-x-2">
        ${!isCompleted ? `
          <button class="btn-focus-syllabus px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
            isFocused ? 'bg-purple-600 text-white' : 'bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700'
          }">
            ${isFocused ? 'Fokusda' : 'Fokuslash'}
          </button>
        ` : ''}
        <button class="btn-delete-syllabus p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    `;

    const btnToggle = card.querySelector(".btn-toggle-syllabus");
    const btnFocus = card.querySelector(".btn-focus-syllabus");
    const btnDelete = card.querySelector(".btn-delete-syllabus");

    if (btnToggle) {
      btnToggle.addEventListener("click", async () => {
        try {
          const newStatus = isCompleted ? 'pending' : 'completed';
          await supabase
            .from('syllabus')
            .update({ status: newStatus })
            .eq('id', item.id);
          await fetchSyllabus();
        } catch (err) {
          alert("Status o'zgarmadi: " + err.message);
        }
      });
    }

    if (btnFocus) {
      btnFocus.addEventListener("click", () => {
        activeSyllabusId = item.id;
        if (activeSyllabusName) activeSyllabusName.textContent = item.title;
        if (syllabusActiveNotifier) syllabusActiveNotifier.classList.remove("hidden");
        if (inputRange) inputRange.value = item.title;
        switchView("form");
      });
    }

    if (btnDelete) {
      btnDelete.addEventListener("click", async () => {
        try {
          await supabase
            .from('syllabus')
            .delete()
            .eq('id', item.id);
          await fetchSyllabus();
        } catch (err) {
          alert("O'chirishda xatolik: " + err.message);
        }
      });
    }

    syllabusList.appendChild(card);
  });
}

function unlinkSyllabusItem() {
  activeSyllabusId = null;
  if (syllabusActiveNotifier) syllabusActiveNotifier.classList.add("hidden");
  if (inputRange) inputRange.value = "";
  formSelectedTagIds.clear();
  renderFormTags();
}

// ==================== MARKDOWN RENDERING SYSTEM ====================
function parseMarkdown(md) {
  if (!md) return '<p class="text-slate-400 italic font-mono">Tahlil ma\'lumoti mavjud emas.</p>';
  
  let html = md;
  if (window.marked && typeof window.marked.parse === "function") {
    try {
      html = window.marked.parse(md);
    } catch (e) {
      console.warn("Marked.js parse fallback:", e);
      html = md.replace(/\n/g, '<br>');
    }
  } else {
    html = md.replace(/\n/g, '<br>');
  }

  // Transform Pinpoint Citation tags [Manba: filename.pdf, p. X] into interactive pill badges
  html = html.replace(/\[Manba:\s*([^,]+),\s*(?:p\.|bet)?\s*(\d+)\]/gi, (match, filename, pageNum) => {
    return `<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 rounded-full font-mono text-[10px] font-bold shadow-2xs cursor-pointer hover:bg-purple-200 transition-all my-0.5" onclick="alert('📍 Manba Aniq Manzili: ${filename}, Bet: ${pageNum}')">📄 ${filename} (Bet: ${pageNum})</span>`;
  });

  // Make tables responsive by wrapping them in an overflow-x-auto container
  html = html.replace(/<table([\s\S]*?)<\/table>/gi, (match) => {
    return `<div class="overflow-x-auto w-full custom-scrollbar my-4 rounded-lg border border-slate-100" style="border-color:#eef0f4;"><table class="min-w-full" ${match.slice(6)}`;
  });

  return html;
}

// ==================== REFLECTION CHAT & HISTORICAL ENGINE ====================
if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const queryText = chatInput ? chatInput.value.trim() : "";
    if (!queryText) return;

    if (chatInput) chatInput.value = "";
    appendChatMessage("USER", queryText);

    try {
      showLoading("O'quv tarixingiz tahlil qilinmoqda...");
      const historyContext = buildHistoryContext();
      const aiReply = await queryOpenRouterChat(queryText, historyContext);
      appendChatMessage("ASSISTANT", aiReply);
    } catch (err) {
      console.error("Chat reflection error:", err);
      appendChatMessage("ASSISTANT", `⚠️ Xatolik yuz berdi: ${err.message}`);
    } finally {
      hideLoading();
    }
  });
}

function appendChatMessage(sender, text) {
  if (!chatMessages) return;

  const isUser = sender === "USER";
  const container = document.createElement("div");
  container.className = `w-full max-w-2xl mx-auto my-3 flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`;
  
  const avatarBg = isUser ? 'bg-purple-600 text-white' : 'bg-slate-900 text-purple-400';
  const avatarSymbol = isUser ? 'U' : '⚡';

  container.innerHTML = `
    <div class="w-8 h-8 rounded-full ${avatarBg} flex-shrink-0 flex items-center justify-center text-xs font-mono">
      ${avatarSymbol}
    </div>
    <div class="flex-1 space-y-1 overflow-hidden">
      <div class="text-[10px] font-bold text-slate-400 font-mono tracking-wider">${isUser ? 'YOU' : 'SYSTEM ANALYST'}</div>
      <div class="bg-white border border-slate-200 text-slate-800 text-sm p-5 rounded-2xl ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'} leading-relaxed shadow-sm markdown-render">
        ${isUser ? text.replace(/\n/g, '<br>') : parseMarkdown(text)}
      </div>
    </div>
  `;
  
  chatMessages.appendChild(container);
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: "smooth"
  });

  return container;
}

function buildHistoryContext() {
  if (nodes.length === 0) {
    return "The user has no study entries cataloged yet.";
  }

  return nodes.map((node, i) => {
    const f = node.rawFormFields;
    const tagNames = (node.tagIds || []).map(id => {
      const t = tags.find(tag => tag.id === id);
      return t ? t.name : "";
    }).filter(n => n !== "").join(", ");

    return `Session Log #${i + 1}
Linked Tags: ${tagNames || "None"}
Date: ${f.date}
Focus Duration: ${f.focusDuration} minutes
Study Range: ${f.studyRange}
Reported Bottleneck / Contradiction: "${f.contradiction}"
AI Logic Summary Output: "${node.aiAnalysis || 'None'}"
---`;
  }).join("\n\n");
}

async function queryOpenRouterChat(userQuery, historyText) {
  if (!CONFIG.OPENROUTER_API_KEY || CONFIG.OPENROUTER_API_KEY.trim() === "") {
    throw new Error("OpenRouter API key missing. Please configure it in System Settings.");
  }

  const systemPrompt = `You are a cognitive analytics chat assistant. You have access to the user's historical log of study entries (each including study dates, focus time, complex points, attention ratings, and fatigue rates).
Your task is to analyze these historical logs to answer the user's reflection query. Make sure to:
1. Base your arguments on historical data. Point out patterns.
2. Provide highly practical advice for planning future sessions.
3. Keep your language clear, objective, and analytical.`;

  const userContent = `Here is my chronological study log history:
${historyText}

Reflective Query: ${userQuery}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
      "HTTP-Referer": window.location.origin || "http://localhost:5000",
      "X-Title": "Alloma AI Reflection Chat"
    },
    body: JSON.stringify({
      model: CONFIG.OPENROUTER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ]
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenRouter Error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  } else {
    throw new Error("Malformed response format received from OpenRouter API.");
  }
}

// ==================== ASYNCHRONOUS SAFEGUARDS ====================
function showLoading(msg = "Processing...") {
  if (loadingText) loadingText.textContent = msg;
  if (workspaceLoading) workspaceLoading.classList.remove("hidden");
}

function hideLoading() {
  if (workspaceLoading) workspaceLoading.classList.add("hidden");
}

// ==================== CUSTOM CONFIRMATION MODAL ====================
function confirmAction(title, desc, onConfirm) {
  const modalCancel = document.getElementById("modal-cancel");
  const modalConfirm = document.getElementById("modal-confirm");
  const modalTitle = document.getElementById("modal-title");
  const modalDesc = document.getElementById("modal-desc");

  if (!confirmModal || !modalConfirm || !modalCancel) return;

  if (modalTitle) modalTitle.textContent = title;
  if (modalDesc) modalDesc.textContent = desc;

  confirmModal.classList.remove("hidden");

  const cleanup = () => {
    confirmModal.classList.add("hidden");
    modalConfirm.removeEventListener("click", handleConfirm);
    modalCancel.removeEventListener("click", handleCancel);
  };

  const handleConfirm = () => {
    onConfirm();
    cleanup();
  };

  const handleCancel = () => {
    cleanup();
  };

  modalConfirm.addEventListener("click", handleConfirm);
  modalCancel.addEventListener("click", handleCancel);
}

// ==================== STOPWATCH TIMER MODULE ====================
function setupTimer() {
  if (!btnTimerToggle || !btnTimerReset || !btnTimerCommit) return;

  btnTimerToggle.addEventListener("click", () => {
    if (isTimerRunning) {
      clearInterval(timerInterval);
      isTimerRunning = false;
      btnTimerToggle.textContent = "Resume";
      btnTimerToggle.classList.remove("bg-neutral-800", "text-white");
      btnTimerToggle.classList.add("bg-amber-500/10", "text-amber-500", "border-amber-500/20");
      if (timerDot) {
        timerDot.classList.remove("bg-neutral-900", "animate-pulse");
        timerDot.classList.add("bg-neutral-400");
      }
    } else {
      timerInterval = setInterval(() => {
        elapsedSeconds++;
        updateTimerDisplay();
      }, 1000);
      isTimerRunning = true;
      btnTimerToggle.textContent = "Pause";
      btnTimerToggle.classList.remove("bg-amber-500/10", "text-amber-500", "border-amber-500/20");
      btnTimerToggle.classList.add("bg-neutral-800", "text-white");
      if (timerDot) {
        timerDot.classList.remove("bg-neutral-400");
        timerDot.classList.add("bg-neutral-900", "animate-pulse");
      }
    }
  });

  btnTimerReset.addEventListener("click", () => {
    clearInterval(timerInterval);
    elapsedSeconds = 0;
    isTimerRunning = false;
    updateTimerDisplay();
    btnTimerToggle.textContent = "Start";
    btnTimerToggle.classList.remove("bg-amber-500/10", "text-amber-500", "border-amber-500/20");
    btnTimerToggle.classList.add("bg-neutral-800", "text-white");
    if (timerDot) {
      timerDot.classList.remove("bg-neutral-900", "animate-pulse");
      timerDot.classList.add("bg-neutral-400");
    }
  });

  btnTimerCommit.addEventListener("click", () => {
    if (elapsedSeconds === 0) {
      alert("Hali hech qanday vaqt o'tmadi.");
      return;
    }
    const minutes = Math.ceil(elapsedSeconds / 60);
    if (inputDuration) inputDuration.value = minutes;
  });
}

function updateTimerDisplay() {
  if (!timerDisplay) return;
  const min = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
  const sec = (elapsedSeconds % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `${min}:${sec}`;
}

// ==================== ACTIVE RECALL & EXPORT HANDLERS ====================
function setupRecallMode() {
  if (!btnToggleRecall) return;
  btnToggleRecall.addEventListener("click", () => {
    isRecallModeActive = !isRecallModeActive;
    
    if (isRecallModeActive) {
      btnToggleRecall.textContent = "Javobni Ko'rish";
      btnToggleRecall.classList.remove("bg-inputbg", "text-primary");
      btnToggleRecall.classList.add("bg-neutral-900", "text-white");
      if (nodeContradiction) nodeContradiction.classList.add("recall-blurred");
      if (nodeAiAnalysis) nodeAiAnalysis.classList.add("recall-blurred");
    } else {
      btnToggleRecall.textContent = "Eslashni Yoqish";
      btnToggleRecall.classList.remove("bg-neutral-900", "text-white");
      btnToggleRecall.classList.add("bg-inputbg", "text-primary");
      if (nodeContradiction) nodeContradiction.classList.remove("recall-blurred");
      if (nodeAiAnalysis) nodeAiAnalysis.classList.remove("recall-blurred");
    }
  });

  if (btnExportNode) {
    btnExportNode.addEventListener("click", exportActiveNode);
  }
  
  const btnEditNode = document.getElementById("btn-edit-node");
  if (btnEditNode) {
    btnEditNode.addEventListener("click", editActiveNode);
  }
}

// ==================== DRAG & DROP RAG FILE INGESTION ====================
function setupDragDropIngestion() {
  const dragDropZone = document.getElementById("drag-drop-zone");
  const fileInputSource = document.getElementById("file-input-source");

  if (!dragDropZone || !fileInputSource) return;

  dragDropZone.addEventListener("click", () => fileInputSource.click());

  dragDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dragDropZone.classList.add("border-purple-500", "bg-purple-100/50");
  });

  dragDropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragDropZone.classList.remove("border-purple-500", "bg-purple-100/50");
  });

  dragDropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dragDropZone.classList.remove("border-purple-500", "bg-purple-100/50");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedSourceFiles(e.dataTransfer.files);
    }
  });

  fileInputSource.addEventListener("change", async () => {
    if (fileInputSource.files && fileInputSource.files.length > 0) {
      await processUploadedSourceFiles(fileInputSource.files);
      fileInputSource.value = "";
    }
  });
}

async function processUploadedSourceFiles(files) {
  if (!supabase || !currentUser) {
    alert("Supabase client active masofaviy ulanishi yo'q.");
    return;
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      showLoading(`'${file.name}' manbasidan matn o'qilmoqda...`);
      const { pages, pageCount } = await parseFileToPages(file);

      showLoading(`'${file.name}' bo'laklanmoqda (500-char boundary chunking)...`);
      const chunks = chunkPagesWithOverlap(pages, file.name);

      showLoading(`'${file.name}' Supabase PostgreSQL RAG Bazasiga saqlanmoqda...`);
      
      // Add source document record to Supabase
      const { data: sourceData, error: sourceErr } = await supabase
        .from('sources')
        .insert([{
          user_id: currentUser.id,
          filename: file.name,
          status: 'PROCESSING',
          page_count: pageCount,
          chunk_count: chunks.length
        }])
        .select();

      if (sourceErr || !sourceData || !sourceData[0]) {
        throw new Error("Manba yozuvini yaratishda xatolik: " + (sourceErr?.message || ""));
      }

      const dbSourceId = sourceData[0].id;
      await fetchSources();
      
      // Process embeddings with retry mechanism (5 attempts, exponential backoff)
      const chunkRecords = [];
      let embeddingErrors = 0;

      for (let chunk of chunks) {
        try {
          const embedding = await generateEmbedding(chunk.text, dbSourceId);
          chunkRecords.push({
            source_id: dbSourceId,
            user_id: currentUser.id,
            text_content: chunk.text,
            citation: `[Manba: ${file.name}, p. ${chunk.pageNum}]`,
            chunk_index: chunk.chunkIndex,
            embedding: embedding
          });
        } catch (chunkErr) {
          embeddingErrors++;
          console.warn(`Chunk embedding failed:`, chunkErr);
        }
      }

      if (chunkRecords.length > 0) {
        const { error: chunkInsertErr } = await supabase
          .from('document_chunks')
          .insert(chunkRecords);

        if (chunkInsertErr) {
          console.error("document_chunks insert error:", chunkInsertErr);
        }
      }
      
      // Update source document status
      if (embeddingErrors === chunks.length) {
        await supabase
          .from('sources')
          .update({
            status: 'ERROR',
            source_error_message: `Barcha ${chunks.length} parchalarda embedding generation 5 urinishdan so'ng muvaffaqiyatsiz yakunlandi`
          })
          .eq('id', dbSourceId);
      } else if (embeddingErrors > 0) {
        await supabase
          .from('sources')
          .update({
            status: 'PARTIAL',
            source_error_message: `${embeddingErrors}/${chunks.length} parchalarda embedding xatosi`
          })
          .eq('id', dbSourceId);
      } else {
        await supabase
          .from('sources')
          .update({ status: 'SUCCESS' })
          .eq('id', dbSourceId);
      }

      await fetchSources();
    } catch (err) {
      console.error(`Fayl yuklashda xatolik (${file.name}):`, err);
      alert(`'${file.name}' faylini o'qishda xatolik: ` + err.message);
    }
  }

  hideLoading();
}

async function parseFileToPages(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const pages = [];

  if (ext === 'pdf') {
    if (!window.pdfjsLib) {
      throw new Error("PDF.js kutubxonasi yuklanmadi.");
    }
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      if (pageText.trim()) {
        pages.push({ pageNum: i, text: pageText });
      }
    }
    return { pages, pageCount: numPages };
  } else if (ext === 'docx') {
    if (!window.mammoth) {
      throw new Error("Mammoth.js Word kutubxonasi yuklanmadi.");
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    const rawText = result.value || "";
    const rawParagraphs = rawText.split('\n\n');
    let pageNum = 1;
    let currentText = "";
    
    rawParagraphs.forEach((p, idx) => {
      currentText += p + "\n\n";
      if ((idx + 1) % 4 === 0 || currentText.length > 1500) {
        pages.push({ pageNum: pageNum++, text: currentText });
        currentText = "";
      }
    });
    if (currentText.trim()) {
      pages.push({ pageNum: pageNum, text: currentText });
    }
    return { pages, pageCount: pages.length || 1 };
  } else {
    // Plain TXT
    const text = await file.text();
    const chunks = text.match(/[\s\S]{1,1500}/g) || [text];
    chunks.forEach((chunk, idx) => {
      pages.push({ pageNum: idx + 1, text: chunk });
    });
    return { pages, pageCount: chunks.length };
  }
}

function chunkPagesWithOverlap(pages, fileName) {
  const chunks = [];
  let globalChunkIndex = 0;

  pages.forEach(({ pageNum, text }) => {
    const sentences = text.split(/(?<=[.?!;])\s+/);
    let currentChunkText = "";

    sentences.forEach((sentence) => {
      if ((currentChunkText + sentence).length > 500 && currentChunkText.length > 0) {
        chunks.push({
          id: `${fileName}-p${pageNum}-c${globalChunkIndex}`,
          fileName: fileName,
          pageNum: pageNum,
          chunkIndex: globalChunkIndex++,
          text: currentChunkText.trim()
        });

        // 50-character sliding window overlap
        const overlapText = currentChunkText.slice(-50);
        currentChunkText = overlapText + " " + sentence;
      } else {
        currentChunkText += (currentChunkText ? " " : "") + sentence;
      }
    });

    if (currentChunkText.trim().length > 0) {
      chunks.push({
        id: `${fileName}-p${pageNum}-c${globalChunkIndex}`,
        fileName: fileName,
        pageNum: pageNum,
        chunkIndex: globalChunkIndex++,
        text: currentChunkText.trim()
      });
    }
  });

  return chunks;
}

// Resilient Embedding Generator with 5 Retries and Exponential Backoff
async function generateEmbedding(text, sourceDocId = null) {
  const MAX_RETRIES = 5;
  const BASE_DELAY_MS = 1000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (CONFIG.OPENROUTER_API_KEY && CONFIG.OPENROUTER_API_KEY.trim() !== "") {
        const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CONFIG.OPENROUTER_API_KEY}`
          },
          body: JSON.stringify({
            model: CONFIG.EMBEDDING_MODEL,
            input: text.slice(0, 1000)
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data[0] && data.data[0].embedding) {
            return data.data[0].embedding;
          }
        }
        
        throw new Error(`API returned status ${response.status}: ${response.statusText}`);
      } else {
        throw new Error("OpenRouter API key not configured");
      }
    } catch (e) {
      console.warn(`Embedding API attempt ${attempt}/${MAX_RETRIES} failed:`, e.message);
      
      if (attempt === MAX_RETRIES) {
        console.error(`All ${MAX_RETRIES} embedding API attempts failed:`, e.message);
        
        if (sourceDocId && supabase) {
          await supabase
            .from('sources')
            .update({
              status: 'ERROR',
              source_error_message: `Embedding generation failed after ${MAX_RETRIES} attempts: ${e.message}`
            })
            .eq('id', sourceDocId);
        }
        
        throw e;
      }
      
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`Retrying embedding in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// Vector Search using Supabase pgvector RPC function (match_document_chunks)
async function performVectorSearch(queryXulosa, topK = 3) {
  if (!supabase || !currentUser) return [];

  try {
    const queryEmbedding = await generateEmbedding(queryXulosa);

    // Call Supabase RPC match_document_chunks
    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_count: topK,
      filter_user_id: currentUser.id
    });

    if (error) {
      console.warn("RPC match_document_chunks failed:", error);
      return [];
    }

    if (data && data.length > 0) {
      return data.map(item => {
        let fileName = "Manba";
        if (item.citation) {
          const m = item.citation.match(/\[Manba:\s*([^,]+)/i);
          if (m) fileName = m[1].trim();
        }
        return {
          fileName: fileName,
          pageNum: item.chunk_index ? item.chunk_index + 1 : 1,
          score: item.similarity || 0.85,
          passage: item.text_content
        };
      });
    }
  } catch (e) {
    console.warn("Vector search exception:", e);
  }
  return [];
}

function renderUploadedSources() {
  const sourcesListContainer = document.getElementById("sources-list-container");
  const sourcesList = document.getElementById("sources-list");

  if (!sourcesListContainer || !sourcesList) return;

  if (uploadedSources.length === 0) {
    sourcesListContainer.classList.add("hidden");
    sourcesList.innerHTML = "";
    return;
  }

  sourcesListContainer.classList.remove("hidden");
  sourcesList.innerHTML = "";

  uploadedSources.forEach(src => {
    const card = document.createElement("div");
    
    let statusColor = "bg-purple-50 text-purple-700 border-purple-200";
    let statusIcon = "✓";
    if (src.status === 'ERROR') {
      statusColor = "bg-red-50 text-red-700 border-red-200";
      statusIcon = "✕";
    } else if (src.status === 'PROCESSING') {
      statusColor = "bg-yellow-50 text-yellow-700 border-yellow-200";
      statusIcon = "⟳";
    } else if (src.status === 'PARTIAL') {
      statusColor = "bg-orange-50 text-orange-700 border-orange-200";
      statusIcon = "⚠";
    }
    
    card.className = "p-2.5 bg-white border border-purple-100 rounded-xl flex items-center justify-between shadow-sm text-xs font-mono";
    card.innerHTML = `
      <div class="flex items-center space-x-2 truncate">
        <span class="text-purple-600 font-bold text-sm">📄</span>
        <div class="flex flex-col truncate">
          <span class="truncate font-bold text-slate-800">${src.fileName}</span>
          ${src.errorMessage ? `<span class="text-[9px] text-red-500 truncate">${src.errorMessage}</span>` : ''}
        </div>
      </div>
      <div class="flex items-center space-x-1.5 flex-shrink-0">
        <span class="text-[9px] px-2 py-0.5 rounded-full ${statusColor} font-bold border flex-shrink-0" title="${src.status || 'COMPLETED'}">
          ${statusIcon} ${src.pageCount}b/${src.chunkCount}v
        </span>
      </div>
    `;
    sourcesList.appendChild(card);
  });
}

function editActiveNode() {
  if (!activeNodeId) return;
  const node = nodes.find(n => n.id === activeNodeId);
  if (!node) return;

  editingNodeId = node.id;
  const f = node.rawFormFields;
  
  if (inputDate) inputDate.value = f.date || new Date().toLocaleDateString('sv');
  if (inputDuration) inputDuration.value = f.focusDuration || "";
  if (inputRange) inputRange.value = f.studyRange || "";
  if (inputContradiction) inputContradiction.value = f.contradiction || "";
  
  formSelectedTagIds.clear();
  (node.tagIds || []).forEach(id => formSelectedTagIds.add(id));
  renderFormTags();
  
  switchView("form");
  
  const submitBtn = metricsForm ? metricsForm.querySelector("button[type='submit']") : null;
  if (submitBtn) {
    submitBtn.textContent = "Seans Metrikasini Yangilash (Update Log)";
  }
}

function exportActiveNode() {
  if (!activeNodeId) return;
  const node = nodes.find(n => n.id === activeNodeId);
  if (!node) return;

  const tagNames = (node.tagIds || []).map(id => {
    const t = tags.find(tag => tag.id === id);
    return t ? t.name : "";
  }).filter(n => n !== "").join(", ");

  const markdownContent = `---
date: ${node.rawFormFields.date}
duration_minutes: ${node.rawFormFields.focusDuration}
tags: [${tagNames}]
range: "${node.rawFormFields.studyRange}"
---

# ${node.rawFormFields.studyRange}

## Core Contradiction / Critical Bottleneck
\`\`\`text
${node.rawFormFields.contradiction}
\`\`\`

## AI Logic Audit & Diagnostics
${node.aiAnalysis}
`;

  try {
    const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const safeTitle = node.rawFormFields.studyRange
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .slice(0, 40);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `node_${safeTitle}_${node.rawFormFields.date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Export failed: " + err.message);
  }
}

// ==================== SETTINGS HANDLER ====================
function setupSettingsHandlers() {
  if (!btnSaveSettings) return;

  btnSaveSettings.addEventListener("click", () => {
    const key = inputSettingsKey ? inputSettingsKey.value.trim() : "";
    const model = inputSettingsModel ? inputSettingsModel.value.trim() : "";
    
    localStorage.setItem("openrouter_api_key", key);
    localStorage.setItem("openrouter_model", model);
    
    CONFIG.OPENROUTER_API_KEY = key;
    CONFIG.OPENROUTER_MODEL = model || "meta-llama/llama-3.3-70b-instruct:free";
    
    if (settingsStatusMessage) {
      settingsStatusMessage.classList.remove("hidden");
      setTimeout(() => {
        settingsStatusMessage.classList.add("hidden");
      }, 3000);
    }
  });
}

// ==================== SM-2 SPACED REPETITION EVENT HANDLERS ====================
function setupSM2Handlers() {
  const sm2Buttons = document.querySelectorAll(".btn-sm2-grade");
  sm2Buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!activeNodeId || !supabase) return;
      const grade = parseInt(btn.dataset.grade, 10);
      
      const node = nodes.find(n => n.id === activeNodeId);
      if (!node) return;

      const currentSm2 = node.sm2 || { interval: 0, easeFactor: 2.5, reviewCount: 0 };
      const nextSm2 = calculateSM2(grade, currentSm2.interval, currentSm2.easeFactor, currentSm2.reviewCount);

      try {
        showLoading("SM-2 Takrorlash Bahosi Supabase'ga Saqlanmoqda...");
        const { error } = await supabase
          .from('nodes')
          .update({ sm2: nextSm2 })
          .eq('id', activeNodeId);

        if (error) throw error;

        node.sm2 = nextSm2;

        const dueText = document.getElementById("sm2-next-due-text");
        if (dueText) {
          dueText.textContent = `Keyingi: ${nextSm2.nextReviewDate} (${nextSm2.interval} kundan so'ng)`;
        }
        alert(`SM-2 Takrorlash belgilandi! Keyingi takrorlash sanasi: ${nextSm2.nextReviewDate} (${nextSm2.interval} kun).`);
        renderNodeDirectory();
      } catch (err) {
        alert("Takrorlashni saqlashda xatolik: " + err.message);
      } finally {
        hideLoading();
      }
    });
  });

  // Setup Socratic Grill Button
  const btnSocraticGrill = document.getElementById("btn-socratic-grill");
  if (btnSocraticGrill) {
    btnSocraticGrill.addEventListener("click", () => {
      if (!activeNodeId) return;
      const node = nodes.find(n => n.id === activeNodeId);
      if (!node) return;

      switchView("chat");
      
      const topic = node.rawFormFields ? node.rawFormFields.studyRange : "Mavzu";
      const summary = node.rawFormFields ? node.rawFormFields.contradiction : "";

      const welcomeHtml = `
        <div class="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
          <div class="flex items-center space-x-2 text-purple-700 font-bold text-xs font-mono">
            <span>🎙️ SOKRATIK IMTIHON REJIMI</span>
          </div>
          <p class="text-xs text-slate-800 leading-relaxed font-sans">
            <strong>Mavzu:</strong> ${topic}<br>
            <strong>Sizning xulosangiz:</strong> "${summary}"
          </p>
          <div class="p-3 bg-white rounded-xl border border-purple-100 text-xs font-semibold text-purple-900">
            ❓ <strong>Sokratik Savol:</strong> Ushbu mavzudagi asosiy tamoyil yoki formula kutilmagan favqulodda vaziyatga duch kelganda, siz bergan yakuniy xulosa qanday o'zgaradi va uni qanday mantiqiy dalillar bilan himoya qilasiz?
          </div>
        </div>
      `;

      if (chatMessages) {
        const msgDiv = document.createElement("div");
        msgDiv.className = "w-full max-w-2xl mx-auto my-3";
        msgDiv.innerHTML = welcomeHtml;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    });
  }
}

// ==================== VS CODE STYLE SIDEBAR TOOLBAR HANDLERS ====================
function setupVSCodeToolbar() {
  const btnNewFile = document.getElementById("btn-vscode-new-file");
  const btnNewFolder = document.getElementById("btn-vscode-new-folder");
  const inlineFolderForm = document.getElementById("inline-folder-form");
  const inputFolderName = document.getElementById("input-folder-name");
  const btnSaveFolder = document.getElementById("btn-save-folder");
  const btnCancelFolder = document.getElementById("btn-cancel-folder");

  if (btnNewFile) {
    btnNewFile.addEventListener("click", () => {
      editingNodeId = null;
      if (metricsForm) metricsForm.reset();
      formSelectedTagIds.clear();
      renderFormTags();
      switchView("form");
    });
  }

  if (btnNewFolder && inlineFolderForm) {
    btnNewFolder.addEventListener("click", () => {
      inlineFolderForm.classList.toggle("hidden");
      if (!inlineFolderForm.classList.contains("hidden") && inputFolderName) {
        inputFolderName.focus();
      }
    });
  }

  if (btnCancelFolder && inlineFolderForm) {
    btnCancelFolder.addEventListener("click", () => {
      inlineFolderForm.classList.add("hidden");
      if (inputFolderName) inputFolderName.value = "";
    });
  }

  if (btnSaveFolder) {
    btnSaveFolder.addEventListener("click", () => {
      const folderName = inputFolderName ? inputFolderName.value.trim() : "";
      if (!folderName) return;

      if (userFolders.includes(folderName)) {
        alert(`'${folderName}' papkasi allaqachon mavjud.`);
        return;
      }

      userFolders.push(folderName);
      localStorage.setItem('userFolders', JSON.stringify(userFolders));

      if (inputFolderName) inputFolderName.value = "";
      if (inlineFolderForm) inlineFolderForm.classList.add("hidden");
      renderNodeDirectory();
    });
  }
}

// ==================== FORM STATION INLINE TAG CREATOR (+) ====================
function setupFormTagCreator() {
  const btnFormToggleTag = document.getElementById("btn-form-toggle-tag");
  const formInlineContainer = document.getElementById("form-inline-tag-container");
  const inputFormCustomTag = document.getElementById("input-form-custom-tag");
  const btnFormSaveCustomTag = document.getElementById("btn-form-save-custom-tag");
  const btnFormCancelCustomTag = document.getElementById("btn-form-cancel-custom-tag");

  if (btnFormToggleTag && formInlineContainer) {
    btnFormToggleTag.addEventListener("click", () => {
      formInlineContainer.classList.toggle("hidden");
      if (!formInlineContainer.classList.contains("hidden") && inputFormCustomTag) {
        inputFormCustomTag.focus();
      }
    });
  }

  if (btnFormCancelCustomTag && formInlineContainer) {
    btnFormCancelCustomTag.addEventListener("click", () => {
      formInlineContainer.classList.add("hidden");
      if (inputFormCustomTag) inputFormCustomTag.value = "";
    });
  }

  async function saveCustomTagFromForm() {
    const tagName = inputFormCustomTag ? inputFormCustomTag.value.trim() : "";
    if (!tagName || !currentUser || !supabase) return;

    const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (existingTag) {
      formSelectedTagIds.add(existingTag.id);
      renderFormTags();
      if (formInlineContainer) formInlineContainer.classList.add("hidden");
      if (inputFormCustomTag) inputFormCustomTag.value = "";
      return;
    }

    try {
      showLoading("Yangi teg yaratilmoqda...");
      const { data, error } = await supabase
        .from('tags')
        .insert([{
          name: tagName,
          user_id: currentUser.id
        }])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        formSelectedTagIds.add(data[0].id);
        await fetchTags();
      }
      renderFormTags();
      if (inputFormCustomTag) inputFormCustomTag.value = "";
      if (formInlineContainer) formInlineContainer.classList.add("hidden");
    } catch (err) {
      alert("Teg yaratishda xatolik: " + err.message);
    } finally {
      hideLoading();
    }
  }

  if (btnFormSaveCustomTag) {
    btnFormSaveCustomTag.addEventListener("click", saveCustomTagFromForm);
  }

  if (inputFormCustomTag) {
    inputFormCustomTag.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveCustomTagFromForm();
      }
    });
  }
}

// ==================== OBSIDIAN LIVE NOTE EDITOR ====================
function setupObsidianLiveEditor() {
  const obsidianEditor = document.getElementById("node-obsidian-editor");
  const btnSaveObsidian = document.getElementById("btn-save-obsidian-note");
  const obsidianStatus = document.getElementById("obsidian-save-status");

  let autoSaveTimeout = null;

  async function saveObsidianContent() {
    if (!activeNodeId || !obsidianEditor || !supabase) return;
    const content = obsidianEditor.value;
    const node = nodes.find(n => n.id === activeNodeId);
    if (!node) return;

    try {
      if (obsidianStatus) obsidianStatus.textContent = "Saqlanmoqda...";
      const { error } = await supabase
        .from('nodes')
        .update({ obsidian_content: content })
        .eq('id', activeNodeId);

      if (error) throw error;
      node.obsidianContent = content;
      if (obsidianStatus) obsidianStatus.textContent = "✦ Saqlendi";
    } catch (err) {
      if (obsidianStatus) obsidianStatus.textContent = "Saqlashda xatolik";
      console.error("Obsidian save failed:", err);
    }
  }

  if (btnSaveObsidian) {
    btnSaveObsidian.addEventListener("click", saveObsidianContent);
  }

  if (obsidianEditor) {
    obsidianEditor.addEventListener("input", () => {
      if (obsidianStatus) obsidianStatus.textContent = "Tahrirlanmoqda...";
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        saveObsidianContent();
      }, 1500);
    });
  }
}

// Ensure handlers run after DOM load
document.addEventListener("DOMContentLoaded", () => {
  setupSM2Handlers();
  setupVSCodeToolbar();
  setupFormTagCreator();
  setupObsidianLiveEditor();
});
