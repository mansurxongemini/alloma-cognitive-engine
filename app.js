// ==================== GLOBAL CONFIGURATION ====================
const CONFIG = {
  FIREBASE: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "audit-my-plan.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "audit-my-plan",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "audit-my-plan.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "966629605516",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:966629605516:web:c07e23d07e22d431247ba9",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-LD97F1FMRP"
  },
  OPENROUTER_API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY || "",
  OPENROUTER_MODEL: import.meta.env.VITE_OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free",
  VECTOR_DB_URL: import.meta.env.VITE_VECTOR_DB_URL || "",
  VECTOR_DB_API_KEY: import.meta.env.VITE_VECTOR_DB_API_KEY || ""
};

// Environment variable fallback for browser-based deployment
if (typeof window !== 'undefined' && window.process?.env) {
  if (window.process.env.VITE_FIREBASE_API_KEY) CONFIG.FIREBASE.apiKey = window.process.env.VITE_FIREBASE_API_KEY;
  if (window.process.env.VITE_OPENROUTER_API_KEY) CONFIG.OPENROUTER_API_KEY = window.process.env.VITE_OPENROUTER_API_KEY;
  if (window.process.env.VITE_VECTOR_DB_URL) CONFIG.VECTOR_DB_URL = window.process.env.VITE_VECTOR_DB_URL;
  if (window.process.env.VITE_VECTOR_DB_API_KEY) CONFIG.VECTOR_DB_API_KEY = window.process.env.VITE_VECTOR_DB_API_KEY;
}

// ==================== FIREBASE MODULAR CDN IMPORTS ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getAuth,
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  browserPopupRedirectResolver
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc,
  deleteDoc, 
  query, 
  where, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ==================== GLOBAL APP STATE ====================
let auth = null;
let db = null;
let currentUser = null;
let tags = [];
let nodes = [];
let syllabus = [];

let activeTagIds = []; // Array of tag IDs selected for filtering directory
let activeNodeId = null; // Active knowledge node being viewed
let activeSyllabusId = null; // Active syllabus item being focused
let editingNodeId = null; // Node currently being edited in form
let currentView = 'form'; // 'form' | 'syllabus' | 'node' | 'chat' | 'settings'

// Vector RAG Store & Uploaded Source Documents State
let vectorStore = []; // Array of { id, fileName, pageNum, chunkIndex, text, embedding }
let uploadedSources = []; // Array of { id, fileName, pageCount, chunkCount }

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

// Real-time listener unsubscribers
let unsubscribeTags = null;
let unsubscribeNodes = null;
let unsubscribeSyllabus = null;

// ==================== DOM ELEMENTS SELECTORS ====================
const loginOverlay = document.getElementById("login-overlay");
const loginError = document.getElementById("login-error");
const btnLogin = document.getElementById("btn-login");
const appContainer = document.getElementById("app-container");

const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const sidebarProfile = document.getElementById("sidebar-profile");

// Notion Light/Dark Mode Switcher
const btnThemeToggle = document.getElementById("btn-theme-toggle");
const themeIconLight = document.getElementById("theme-icon-light");
const themeIconDark = document.getElementById("theme-icon-dark");

// Navigation Switchers
const navNewEntry = document.getElementById("nav-new-entry");
const navSyllabusPlanner = document.getElementById("nav-syllabus-planner");
const navAnalyticsChat = document.getElementById("nav-analytics-chat");

// Sidebar Tag Controls
const btnToggleNewTag = document.getElementById("btn-toggle-new-tag");
const inlineTagForm = document.getElementById("inline-tag-form");
const inputTagName = document.getElementById("input-tag-name");
const btnSaveTag = document.getElementById("btn-save-tag");
const btnCancelTag = document.getElementById("btn-cancel-tag");
const tagCloudContainer = document.getElementById("tag-cloud");
const nodeDirectoryContainer = document.getElementById("node-directory");
const btnClearFilters = document.getElementById("btn-clear-filters");

// Workspace Loading & Overlay
const workspaceLoading = document.getElementById("workspace-loading");
const loadingText = document.getElementById("loading-text");

// Workspace Views
const viewForm = document.getElementById("view-form");
const viewSyllabus = document.getElementById("view-syllabus");
const viewNode = document.getElementById("view-node");
const viewChat = document.getElementById("view-chat");
const viewSettings = document.getElementById("view-settings");

// Settings elements
const settingsAvatar = document.getElementById("settings-avatar");
const settingsName = document.getElementById("settings-name");
const settingsEmail = document.getElementById("settings-email");
const settingsUid = document.getElementById("settings-uid");
const btnSettingsLogout = document.getElementById("btn-settings-logout");
const inputSettingsKey = document.getElementById("input-settings-key");
const inputSettingsModel = document.getElementById("input-settings-model");
const btnSaveSettings = document.getElementById("btn-save-settings");
const settingsStatusMessage = document.getElementById("settings-status-message");

// Left Pane: Reading Sandbox elements
const scratchpadEditor = document.getElementById("scratchpad-editor");
const btnScratchpadLoad = document.getElementById("btn-scratchpad-load");
const btnScratchpadClear = document.getElementById("btn-scratchpad-clear");

// Right Pane: Input Form Elements
const metricsForm = document.getElementById("metrics-form");
const inputDate = document.getElementById("input-date");
const inputDuration = document.getElementById("input-duration");
const inputRange = document.getElementById("input-range");
const formTagSelection = document.getElementById("form-tag-selection");
const inputContradiction = document.getElementById("input-contradiction");
const syllabusActiveNotifier = document.getElementById("syllabus-active-notifier");
const btnUnlinkSyllabus = document.getElementById("btn-unlink-syllabus");

// Timer components
const timerDisplay = document.getElementById("timer-display");
const btnTimerToggle = document.getElementById("btn-timer-toggle");
const btnTimerReset = document.getElementById("btn-timer-reset");
const btnTimerCommit = document.getElementById("btn-timer-commit");
const timerDot = document.getElementById("timer-dot");

// Syllabus View Elements
const inputSyllabusTitle = document.getElementById("input-syllabus-title");
const syllabusTagSelection = document.getElementById("syllabus-tag-selection");
const btnSaveSyllabus = document.getElementById("btn-save-syllabus");
const syllabusList = document.getElementById("syllabus-list");
const syllabusProgressText = document.getElementById("syllabus-progress-text");

// Node Viewer Elements
const nodeTitle = document.getElementById("node-title");
const nodeDate = document.getElementById("node-date");
const nodeDuration = document.getElementById("node-duration");
const nodeRange = document.getElementById("node-range");
const nodeTagsList = document.getElementById("node-tags-list");
const nodeContradiction = document.getElementById("node-contradiction");
const nodeAiAnalysis = document.getElementById("node-ai-analysis");
const btnDeleteNode = document.getElementById("btn-delete-node");

// Active Recall & Export elements
const btnToggleRecall = document.getElementById("btn-toggle-recall");
const btnExportNode = document.getElementById("btn-export-node");

// Chat View Elements
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

// Confirmation Modal Elements
const confirmModal = document.getElementById("confirm-modal");

// ==================== APP INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", () => {
  // Load configuration from local browser storage on bootstrap
  let storedKey = localStorage.getItem("openrouter_api_key");
  let storedModel = localStorage.getItem("openrouter_model");
  
  if (!storedKey && CONFIG.OPENROUTER_API_KEY) {
    localStorage.setItem("openrouter_api_key", CONFIG.OPENROUTER_API_KEY);
    storedKey = CONFIG.OPENROUTER_API_KEY;
  }
  if (!storedModel && CONFIG.OPENROUTER_MODEL) {
    localStorage.setItem("openrouter_model", CONFIG.OPENROUTER_MODEL);
    storedModel = CONFIG.OPENROUTER_MODEL;
  }

  if (storedKey) CONFIG.OPENROUTER_API_KEY = storedKey;
  if (storedModel) CONFIG.OPENROUTER_MODEL = storedModel;

  initTheme();
  setupNavigators();
  setupTagFormToggle();
  setupSettingsHandlers();
  setupTagFormToggle();
  setupRecallMode();
  setupDragDropIngestion();
  setupScratchpad();
  setupSyllabusActions();
  
  btnClearFilters.addEventListener("click", clearFilters);

  // Validate API Configuration before booting
  if (!CONFIG.FIREBASE.apiKey || CONFIG.FIREBASE.apiKey.trim() === "") {
    loginError.classList.remove("hidden");
    loginError.innerHTML = `
      <strong>Configuration Required:</strong><br>
      Please open <code>app.js</code> and configure the <code>CONFIG</code> object at the top with your Firebase API keys and OpenRouter API key.
    `;
    btnLogin.disabled = true;
    btnLogin.classList.add("opacity-55", "cursor-not-allowed");
    return;
  }

  // Initialize Firebase V9+
  try {
    const app = initializeApp(CONFIG.FIREBASE);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Listen for Auth changes
    onAuthStateChanged(auth, handleAuthStateChanged);
    getRedirectResult(auth).catch(console.error);
  } catch (error) {
    console.error("Firebase init failed:", error);
    loginError.classList.remove("hidden");
    loginError.textContent = "Initialization failed: " + error.message;
  }
});

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

// ==================== AUTHENTICATION HANDLERS ====================
btnLogin.addEventListener("click", async () => {
  loginError.classList.add("hidden");
  const provider = new GoogleAuthProvider();
  try {
    showLoading("Authenticating...");
    await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  } catch (error) {
    if (
      error.code === "auth/cancelled-popup-request" || 
      error.code === "auth/popup-blocked" || 
      error.code === "auth/popup-closed-by-user"
    ) {
      try {
        await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
      } catch (redirectErr) {
        console.error("Redirect login failed:", redirectErr);
        hideLoading();
        loginError.classList.remove("hidden");
        loginError.textContent = redirectErr.message;
      }
    } else {
      console.error("Login failed:", error);
      hideLoading();
      loginError.classList.remove("hidden");
      loginError.textContent = error.message;
    }
  }
});

btnSettingsLogout.addEventListener("click", () => {
  confirmAction(
    "Sign Out",
    "Are you sure you want to log out of the Workspace?",
    () => {
      signOut(auth);
    }
  );
});

function handleAuthStateChanged(user) {
  hideLoading();
  if (user) {
    currentUser = user;
    
    // Set up Profile Card
    userAvatar.src = user.photoURL || "https://picsum.photos/100";
    userName.textContent = user.displayName || "Cognitive Agent";
    
    // Set default date input value to today (local YYYY-MM-DD)
    const today = new Date().toLocaleDateString('sv');
    inputDate.value = today;

    // Show app structure
    loginOverlay.classList.add("opacity-0", "pointer-events-none");
    setTimeout(() => loginOverlay.classList.add("hidden"), 500);
    appContainer.classList.remove("hidden");

    // Establish live firestore synchronization
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
    activeSyllabusId = null;
    formSelectedTagIds.clear();
    syllabusSelectedTagIds.clear();
    
    // Clean subscriptions
    if (unsubscribeTags) unsubscribeTags();
    if (unsubscribeNodes) unsubscribeNodes();
    if (unsubscribeSyllabus) unsubscribeSyllabus();
    
    // Show login structure
    appContainer.classList.add("hidden");
    loginOverlay.classList.remove("hidden");
    setTimeout(() => loginOverlay.classList.remove("opacity-0", "pointer-events-none"), 50);
  }
}

// ==================== FIRESTORE DATA SYNCHRONIZATION ====================
function subscribeToDatabase() {
  if (!currentUser) return;

  // Tags synchronization
  const tagsQuery = query(
    collection(db, "tags"),
    where("userId", "==", currentUser.uid)
  );

  unsubscribeTags = onSnapshot(tagsQuery, (snapshot) => {
    tags = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    tags.sort((a, b) => a.name.localeCompare(b.name));
    renderTags();
    renderFormTags();
    renderSyllabusTagSelection();
  }, (error) => {
    console.error("Tags subscription error:", error);
  });

  // Nodes synchronization
  const nodesQuery = query(
    collection(db, "nodes"),
    where("userId", "==", currentUser.uid)
  );

  unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
    nodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    nodes.sort((a, b) => new Date(b.rawFormFields.date) - new Date(a.rawFormFields.date));
    renderNodeDirectory();
  }, (error) => {
    console.error("Nodes subscription error:", error);
  });

  // Syllabus synchronization
  const syllabusQuery = query(
    collection(db, "syllabus"),
    where("userId", "==", currentUser.uid)
  );

  unsubscribeSyllabus = onSnapshot(syllabusQuery, (snapshot) => {
    syllabus = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    syllabus.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderSyllabusList();
  }, (error) => {
    console.error("Syllabus subscription error:", error);
  });
}

// ==================== WORKSPACE NAVIGATION ====================
function setupNavigators() {
  navNewEntry.addEventListener("click", () => switchView("form"));
  navSyllabusPlanner.addEventListener("click", () => switchView("syllabus"));
  navAnalyticsChat.addEventListener("click", () => switchView("chat"));
  sidebarProfile.addEventListener("click", () => switchView("settings"));

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

      // Hide entire directory section wrapper (header + toolbar + list)
      const dirWrapper = document.getElementById("sidebar-directory-wrapper");
      if (dirWrapper) dirWrapper.classList.toggle("hidden", isCollapsed);

      // Compact nav buttons — hide text, keep icons
      const navBtns = [navNewEntry, navSyllabusPlanner, navAnalyticsChat];
      navBtns.forEach(btn => {
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
  
  // Reset navigation selection styling
  const navItems = [navNewEntry, navSyllabusPlanner, navAnalyticsChat];
  navItems.forEach(nav => {
    nav.classList.remove("bg-gradient-to-r", "from-blue-600", "via-purple-600", "to-pink-500", "from-purple-600", "to-indigo-600", "text-white", "shadow-md", "shadow-purple-500/20", "font-bold");
    nav.classList.add("text-slate-600", "hover:text-purple-700", "hover:bg-purple-50", "border-transparent");
  });

  viewForm.classList.add("hidden");
  viewSyllabus.classList.add("hidden");
  viewNode.classList.add("hidden");
  viewChat.classList.add("hidden");
  viewSettings.classList.add("hidden");

  let activeNav = null;
  let targetView = null;

  if (viewName === "form") {
    viewForm.classList.remove("hidden");
    activeNav = navNewEntry;
    targetView = viewForm;
  } else if (viewName === "syllabus") {
    viewSyllabus.classList.remove("hidden");
    activeNav = navSyllabusPlanner;
    targetView = viewSyllabus;
  } else if (viewName === "node") {
    viewNode.classList.remove("hidden");
    targetView = viewNode;
  } else if (viewName === "chat") {
    viewChat.classList.remove("hidden");
    activeNav = navAnalyticsChat;
    targetView = viewChat;
  } else if (viewName === "settings") {
    viewSettings.classList.remove("hidden");
    targetView = viewSettings;
    if (currentUser) {
      settingsAvatar.src = currentUser.photoURL || "https://picsum.photos/100";
      settingsName.textContent = currentUser.displayName || "Tadqiqotchi";
      settingsEmail.textContent = currentUser.email || "---";
      settingsUid.textContent = currentUser.uid;
      inputSettingsKey.value = CONFIG.OPENROUTER_API_KEY || "";
      inputSettingsModel.value = CONFIG.OPENROUTER_MODEL || "meta-llama/llama-3-8b-instruct:free";
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

// ==================== DYNAMIC TAG DIRECTORY ACTIONS ====================
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

// Dynamic Tag Colors Generator
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
    await addDoc(collection(db, "tags"), {
      name: name,
      userId: currentUser.uid,
      createdAt: new Date().toISOString()
    });
    
    inputTagName.value = "";
    inlineTagForm.classList.add("hidden");
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
    btnClearFilters.classList.remove("hidden");
  } else {
    btnClearFilters.classList.add("hidden");
  }

  renderTags();
  renderNodeDirectory();
}

function clearFilters() {
  activeTagIds = [];
  btnClearFilters.classList.add("hidden");
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
    nextReviewDate: nextReviewDateStr,
    lastReviewedDate: new Date().toISOString().split('T')[0]
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

  if (filteredNodes.length === 0) {
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
    const folderNodes = groupedFolders[folderName];

    const folderContainer = document.createElement("div");
    folderContainer.className = "space-y-1";

    // Folder Header Component with Drag & Drop Drop Target Handlers
    const folderHeader = document.createElement("button");
    folderHeader.className = "w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-purple-50/70 border border-slate-200 text-xs font-bold text-slate-800 transition-all cursor-pointer shadow-2xs group";
    
    folderHeader.innerHTML = `
      <div class="flex items-center space-x-2 truncate">
        <svg class="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span class="truncate font-sans font-extrabold">${folderName}</span>
      </div>
      <div class="flex items-center space-x-1.5 flex-shrink-0">
        <span class="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[9px] font-mono font-bold text-purple-700">${folderNodes.length}</span>
        <svg class="w-3.5 h-3.5 text-slate-400 transform transition-transform duration-200 folder-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    `;

    // Drag Over & Drop listeners on Folder Header
    folderHeader.addEventListener("dragover", (e) => {
      e.preventDefault();
      folderHeader.classList.add("border-purple-500", "bg-purple-100", "ring-2", "ring-purple-400/30");
    });

    folderHeader.addEventListener("dragleave", (e) => {
      e.preventDefault();
      folderHeader.classList.remove("border-purple-500", "bg-purple-100", "ring-2", "ring-purple-400/30");
    });

    folderHeader.addEventListener("drop", async (e) => {
      e.preventDefault();
      folderHeader.classList.remove("border-purple-500", "bg-purple-100", "ring-2", "ring-purple-400/30");
      const draggedNodeId = e.dataTransfer.getData("text/plain");
      if (!draggedNodeId) return;

      const targetNode = nodes.find(n => n.id === draggedNodeId);
      if (!targetNode) return;

      try {
        showLoading(`Yozuv '${folderName}' papkasiga ko'chirilmoqda...`);
        targetNode.customFolder = folderName;
        const nodeRef = doc(db, "nodes", draggedNodeId);
        await updateDoc(nodeRef, { customFolder: folderName });
        renderNodeDirectory();
      } catch (err) {
        alert("Ko'chirishda xatolik: " + err.message);
      } finally {
        hideLoading();
      }
    });

    // Sub-items List Container
    const subItemsContainer = document.createElement("div");
    subItemsContainer.className = "pl-3 space-y-1.5 pt-1 border-l-2 border-purple-100 ml-3";

    folderNodes.forEach(node => {
      const isActiveNode = node.id === activeNodeId;

      const itemCard = document.createElement("div");
      itemCard.setAttribute("draggable", "true");
      itemCard.className = `p-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing space-y-1 ${isActiveNode ? 'border-purple-500 bg-purple-50/40 shadow-sm' : 'border-slate-200/80 bg-white hover:border-purple-300'}`;

      const dateStr = (node.rawFormFields && node.rawFormFields.date) ? node.rawFormFields.date : "";
      const summaryExcerpt = (node.rawFormFields && node.rawFormFields.contradiction) ? node.rawFormFields.contradiction.slice(0, 45) + "..." : "Xulosa";

      itemCard.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex items-center space-x-1.5 text-xs font-bold text-slate-800 truncate flex-1 pr-1">
            <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="truncate font-sans">${node.rawFormFields ? node.rawFormFields.studyRange : "Yozuv"}</span>
          </div>
          <span class="text-[9px] text-slate-400 font-mono flex-shrink-0">${dateStr}</span>
        </div>
        <div class="text-[10px] text-slate-500 font-sans truncate pl-5">
          "${summaryExcerpt}"
        </div>
      `;

      // Drag Start Handler
      itemCard.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", node.id);
        itemCard.classList.add("opacity-50", "scale-95");
      });

      itemCard.addEventListener("dragend", () => {
        itemCard.classList.remove("opacity-50", "scale-95");
      });

      itemCard.addEventListener("click", (e) => {
        e.stopPropagation();
        selectNode(node.id);
      });

      subItemsContainer.appendChild(itemCard);
    });

    // Toggle Expand/Collapse
    folderHeader.addEventListener("click", () => {
      subItemsContainer.classList.toggle("hidden");
      const chevron = folderHeader.querySelector(".folder-chevron");
      if (chevron) {
        chevron.classList.toggle("rotate-180");
      }
    });

    folderContainer.appendChild(folderHeader);
    folderContainer.appendChild(subItemsContainer);
    nodeDirectoryContainer.appendChild(folderContainer);
  });
}



// ==================== SCRATCHPAD & SANDBOX HANDLERS ====================
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

metricsForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const selectedTagsArray = Array.from(formSelectedTagIds);
  
  if (selectedTagsArray.length === 0) {
    alert("Iltimos, ushbu yozuvga kamida bitta tegni biriktiring.");
    return;
  }

  const formData = {
    date: inputDate.value,
    focusDuration: parseInt(inputDuration.value, 10),
    studyRange: inputRange.value.trim(),
    contradiction: inputContradiction.value.trim(),
    scratchpadContent: scratchpadEditor ? scratchpadEditor.value.trim() : ""
  };

  try {
    showLoading("OpenRouter AI orqali mantiqiy audit bajarilmoqda...");
    const aiAnalysis = await fetchOpenRouterAnalysis(formData);
    
    if (editingNodeId) {
      showLoading("Yozuv Firestore'da yangilanmoqda...");
      const nodeRef = doc(db, "nodes", editingNodeId);
      await updateDoc(nodeRef, {
        tagIds: selectedTagsArray,
        rawFormFields: formData,
        aiAnalysis: aiAnalysis,
        updatedAt: new Date().toISOString()
      });
      editingNodeId = null;
    } else {
      showLoading("Seans metrikasi Firestore'ga saqlanmoqda...");
      await addDoc(collection(db, "nodes"), {
        tagIds: selectedTagsArray,
        userId: currentUser.uid,
        rawFormFields: formData,
        aiAnalysis: aiAnalysis,
        createdAt: new Date().toISOString()
      });
    }

    if (activeSyllabusId) {
      showLoading("O'quv dasturi maqsadi yangilanmoqda...");
      const syllabusDocRef = doc(db, "syllabus", activeSyllabusId);
      await updateDoc(syllabusDocRef, {
        status: 'completed'
      });
      unlinkSyllabusItem();
    }

    metricsForm.reset();
    formSelectedTagIds.clear();
    renderFormTags();
    
    inputDate.value = new Date().toLocaleDateString('sv');
    
    const submitBtn = metricsForm.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.textContent = "Seans Metrikasini Saqlash";
    }

    alert("Seans metrikasi muvaffaqiyatli saqlandi va AI audit qilindi!");
  } catch (error) {
    console.error("Save failed:", error);
    alert("Saqlashda xatolik yuz berdi: " + error.message);
  } finally {
    hideLoading();
  }
});

// ==================== OPENROUTER AI ENGINE INTEGRATION (NOTEBOOKLM GROUNDED VECTOR RAG) ====================
async function fetchOpenRouterAnalysis(fields) {
  if (!CONFIG.OPENROUTER_API_KEY || CONFIG.OPENROUTER_API_KEY.trim() === "") {
    throw new Error("OpenRouter API key is missing. Configure it inside system settings.");
  }

  // Perform Vector Search on Student's Xulosa against Uploaded RAG Documents
  let RAGContextText = "";
  if (vectorStore.length > 0) {
    try {
      showLoading("Vektor Bazadan (RAG) eng mos manba parchalari qidirilmoqda...");
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
        "X-Title": "Cognitive Study Logger"
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

  nodeTitle.textContent = node.rawFormFields.studyRange;
  nodeDate.textContent = node.rawFormFields.date;
  nodeDuration.textContent = node.rawFormFields.focusDuration;
  nodeRange.textContent = node.rawFormFields.studyRange;
  nodeContradiction.textContent = node.rawFormFields.contradiction;
  
  nodeTagsList.innerHTML = "";
  if (node.tagIds && node.tagIds.length > 0) {
    node.tagIds.forEach(id => {
      const tag = tags.find(t => t.id === id);
      if (tag) {
        const pill = document.createElement("span");
        pill.className = "tag-badge";
        pill.textContent = `#${tag.name}`;
        
        // Notion styling
        const styles = getTagStyles(tag.name);
        pill.style.backgroundColor = styles.bg;
        pill.style.color = styles.text;
        pill.style.borderColor = styles.border;
        
        nodeTagsList.appendChild(pill);
      }
    });
  } else {
    nodeTagsList.innerHTML = `<span class="text-xs text-secondary italic">No tags linked.</span>`;
  }

  // Render SM-2 Status Display
  const dueText = document.getElementById("sm2-next-due-text");
  if (dueText) {
    if (node.sm2 && node.sm2.nextReviewDate) {
      dueText.textContent = `Keyingi takrorlash: ${node.sm2.nextReviewDate} (${node.sm2.interval} kundan so'ng)`;
    } else {
      dueText.textContent = `Keyingi takrorlash: Belgilanmagan`;
    }
  }

  // Obsidian Live Note Editor setup
  const obsidianEditor = document.getElementById("node-obsidian-editor");
  const obsidianStatus = document.getElementById("obsidian-save-status");
  if (obsidianEditor) {
    obsidianEditor.value = node.obsidianContent || node.rawFormFields.contradiction || "";
    if (obsidianStatus) obsidianStatus.textContent = "Jonli tahrirlash...";
  }

  isRecallModeActive = false;
  btnToggleRecall.textContent = "Eslashni Yoqish";
  nodeContradiction.classList.remove("recall-blurred");
  nodeAiAnalysis.classList.remove("recall-blurred");

  nodeAiAnalysis.innerHTML = parseMarkdown(node.aiAnalysis);

  renderNodeDirectory();
  switchView("node");
}

btnDeleteNode.addEventListener("click", () => {
  if (!activeNodeId) return;
  confirmAction(
    "Delete Entry",
    "Are you sure you want to permanently delete this study node log?",
    () => executeDeleteNode(activeNodeId)
  );
});

async function executeDeleteNode(nodeId) {
  try {
    showLoading("Deleting Node...");
    await deleteDoc(doc(db, "nodes", nodeId));
    if (activeNodeId === nodeId) {
      activeNodeId = null;
      switchView("form");
    }
  } catch (error) {
    alert("Error deleting node: " + error.message);
  } finally {
    hideLoading();
  }
}

// ==================== SYLLABUS PLANNER WORKSPACE ACTIONS ====================
function setupSyllabusActions() {
  btnSaveSyllabus.addEventListener("click", createSyllabusItem);
  btnUnlinkSyllabus.addEventListener("click", unlinkSyllabusItem);
}

function renderSyllabusTagSelection() {
  if (!syllabusTagSelection) return;
  if (tags.length === 0) {
    syllabusTagSelection.innerHTML = `<span class="text-[10px] text-slate-400 italic font-mono p-1">Mavjud teglar yo'q.</span>`;
    return;
  }

  syllabusTagSelection.innerHTML = "";

  tags.forEach(tag => {
    const isSelected = syllabusSelectedTagIds.has(tag.id);

    const selectionBadge = document.createElement("span");
    selectionBadge.className = `form-tag-badge text-[10px] py-1 px-2.5 ${isSelected ? 'form-tag-badge-selected' : ''}`;
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
      if (syllabusSelectedTagIds.has(tag.id)) {
        syllabusSelectedTagIds.delete(tag.id);
      } else {
        syllabusSelectedTagIds.add(tag.id);
      }
      renderSyllabusTagSelection();
    });

    syllabusTagSelection.appendChild(selectionBadge);
  });
}

async function createSyllabusItem() {
  const title = inputSyllabusTitle.value.trim();
  
  if (!title) {
    alert("Please enter a study range/title for the syllabus objective.");
    return;
  }

  const selectedTagsArray = Array.from(syllabusSelectedTagIds);

  if (selectedTagsArray.length === 0) {
    alert("Please select at least one tag to associate with this objective.");
    return;
  }

  try {
    showLoading("Adding syllabus objective...");
    await addDoc(collection(db, "syllabus"), {
      title: title,
      tagIds: selectedTagsArray,
      userId: currentUser.uid,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    inputSyllabusTitle.value = "";
    syllabusSelectedTagIds.clear();
    renderSyllabusTagSelection();
  } catch (error) {
    alert("Failed to save syllabus: " + error.message);
  } finally {
    hideLoading();
  }
}

function renderSyllabusList() {
  if (syllabus.length === 0) {
    syllabusList.innerHTML = `
      <div class="text-secondary text-xs text-center py-8 italic font-mono bg-panel rounded-lg border border-bordercol">
        Syllabus is empty. Create your first objective above.
      </div>
    `;
    syllabusProgressText.textContent = "0 Completed";
    return;
  }

  syllabusList.innerHTML = "";

  const completedCount = syllabus.filter(item => item.status === 'completed').length;
  syllabusProgressText.textContent = `${completedCount} of ${syllabus.length} Completed`;

  syllabus.forEach(item => {
    const isCompleted = item.status === 'completed';
    const card = document.createElement("div");
    card.className = `syllabus-item-card p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 ${isCompleted ? 'syllabus-item-completed bg-neutral-200/10 dark:bg-neutral-800/10' : ''}`;

    const cardLeft = document.createElement("div");
    cardLeft.className = "space-y-1.5 flex-1";

    const titleRow = document.createElement("div");
    titleRow.className = "flex items-center space-x-2";

    const statusDot = document.createElement("span");
    if (isCompleted) {
      statusDot.className = "w-4 h-4 flex items-center justify-center rounded-full bg-green-500/10 border border-green-500 text-green-500 flex-shrink-0";
      statusDot.innerHTML = `
        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      `;
    } else {
      statusDot.className = "w-2.5 h-2.5 rounded-full bg-neutral-400 flex-shrink-0";
    }

    const titleSpan = document.createElement("span");
    titleSpan.className = `text-xs font-semibold ${isCompleted ? 'line-through text-secondary' : 'text-primary'}`;
    titleSpan.textContent = item.title;

    titleRow.appendChild(statusDot);
    titleRow.appendChild(titleSpan);
    cardLeft.appendChild(titleRow);

    const tagsRow = document.createElement("div");
    tagsRow.className = "flex flex-wrap gap-1";
    item.tagIds.forEach(id => {
      const tag = tags.find(t => t.id === id);
      if (tag) {
        const tagSpan = document.createElement("span");
        tagSpan.className = "tag-badge text-[9px] py-0.5 px-2";
        tagSpan.textContent = `#${tag.name}`;
        
        const styles = getTagStyles(tag.name);
        tagSpan.style.backgroundColor = styles.bg;
        tagSpan.style.color = styles.text;
        
        tagsRow.appendChild(tagSpan);
      }
    });
    cardLeft.appendChild(tagsRow);

    const cardRight = document.createElement("div");
    cardRight.className = "flex items-center space-x-2";

    if (!isCompleted) {
      const btnLaunch = document.createElement("button");
      btnLaunch.className = "px-3 py-1 bg-inputbg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-primary text-[10px] font-semibold rounded border border-bordercol transition-all active:scale-[0.98]";
      btnLaunch.textContent = "Start Session";
      btnLaunch.addEventListener("click", () => bootSyllabusStudySession(item));
      cardRight.appendChild(btnLaunch);
    }

    const btnDelete = document.createElement("button");
    btnDelete.className = "p-1.5 bg-inputbg text-secondary hover:text-red-500 rounded border border-bordercol hover:bg-neutral-200 dark:hover:bg-neutral-800";
    btnDelete.title = "Delete Objective";
    btnDelete.innerHTML = `
      <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    `;
    btnDelete.addEventListener("click", () => {
      confirmAction(
        "Delete Objective",
        "Are you sure you want to remove this syllabus objective?",
        () => deleteSyllabusItem(item.id)
      );
    });
    cardRight.appendChild(btnDelete);

    card.appendChild(cardLeft);
    card.appendChild(cardRight);
    syllabusList.appendChild(card);
  });
}

async function deleteSyllabusItem(id) {
  try {
    showLoading("Removing syllabus objective...");
    await deleteDoc(doc(db, "syllabus", id));
    if (activeSyllabusId === id) {
      unlinkSyllabusItem();
    }
  } catch (error) {
    alert("Error: " + error.message);
  } finally {
    hideLoading();
  }
}

function bootSyllabusStudySession(item) {
  activeSyllabusId = item.id;
  inputRange.value = item.title;
  formSelectedTagIds = new Set(item.tagIds);
  renderFormTags();

  syllabusActiveNotifier.classList.remove("hidden");
  syllabusActiveNotifier.querySelector("span").textContent = `Linked Goal: ${item.title}`;

  switchView("form");

  btnTimerReset.click();
  btnTimerToggle.click();
}

function unlinkSyllabusItem() {
  activeSyllabusId = null;
  syllabusActiveNotifier.classList.add("hidden");
  inputRange.value = "";
  formSelectedTagIds.clear();
  renderFormTags();
}

// ==================== MARKDOWN RENDERING SYSTEM (MARKED.JS) ====================
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
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const queryText = chatInput.value.trim();
  if (!queryText) return;

  chatInput.value = "";
  appendChatMessage("USER", queryText);

  try {
    const loadingBubble = appendChatMessage("SYSTEM", "Scanning history metrics & formulating diagnostic feedback...");
    const context = buildHistoryContext();
    const answer = await queryOpenRouterChat(queryText, context);
    
    loadingBubble.remove();
    appendChatMessage("SYSTEM", answer);
  } catch (error) {
    console.error("Chat failure:", error);
    appendChatMessage("SYSTEM", "SYSTEM ERROR: Failed to synthesize. Details: " + error.message);
  }
});

document.querySelectorAll(".chat-quick-prompt").forEach(btn => {
  btn.addEventListener("click", () => {
    chatInput.value = btn.textContent.trim();
    chatForm.dispatchEvent(new Event("submit"));
  });
});

function appendChatMessage(sender, text) {
  const welcomeContainer = document.getElementById("chat-welcome-container");
  if (welcomeContainer) {
    welcomeContainer.classList.add("hidden");
  }

  const container = document.createElement("div");
  container.className = "w-full max-w-3xl flex space-x-4 py-4 animate-fade-in";
  
  const isUser = sender === "USER";
  const avatarBg = isUser 
    ? 'bg-slate-200 text-slate-700 font-bold' 
    : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 font-bold';

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
    throw new Error("OpenRouter API key is missing. Configure it inside system settings.");
  }

  const systemPrompt = `You are a cognitive analytics chat assistant. You have access to the user's historical log of study entries (each including study dates, focus time, complex points, attention ratings, and fatigue rates).
Your task is to analyze these historical logs to answer the user's reflection query. Make sure to:
1. Base your arguments on historical data. Point out patterns (e.g. "your fatigue increases after 60 mins of focus", or "complex legal topics show lower attention scores on Mondays").
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
      "X-Title": "Cognitive Study Logger Reflection"
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

// ==================== ASYNCHRONOUS SAFEGUARDS (LOADING SPINNER) ====================
function showLoading(msg = "Processing...") {
  loadingText.textContent = msg;
  workspaceLoading.classList.remove("hidden");
}

function hideLoading() {
  workspaceLoading.classList.add("hidden");
}

// ==================== CUSTOM CONFIRMATION MODALS ====================
function confirmAction(title, desc, onConfirm) {
  const modalCancel = document.getElementById("modal-cancel");
  const modalConfirm = document.getElementById("modal-confirm");
  const modalTitle = document.getElementById("modal-title");
  const modalDesc = document.getElementById("modal-desc");

  modalTitle.textContent = title;
  modalDesc.textContent = desc;

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
  btnTimerToggle.addEventListener("click", () => {
    if (isTimerRunning) {
      clearInterval(timerInterval);
      isTimerRunning = false;
      btnTimerToggle.textContent = "Resume";
      btnTimerToggle.classList.remove("bg-neutral-800", "text-white");
      btnTimerToggle.classList.add("bg-amber-500/10", "text-amber-500", "border-amber-500/20");
      timerDot.classList.remove("bg-neutral-900", "animate-pulse");
      timerDot.classList.add("bg-neutral-400");
    } else {
      timerInterval = setInterval(() => {
        elapsedSeconds++;
        updateTimerDisplay();
      }, 1000);
      isTimerRunning = true;
      btnTimerToggle.textContent = "Pause";
      btnTimerToggle.classList.remove("bg-amber-500/10", "text-amber-500", "border-amber-500/20");
      btnThemeToggle.classList.add("bg-neutral-800", "text-white");
      timerDot.classList.remove("bg-neutral-400");
      timerDot.classList.add("bg-neutral-900", "animate-pulse");
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
    timerDot.classList.remove("bg-neutral-900", "animate-pulse");
    timerDot.classList.add("bg-neutral-400");
  });

  btnTimerCommit.addEventListener("click", () => {
    if (elapsedSeconds === 0) {
      alert("No time has elapsed to commit.");
      return;
    }
    const minutes = Math.ceil(elapsedSeconds / 60);
    inputDuration.value = minutes;
  });
}

function updateTimerDisplay() {
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
      nodeContradiction.classList.add("recall-blurred");
      nodeAiAnalysis.classList.add("recall-blurred");
    } else {
      btnToggleRecall.textContent = "Eslashni Yoqish";
      btnToggleRecall.classList.remove("bg-neutral-900", "text-white");
      btnToggleRecall.classList.add("bg-inputbg", "text-primary");
      nodeContradiction.classList.remove("recall-blurred");
      nodeAiAnalysis.classList.remove("recall-blurred");
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
// ==================== DRAG & DROP SOURCE INGESTION & VECTOR RAG ENGINE ====================
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
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const sourceId = Date.now() + Math.random().toString(36).substring(2, 5);
    
    try {
      showLoading(`'${file.name}' manbasidan matn o'qilmoqda...`);
      const { pages, pageCount } = await parseFileToPages(file);

      showLoading(`'${file.name}' bo'laklanmoqda (Boundary Chunking)...`);
      const chunks = chunkPagesWithOverlap(pages, file.name);

      showLoading(`'${file.name}' Vektor Bazaga (RAG) indekslanmoqda...`);
      
      // Add source document with initial PROCESSING status
      uploadedSources.push({
        id: sourceId,
        fileName: file.name,
        pageCount: pageCount,
        chunkCount: chunks.length,
        status: 'PROCESSING',
        errorMessage: null
      });
      renderUploadedSources();
      
      // Process embeddings with retry mechanism
      let embeddingErrors = 0;
      for (let chunk of chunks) {
        try {
          chunk.embedding = await generateEmbedding(chunk.text, sourceId);
          vectorStore.push(chunk);
        } catch (chunkErr) {
          embeddingErrors++;
          console.warn(`Chunk embedding failed:`, chunkErr);
        }
      }
      
      // Update source status to COMPLETED or ERROR based on results
      const sourceDoc = uploadedSources.find(s => s.id === sourceId);
      if (sourceDoc) {
        if (embeddingErrors === chunks.length) {
          sourceDoc.status = 'ERROR';
          sourceDoc.errorMessage = `All ${chunks.length} chunks failed embedding generation`;
        } else if (embeddingErrors > 0) {
          sourceDoc.status = 'PARTIAL';
          sourceDoc.errorMessage = `${embeddingErrors}/${chunks.length} chunks failed`;
        } else {
          sourceDoc.status = 'COMPLETED';
        }
        renderUploadedSources();
      }
    } catch (err) {
      console.error(`Fayl yuklashda xatolik (${file.name}):`, err);
      
      // Mark source as ERROR
      const sourceDoc = uploadedSources.find(s => s.id === sourceId);
      if (sourceDoc) {
        sourceDoc.status = 'ERROR';
        sourceDoc.errorMessage = err.message;
        renderUploadedSources();
      }
      
      alert(`'${file.name}' faylini o'qishda xatolik yuz berdi: ` + err.message);
    }
  }

  renderUploadedSources();
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
    // Sentence & paragraph boundary delimiters
    const sentences = text.split(/(?<=[.?!;])\s+/);
    let currentChunkText = "";

    sentences.forEach((sentence) => {
      if ((currentChunkText + sentence).length > 550 && currentChunkText.length > 0) {
        chunks.push({
          id: `${fileName}-p${pageNum}-c${globalChunkIndex}`,
          fileName: fileName,
          pageNum: pageNum,
          chunkIndex: globalChunkIndex++,
          text: currentChunkText.trim()
        });

        // 120-character sliding window overlap
        const overlapText = currentChunkText.slice(-120);
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
            model: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
            input: text.slice(0, 1000)
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data[0] && data.data[0].embedding) {
            return data.data[0].embedding;
          }
        }
        
        // If response is not ok, throw error to trigger retry
        throw new Error(`API returned status ${response.status}: ${response.statusText}`);
      } else {
        throw new Error("OpenRouter API key not configured");
      }
    } catch (e) {
      console.warn(`Embedding API attempt ${attempt}/${MAX_RETRIES} failed:`, e.message);
      
      // If this is the last attempt, handle failure
      if (attempt === MAX_RETRIES) {
        console.error(`All ${MAX_RETRIES} embedding API attempts failed. Final error:`, e.message);
        
        // Update source document status to ERROR if sourceDocId is provided
        if (sourceDocId && uploadedSources.length > 0) {
          const sourceDoc = uploadedSources.find(s => s.id === sourceDocId);
          if (sourceDoc) {
            sourceDoc.status = 'ERROR';
            sourceDoc.errorMessage = `Embedding generation failed after ${MAX_RETRIES} attempts: ${e.message}`;
            renderUploadedSources();
          }
        }
        
        // Fallback to TF-IDF vector
        return buildTfidfVector(text);
      }
      
      // Exponential backoff: delay = BASE_DELAY * 2^(attempt-1)
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // This should never be reached due to the logic above, but included for safety
  return buildTfidfVector(text);
}

function buildTfidfVector(text) {
  const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  return freq;
}

function cosineSimilarity(vecA, vecB) {
  if (Array.isArray(vecA) && Array.isArray(vecB)) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }

  const keys = new Set([...Object.keys(vecA || {}), ...Object.keys(vecB || {})]);
  let dot = 0, normA = 0, normB = 0;
  keys.forEach(k => {
    const valA = vecA[k] || 0;
    const valB = vecB[k] || 0;
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  });
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

async function performVectorSearch(queryXulosa, topK = 3) {
  if (vectorStore.length === 0) return [];

  const queryEmbedding = await generateEmbedding(queryXulosa);

  const scored = vectorStore.map(chunk => {
    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, topK);

  // Neighbor Context Expansion (#N-1, #N, #N+1)
  const expandedResults = [];
  const seenChunkIds = new Set();

  topMatches.forEach(({ chunk, score }) => {
    const prevChunk = vectorStore.find(c => c.fileName === chunk.fileName && c.chunkIndex === chunk.chunkIndex - 1);
    const nextChunk = vectorStore.find(c => c.fileName === chunk.fileName && c.chunkIndex === chunk.chunkIndex + 1);

    const passage = [
      prevChunk ? `[... ${prevChunk.text.slice(-80)}]` : '',
      `"${chunk.text}"`,
      nextChunk ? `[${nextChunk.text.slice(0, 80)} ...]` : ''
    ].filter(Boolean).join(" ");

    if (!seenChunkIds.has(chunk.id)) {
      seenChunkIds.add(chunk.id);
      expandedResults.push({
        fileName: chunk.fileName,
        pageNum: chunk.pageNum,
        score: score,
        passage: passage
      });
    }
  });

  return expandedResults;
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
    
    // Status-based styling
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
  
  inputDate.value = f.date || new Date().toLocaleDateString('sv');
  inputDuration.value = f.focusDuration || "";
  inputRange.value = f.studyRange || "";
  inputContradiction.value = f.contradiction || "";
  
  formSelectedTagIds.clear();
  (node.tagIds || []).forEach(id => formSelectedTagIds.add(id));
  renderFormTags();
  
  switchView("form");
  
  const submitBtn = metricsForm.querySelector("button[type='submit']");
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
      .slice(0, 30);
      
    const filename = `node-${node.rawFormFields.date}-${safeTitle}.md`;
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Markdown export failed:", error);
    alert("Failed to export markdown: " + error.message);
  }
}

function setupSettingsHandlers() {
  btnSaveSettings.addEventListener("click", () => {
    const key = inputSettingsKey.value.trim();
    const model = inputSettingsModel.value.trim();
    
    // Save to localStorage
    localStorage.setItem("openrouter_api_key", key);
    localStorage.setItem("openrouter_model", model);
    
    // Update global CONFIG
    CONFIG.OPENROUTER_API_KEY = key;
    CONFIG.OPENROUTER_MODEL = model || "meta-llama/llama-3-8b-instruct:free";
    
    // Show success status
    settingsStatusMessage.classList.remove("hidden");
    setTimeout(() => {
      settingsStatusMessage.classList.add("hidden");
    }, 3000);
  });
}



// ==================== SM-2 SPACED REPETITION EVENT HANDLERS ====================
function setupSM2Handlers() {
  const sm2Buttons = document.querySelectorAll(".btn-sm2-grade");
  sm2Buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!activeNodeId) return;
      const grade = parseInt(btn.dataset.grade, 10);
      
      const node = nodes.find(n => n.id === activeNodeId);
      if (!node) return;

      const currentSm2 = node.sm2 || { interval: 0, easeFactor: 2.5, reviewCount: 0 };
      const nextSm2 = calculateSM2(grade, currentSm2.interval, currentSm2.easeFactor, currentSm2.reviewCount);

      try {
        showLoading("SM-2 Takrorlash Bahosi Saqlanmoqda...");
        const nodeRef = doc(db, "nodes", activeNodeId);
        await updateDoc(nodeRef, {
          sm2: nextSm2
        });

        // Update UI Display
        const dueText = document.getElementById("sm2-next-due-text");
        if (dueText) {
          dueText.textContent = `Keyingi takrorlash: ${nextSm2.nextReviewDate} (${nextSm2.interval} kundan so'ng)`;
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

      const chatMessages = document.getElementById("chat-messages");
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
      metricsForm.reset();
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
      const folderName = inputFolderName.value.trim();
      if (!folderName) return;

      // Check if folder already exists
      if (userFolders.includes(folderName)) {
        alert(`'${folderName}' papkasi allaqachon mavjud.`);
        return;
      }

      // Save to local state & localStorage (no Firestore node created)
      userFolders.push(folderName);
      localStorage.setItem('userFolders', JSON.stringify(userFolders));

      inputFolderName.value = "";
      inlineFolderForm.classList.add("hidden");
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
    if (!tagName) return;

    const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (existingTag) {
      formSelectedTagIds.add(existingTag.id);
      renderFormTags();
      formInlineContainer.classList.add("hidden");
      inputFormCustomTag.value = "";
      return;
    }

    try {
      showLoading("Yangi teg yaratilmoqda...");
      const docRef = await addDoc(collection(db, "tags"), {
        name: tagName,
        userId: currentUser.uid,
        createdAt: new Date().toISOString()
      });

      formSelectedTagIds.add(docRef.id);
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
    if (!activeNodeId || !obsidianEditor) return;
    const content = obsidianEditor.value;
    const node = nodes.find(n => n.id === activeNodeId);
    if (!node) return;

    try {
      if (obsidianStatus) obsidianStatus.textContent = "Saqlanmoqda...";
      const nodeRef = doc(db, "nodes", activeNodeId);
      await updateDoc(nodeRef, {
        obsidianContent: content
      });
      node.obsidianContent = content;
      if (obsidianStatus) obsidianStatus.textContent = "✦ Saqlandi";
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
