/* =========================================================
   PIXORA — LIVE FRONTEND (fixed)
   Uses backend.js and the CURRENT PIXORA Supabase project.
========================================================= */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const API = window.PIXORA;

  let posts = [];
  let savedPosts = [];
  let savedIds = [];
  let likedIds = [];
  let followingIds = [];
  let categories = [];
  let currentUser = null;
  let currentProfile = null;
  let activeCategory = "All";
  let activeFeed = "For you";
  let visibleCount = 24;
  let loading = false;
  let queued = false;
  let hasMore = false;
  let authMode = "login";
  const extraPosts = new Map();
  let isAdmin = false;
  let mutedIds = [];
  let publishTags = [];
  let searchResults = null;   // null = not searching
  let searchTerm = "";
  let searchToken = 0;
  let searchTimer = null;

  const escapeHTML = (value = "") =>
    String(value).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
  }

  const formatDate = (v) =>
    v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";

  // Shows the member's photo if they have one (our own avatar bucket only), else their initial.
  function avatarInner(profile, fallbackName) {
    const url = API?.profiles?.safeAvatarUrl?.(profile?.avatar_url);
    if (url) return `<img src="${escapeHTML(url)}" alt="" loading="lazy">`;
    const name = fallbackName || profile?.display_name || profile?.username || "P";
    return escapeHTML(String(name).charAt(0).toUpperCase());
  }

  function requireBackend() {
    if (!API) {
      toast("PIXORA backend could not load. Refresh the page.");
      return false;
    }
    return true;
  }

  /* ---------- extra styles (modal forms, empty states, video, mobile) ---------- */

  function injectStyles() {
    if ($("#pixora-fixes")) return;
    const style = document.createElement("style");
    style.id = "pixora-fixes";
    style.textContent = `
      .empty-state{column-span:all;grid-column:1/-1;text-align:center;padding:42px 20px;border:1px dashed var(--line);border-radius:14px;background:#111119;color:var(--muted)}
      .empty-state h3{font:700 17px Manrope,sans-serif;color:var(--text);margin:0 0 8px}
      .empty-state p{margin:0 0 14px;font-size:12px;line-height:1.6}
      .small-modal form label{display:block;margin:15px 0 6px;font-size:11px;color:#d8d8e2}
      .small-modal form input:not([type=file]),.small-modal form textarea,.small-modal form select{width:100%;background:#0c0c13;border:1px solid var(--line);border-radius:9px;padding:12px;color:var(--text);font-size:13px}
      .small-modal form input[type=file]{width:100%;color:var(--muted);font-size:12px}
      .small-modal form textarea{resize:vertical;min-height:90px}
      .small-modal form small{display:block;margin-top:6px;color:var(--faint);font-size:10px}
      .small-modal form .primary-button{margin-top:20px;padding:13px}
      .small-modal .text-button{font-size:12px}
      .pin-card video,.preview-layout video{width:100%;display:block;background:#000;max-height:520px}
      .preview-layout img,.preview-layout video{width:100%;height:100%;min-height:390px;object-fit:cover}
      .like-button{border:0;background:none;color:#b9b9c6;font-size:10px;padding:2px 0;display:inline-flex;align-items:center;gap:4px}
      .like-button.liked{color:#ff3d69}
      .pin-caption small{display:block;margin-top:6px;color:#7a7a89;font-size:9px}
      .preview-actions{display:flex;gap:10px;align-items:center;margin-top:14px}
      #accountAction{padding:9px 12px;font-size:11px}
      #openPublish{padding:10px 14px}
      .load-row[hidden]{display:none}
      .upload-modal{max-width:520px}
      #publishMessage{margin:12px 0 0;padding:11px 13px;border-radius:9px;font-size:12px;line-height:1.5}
      #publishMessage[hidden]{display:none}
      .drop-zone{display:grid;justify-items:center;gap:6px;text-align:center;padding:26px 16px;border:1.5px dashed rgba(255,255,255,.18);border-radius:18px;background:#0c0c13;cursor:pointer;transition:.2s}
      .drop-zone:hover,.drop-zone.over,.drop-zone:focus-visible{border-color:var(--accent);background:rgba(255,61,105,.07);outline:0}
      .drop-zone .drop-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:var(--accent);color:#fff;font-size:20px;box-shadow:0 8px 22px rgba(255,61,105,.4)}
      .drop-zone b{font-size:13px}.drop-zone small{color:var(--muted);font-size:11px;margin:0}
      .file-previews{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:10px;margin-top:12px}
      .file-previews:empty{display:none}
      .file-tile{position:relative;aspect-ratio:1;border-radius:14px;overflow:hidden;background:#1a1a24}
      .file-tile img,.file-tile video{width:100%;height:100%;object-fit:cover;display:block}
      .file-tile button{position:absolute;right:6px;top:6px;width:26px;height:26px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font-size:16px;line-height:1}
      .upload-actions{display:flex;gap:10px;margin-top:22px}
      .upload-actions .primary-button{flex:1;margin:0!important}
      #authMessage{margin:14px 0 4px;padding:11px 13px;border-radius:9px;font-size:12px;line-height:1.5}
      #authMessage[hidden]{display:none}
      .auth-error{color:#ff9eaa;background:#32151c;border:1px solid #71303c}
      .auth-notice{color:#9de2b4;background:#14281d;border:1px solid #28543a}
      .password-wrap{position:relative}
      .password-wrap input{padding-right:64px!important}
      .password-wrap .link-button{position:absolute;right:12px;top:50%;transform:translateY(-50%);border:0;background:none;color:#ff7a99;font-size:11px;padding:4px}
      .auth-links{display:flex;gap:16px;flex-wrap:wrap;margin:14px 0 0}
      .auth-links .text-button[hidden]{display:none}
      .avatar img,.top-avatar img,.profile-avatar img,.mini-avatar img,.conversation-avatar img,.notification-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}
      .top-avatar,.avatar,.mini-avatar,.profile-avatar,.conversation-avatar,.notification-avatar{overflow:hidden}
      .tag-input{display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:#0c0c13;border:1px solid var(--line);border-radius:9px;padding:8px}
      .tag-input:focus-within{border-color:var(--accent)}
      .tag-input input{flex:1;min-width:140px;background:none!important;border:0!important;padding:6px!important;outline:0;color:var(--text);font-size:13px}
      .tag-chip,.tag-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid #5a1d33;background:#2a1220;color:#ffe3ea;border-radius:20px;padding:5px 10px;font-size:11px}
      .tag-pill button{border:0;background:none;color:#ff7a99;font-size:14px;line-height:1;padding:0}
      button.tag-chip:hover{border-color:var(--accent)}
      .tag-row{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0}
      #adminLink{text-decoration:none;display:inline-flex;align-items:center;padding:9px 12px;font-size:11px;color:#ffe3ea;border-color:#ff3d69}
      a.nav-item{text-decoration:none}
      @media(max-width:760px){
        #openPublish .btn-label{display:none}
        #openPublish{padding:0;width:32px;height:32px;font-size:16px}
        #accountAction{padding:7px 9px;font-size:10px}
        #adminLink{display:none}
        .preview-layout video{height:260px;min-height:0}
      }`;
    document.head.appendChild(style);
  }

  /* ---------- categories (loaded from the database) ---------- */

  async function loadCategoryChips() {
    if (!API) return;
    try {
      categories = await API.categories.list();
    } catch (error) {
      console.error("Categories:", error);
      return;
    }
    if (!categories.length) return;

    const row = $("#categoryRow");
    if (row) {
      row.innerHTML =
        `<button class="category-chip ${activeCategory === "All" ? "selected" : ""}" data-category="All"><span>✦</span> For you</button>` +
        categories.map(c => `
          <button class="category-chip ${activeCategory === c.name ? "selected" : ""}" data-category="${escapeHTML(c.name)}">
            <span>◈</span> ${escapeHTML(c.name)}
          </button>`).join("");
    }

    const pills = $(".filter-pills");
    if (pills) {
      pills.innerHTML =
        `<button class="filter-pill ${activeCategory === "All" ? "active" : ""}" data-filter="All">All</button>` +
        categories.map(c => `
          <button class="filter-pill ${activeCategory === c.name ? "active" : ""}" data-filter="${escapeHTML(c.name)}">
            ${escapeHTML(c.name)}
          </button>`).join("");
    }
  }

  /* ---------- authentication ---------- */

  function createAuthInterface() {
    if ($("#authModal")) return;

    const modal = document.createElement("div");
    modal.id = "authModal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="small-modal">
        <button class="modal-close" data-close="authModal" aria-label="Close">×</button>
        <div class="eyebrow">YOUR PIXORA ACCOUNT</div>
        <h2 id="authTitle">Welcome <span>back.</span></h2>
        <p id="authDescription">Sign in to continue exploring PIXORA.</p>
        <div id="authMessage" role="alert" hidden></div>
        <form id="authForm" novalidate>
          <div id="usernameField" hidden>
            <label for="authUsername">Username</label>
            <input id="authUsername" name="username" type="text" maxlength="30" autocomplete="username"
              autocapitalize="none" autocorrect="off" spellcheck="false">
            <small class="field-note">Letters, numbers and underscores, 3 to 30 characters.</small>
          </div>
          <div id="displayNameField" hidden>
            <label for="authDisplayName">Display name (optional)</label>
            <input id="authDisplayName" name="displayName" type="text" maxlength="80" autocomplete="name">
          </div>
          <div id="emailField">
            <label for="authEmail">Email address</label>
            <input id="authEmail" name="email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false">
          </div>
          <div id="passwordField">
            <label for="authPassword" id="passwordLabel">Password</label>
            <div class="password-wrap">
              <input id="authPassword" name="password" type="password" autocomplete="current-password">
              <button type="button" class="link-button" id="togglePassword">Show</button>
            </div>
            <small class="field-note" id="passwordHint" hidden>At least 8 characters.</small>
          </div>
          <button type="submit" class="primary-button full-button" id="authSubmit">Sign in</button>
        </form>
        <p class="auth-links">
          <button class="text-button" id="authForgot" type="button">Forgot your password?</button>
          <button class="text-button" id="authResend" type="button" hidden>Resend confirmation email</button>
        </p>
        <p><button class="text-button" id="authSwitch" type="button">Don't have an account? Create one.</button></p>
      </div>`;
    document.body.appendChild(modal);

    $("#authForm").addEventListener("submit", submitAuth);

    $("#authSwitch").addEventListener("click", () =>
      setAuthMode(authMode === "login" ? "signup" : "login")
    );
    $("#authForgot").addEventListener("click", () => setAuthMode("forgot"));
    $("#authResend").addEventListener("click", resendConfirmation);

    $("#togglePassword").addEventListener("click", () => {
      const input = $("#authPassword");
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      $("#togglePassword").textContent = showing ? "Show" : "Hide";
    });

    $("#authUsername").addEventListener("blur", checkUsername);
  }

  function showAuthMessage(text, type = "error") {
    const box = $("#authMessage");
    if (!box) return;
    box.hidden = !text;
    box.className = `auth-${type}`;
    box.textContent = text || "";
  }

  // Modes: login, signup, forgot (send a reset link), reset (choose a new password).
  function setAuthMode(mode) {
    authMode = mode;
    showAuthMessage("");
    $("#authResend").hidden = true;

    const signup = mode === "signup";
    const forgot = mode === "forgot";
    const reset = mode === "reset";
    const login = mode === "login";

    const copy = {
      login: ["Welcome <span>back.</span>", "Sign in to continue exploring PIXORA.", "Sign in"],
      signup: ["Join <span>PIXORA.</span>", "Create your account and start sharing.", "Create account"],
      forgot: ["Reset your <span>password.</span>", "Enter your email and we'll send you a link to choose a new password.", "Send reset link"],
      reset: ["Choose a new <span>password.</span>", "Pick something you haven't used before.", "Save new password"]
    }[mode];

    $("#authTitle").innerHTML = copy[0];
    $("#authDescription").textContent = copy[1];
    $("#authSubmit").textContent = copy[2];

    $("#usernameField").hidden = !signup;
    $("#displayNameField").hidden = !signup;
    $("#emailField").hidden = reset;
    $("#passwordField").hidden = forgot;
    $("#passwordHint").hidden = !(signup || reset);
    $("#passwordLabel").textContent = reset ? "New password" : "Password";
    $("#authForgot").hidden = !login;
    $("#authSwitch").hidden = forgot || reset;

    $("#authSwitch").textContent = signup
      ? "Already have an account? Sign in."
      : "Don't have an account? Create one.";
    if (forgot) {
      $("#authSwitch").hidden = false;
      $("#authSwitch").textContent = "← Back to sign in";
    }

    $("#authPassword").autocomplete = login ? "current-password" : "new-password";
  }

  function openAuth(mode = "login") {
    if (!requireBackend()) return;
    setAuthMode(mode);
    $("#authModal").classList.add("open");
    setTimeout(() => {
      (mode === "reset" ? $("#authPassword") : $("#authEmail"))?.focus();
    }, 50);
  }

  async function checkUsername() {
    if (authMode !== "signup") return;
    const value = $("#authUsername").value.trim().toLowerCase();
    if (!value) return;
    if (!/^[a-z0-9_]{3,30}$/.test(value)) {
      showAuthMessage("Usernames can use letters, numbers and underscores only (3 to 30 characters).");
      return;
    }
    const free = await API.auth.usernameAvailable(value);
    if (free === false) showAuthMessage("That username isn't available. Try another one.");
    else if (free === true) showAuthMessage("");
  }

  async function resendConfirmation() {
    const email = $("#authEmail").value;
    const button = $("#authResend");
    button.disabled = true;
    try {
      await API.auth.resendConfirmation(email);
      showAuthMessage("We sent a new confirmation email. It can take a minute to arrive.", "notice");
    } catch (error) {
      showAuthMessage(error.message);
    } finally {
      button.disabled = false;
    }
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!requireBackend()) return;

    // Keep a reference: event.currentTarget is null after any await.
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const button = $("#authSubmit");
    const labelBefore = button.textContent;
    const mode = authMode;

    showAuthMessage("");
    $("#authResend").hidden = true;
    button.disabled = true;
    button.textContent = "Please wait...";

    try {
      if (mode === "signup") {
        const result = await API.auth.signUp({
          email: form.get("email"),
          password: form.get("password"),
          username: form.get("username"),
          displayName: form.get("displayName")
        });

        if (result.needsConfirmation) {
          setAuthMode("login");
          $("#authEmail").value = String(form.get("email") || "").trim();
          showAuthMessage(
            "Almost there! We sent a confirmation link to your email. Open it, then sign in here. Check your spam folder if you can't find it.",
            "notice"
          );
          $("#authResend").hidden = false;
          return;
        }

        toast("Your PIXORA account has been created.");
      } else if (mode === "login") {
        await API.auth.signIn({ email: form.get("email"), password: form.get("password") });
        toast("Welcome back to PIXORA.");
      } else if (mode === "forgot") {
        await API.auth.requestPasswordReset(form.get("email"));
        showAuthMessage(
          "If an account exists for that email, a reset link is on its way. It can take a minute, so check your spam folder too.",
          "notice"
        );
        return;
      } else if (mode === "reset") {
        await API.auth.updatePassword(form.get("password"));
        window.PIXORA_RECOVERY = false;
        toast("Your password has been updated.");
      }

      $("#authModal").classList.remove("open");
      formEl.reset();
      await refreshAccount();
      await loadFeed();
    } catch (error) {
      showAuthMessage(error.message || "Something went wrong. Please try again.");
      if (error.kind === "email_not_confirmed") $("#authResend").hidden = false;
      if (error.kind === "exists" && mode === "signup") {
        $("#authForgot").hidden = false;
      }
    } finally {
      button.disabled = false;
      button.textContent = authMode === mode ? labelBefore : button.textContent;
    }
  }

  function renderAdminButton() {
    $("#adminLink")?.remove();
    $("#adminNavLink")?.remove();
    if (!isAdmin) return;

    const link = document.createElement("a");
    link.id = "adminLink";
    link.className = "outline-button";
    link.href = "admin.html";
    link.textContent = "◇ Admin";
    $(".top-actions")?.prepend(link);

    const nav = $("#sidebar .main-nav:last-of-type");
    if (nav) {
      const item = document.createElement("a");
      item.id = "adminNavLink";
      item.className = "nav-item";
      item.href = "admin.html";
      item.innerHTML = '<span class="nav-icon">◇</span> Admin dashboard';
      nav.appendChild(item);
    }
  }

  async function refreshAccount() {
    if (!API) return;

    const session = await API.auth.getSession();
    currentUser = session?.user || null;
    currentProfile = null;

    // The button is only a shortcut; the admin page and the database
    // check the admin role themselves.
    isAdmin = false;
    if (currentUser) {
      try {
        isAdmin = await API.roles.isAdmin();
      } catch (_) { /* treat as not admin */ }
    }
    renderAdminButton();

    if (currentUser) {
      try {
        currentProfile = await API.profiles.get(currentUser.id);
      } catch (error) {
        console.error("Profile:", error);
      }
    }

    renderAccount();
    await renderProfile();
    window.dispatchEvent(new CustomEvent("pixora:account", { detail: { user: currentUser } }));
  }

  function renderAccount() {
    const name = currentProfile?.display_name || currentProfile?.username || "PIXORA member";
    const initial = (currentUser ? name : "G").charAt(0).toUpperCase();

    const mini = $(".user-mini");
    if (mini) {
      mini.innerHTML = `
        <span class="avatar avatar-you">${currentUser ? avatarInner(currentProfile, name) : "G"}</span>
        <span><b>${escapeHTML(currentUser ? name : "Guest")}</b>
        <small>${currentUser ? "Signed in" : "Guest account"}</small></span>
        <span class="more">···</span>`;
    }

    const avatar = $(".top-avatar");
    if (avatar) avatar.innerHTML = currentUser ? avatarInner(currentProfile, name) : "G";

    const profileName = $("#page-profile h1");
    if (profileName) profileName.textContent = currentUser ? name : "Guest";

    const profileAvatar = $(".profile-avatar");
    if (profileAvatar) profileAvatar.innerHTML = currentUser ? avatarInner(currentProfile, name) : "G";

    const handle = $(".profile-handle");
    if (handle) {
      handle.textContent = currentProfile
        ? "@" + currentProfile.username
        : "Sign in to access your profile";
    }

    const bio = $(".profile-bio");
    if (bio) bio.textContent = currentProfile?.bio || "";

    updateAuthButton();
  }

  function updateAuthButton() {
    let button = $("#accountAction");

    if (!button) {
      button = document.createElement("button");
      button.id = "accountAction";
      button.className = "outline-button";
      $(".top-actions")?.prepend(button);
    }
    if (!button) return;

    button.textContent = currentUser ? "Sign out" : "Sign in";

    button.onclick = async () => {
      if (!currentUser) {
        openAuth();
        return;
      }
      try {
        await API.auth.signOut();
        await refreshAccount();
        await loadFeed();
        toast("You have signed out.");
      } catch (error) {
        toast(error.message);
      }
    };
  }

  async function renderProfile() {
    const stats = $(".profile-stats");
    if (!stats) return;

    const stat = (value, label, id = "") =>
      `<span><b${id ? ` id="${id}"` : ""}>${value}</b> <small>${label}</small></span>`;

    if (!currentUser) {
      stats.innerHTML = stat("—", "Following") + stat("—", "Followers") + stat(0, "Saved", "savedCount");
      return;
    }

    try {
      const client = API.supabase;
      const [following, followers] = await Promise.all([
        client.from("follows").select("following_id", { count: "exact", head: true })
          .eq("follower_id", currentUser.id),
        client.from("follows").select("follower_id", { count: "exact", head: true })
          .eq("following_id", currentUser.id)
      ]);

      stats.innerHTML =
        stat(following.count ?? 0, "Following") +
        stat(followers.count ?? 0, "Followers") +
        stat(savedIds.length, "Saved", "savedCount");
    } catch (error) {
      console.error("Profile statistics:", error);
    }
  }

  /* ---------- publishing ---------- */

  let publishFiles = [];
  const previewUrls = [];
  const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"];
  const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

  function createPublishInterface() {
    if ($("#publishModal")) return;

    const modal = document.createElement("div");
    modal.id = "publishModal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="small-modal upload-modal">
        <button class="modal-close" data-close="publishModal" aria-label="Close">×</button>
        <div class="eyebrow">PIXORA</div>
        <h2>Upload to <span>PIXORA.</span></h2>
        <p>Share one image, up to 10 in a carousel, or a single video.</p>
        <div id="publishMessage" role="alert" hidden></div>
        <form id="publishForm" novalidate>
          <label>Media</label>
          <div class="drop-zone" id="dropZone" tabindex="0" role="button" aria-label="Choose files to upload">
            <span class="drop-icon">⬆</span>
            <b>Tap to choose, or drop files here</b>
            <small>JPG, PNG, WebP, GIF, MP4 or WebM · 50 MB each</small>
          </div>
          <input type="file" id="publishFilesInput" multiple hidden
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm">
          <div class="file-previews" id="filePreviews"></div>

          <label for="publishTitle">Title or caption</label>
          <textarea id="publishTitle" name="caption" maxlength="5000" rows="3" placeholder="Give your post a title"></textarea>

          <label for="publishCategory">Category</label>
          <select id="publishCategory" name="category"><option value="">Choose a category</option></select>

          <label>Tags</label>
          <div class="tag-input" id="tagBox">
            <span id="tagChips" style="display:contents"></span>
            <input id="tagEntry" type="text" maxlength="40" autocomplete="off" list="tagSuggestions"
              placeholder="Type a tag, press Enter">
            <datalist id="tagSuggestions"></datalist>
          </div>
          <small class="field-note">Add character names, series and styles, like “naruto uzumaki” or “anime”. Up to 15 tags help people find your post.</small>

          <div class="upload-actions">
            <button class="outline-button" type="button" id="clearUpload">Clear all</button>
            <button class="primary-button" type="submit" id="publishSubmit">Publish</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(modal);

    $("#publishForm").addEventListener("submit", submitPost);
    $("#clearUpload").addEventListener("click", () => {
      resetUpload();
      toast("Everything cleared.");
    });

    const zone = $("#dropZone");
    const input = $("#publishFilesInput");
    zone.addEventListener("click", () => input.click());
    zone.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", () => {
      addUploadFiles(input.files);
      input.value = "";            // lets you pick the same file again later
    });
    ["dragenter", "dragover"].forEach(type => zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.add("over");
    }));
    ["dragleave", "drop"].forEach(type => zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.remove("over");
    }));
    zone.addEventListener("drop", event => addUploadFiles(event.dataTransfer?.files));

    $("#filePreviews").addEventListener("click", event => {
      const remove = event.target.closest("[data-remove-file]");
      if (!remove) return;
      publishFiles.splice(Number(remove.dataset.removeFile), 1);
      renderFilePreviews();
    });

    setupTagInput();
    loadPublishCategories();
  }

  function showPublishMessage(text) {
    const box = $("#publishMessage");
    if (!box) return;
    box.hidden = !text;
    box.className = "auth-error";
    box.textContent = text || "";
  }

  function addUploadFiles(fileList) {
    showPublishMessage("");
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    for (const file of incoming) {
      if (!UPLOAD_TYPES.includes(file.type)) {
        showPublishMessage(`“${file.name}” isn't supported. Use JPG, PNG, WebP, GIF, MP4 or WebM.`);
        continue;
      }
      if (file.size <= 0 || file.size > UPLOAD_MAX_BYTES) {
        showPublishMessage(`“${file.name}” is too large. The limit is 50 MB per file.`);
        continue;
      }
      const isVideo = file.type.startsWith("video/");
      const hasVideo = publishFiles.some(f => f.type.startsWith("video/"));
      const hasImage = publishFiles.some(f => f.type.startsWith("image/"));
      if ((isVideo && (hasImage || hasVideo)) || (!isVideo && hasVideo)) {
        showPublishMessage("A post can be up to 10 images, or one video. Don't mix them.");
        continue;
      }
      if (publishFiles.length >= 10) {
        showPublishMessage("A post can have up to 10 files.");
        break;
      }
      publishFiles.push(file);
    }
    renderFilePreviews();
  }

  function renderFilePreviews() {
    previewUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
    const box = $("#filePreviews");
    if (!box) return;

    box.innerHTML = publishFiles.map((file, index) => {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      const media = file.type.startsWith("video/")
        ? `<video src="${url}" muted playsinline preload="metadata"></video>`
        : `<img src="${url}" alt="">`;
      return `<div class="file-tile">${media}
        <button type="button" data-remove-file="${index}" aria-label="Remove ${escapeHTML(file.name)}">×</button></div>`;
    }).join("");

    $("#dropZone")?.classList.toggle("has-files", publishFiles.length > 0);
  }

  // Empties every box in the upload form.
  function resetUpload() {
    publishFiles = [];
    renderFilePreviews();
    publishTags = [];
    renderTagChips();
    const form = $("#publishForm");
    if (form) form.reset();
    const entry = $("#tagEntry");
    if (entry) entry.value = "";
    showPublishMessage("");
  }

  function renderTagChips() {
    const box = $("#tagChips");
    if (!box) return;
    box.innerHTML = publishTags.map(tag => `
      <span class="tag-pill">#${escapeHTML(tag)}
        <button type="button" data-remove-tag="${escapeHTML(tag)}" aria-label="Remove ${escapeHTML(tag)}">×</button>
      </span>`).join("");
  }

  function addTagsFromText(text) {
    const cleaned = API.tags.clean(text);
    if (!cleaned.length) return false;
    publishTags = [...new Set([...publishTags, ...cleaned])].slice(0, 15);
    renderTagChips();
    return true;
  }

  function setupTagInput() {
    const entry = $("#tagEntry");
    if (!entry) return;
    let suggestTimer = null;

    entry.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        if (addTagsFromText(entry.value)) entry.value = "";
      } else if (event.key === "Backspace" && !entry.value && publishTags.length) {
        publishTags.pop();
        renderTagChips();
      }
    });

    entry.addEventListener("blur", () => {
      if (addTagsFromText(entry.value)) entry.value = "";
    });

    entry.addEventListener("input", () => {
      clearTimeout(suggestTimer);
      const text = entry.value.trim();
      if (text.length < 2) return;
      suggestTimer = setTimeout(async () => {
        try {
          const names = await API.tags.suggest(text);
          $("#tagSuggestions").innerHTML = names
            .map(name => `<option value="${escapeHTML(name)}"></option>`).join("");
        } catch (_) { /* suggestions are optional */ }
      }, 250);
    });

    $("#tagBox").addEventListener("click", event => {
      const remove = event.target.closest("[data-remove-tag]");
      if (remove) {
        publishTags = publishTags.filter(t => t !== remove.dataset.removeTag);
        renderTagChips();
        return;
      }
      entry.focus();
    });
  }

  async function loadPublishCategories() {
    if (!API) return;
    try {
      const list = categories.length ? categories : await API.categories.list();
      $('#publishForm [name="category"]').innerHTML =
        '<option value="">Choose a category</option>' +
        list.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join("");
    } catch (error) {
      console.error("Categories:", error);
    }
  }

  async function submitPost(event) {
    event.preventDefault();

    if (!currentUser) {
      toast("Sign in before publishing.");
      openAuth();
      return;
    }

    // Keep a reference: event.currentTarget is null after any await.
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const button = $("#publishSubmit");
    showPublishMessage("");

    if (!publishFiles.length) {
      showPublishMessage("Choose at least one image or video to upload.");
      return;
    }

    // Include a tag that was typed but not yet confirmed with Enter.
    const entry = $("#tagEntry");
    if (entry && addTagsFromText(entry.value)) entry.value = "";

    button.disabled = true;
    $("#clearUpload").disabled = true;
    button.textContent = "Uploading...";

    try {
      await API.posts.publish({
        files: publishFiles,
        caption: form.get("caption"),
        categoryId: form.get("category") || null,
        tags: publishTags,
        visibility: "public",
        allowComments: true,
        onProgress: text => { button.textContent = text; }
      });

      resetUpload();                       // every box is cleared after a successful post
      $("#publishModal").classList.remove("open");
      toast("Your post has been published.");

      await loadFeed();
      navigate("home");
    } catch (error) {
      showPublishMessage(error.message || "Could not publish your post.");
    } finally {
      button.disabled = false;
      $("#clearUpload").disabled = false;
      button.textContent = "Publish";
    }
  }

  function createPublishButton() {
    const actions = $(".top-actions");
    if (!actions || $("#openPublish")) return;

    const button = document.createElement("button");
    button.id = "openPublish";
    button.className = "primary-button";
    button.setAttribute("aria-label", "Create a post");
    button.innerHTML = '＋<span class="btn-label"> Create</span>';

    button.addEventListener("click", () => {
      if (!currentUser) {
        toast("Sign in before creating a post.");
        openAuth();
        return;
      }
      $("#publishModal").classList.add("open");
    });

    actions.prepend(button);
  }

  /* ---------- feed ---------- */

  const ICONS = {
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M20.8 5.6a5.4 5.4 0 0 0-7.6 0L12 6.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 22l7.6-7.6 1.2-1.2a5.4 5.4 0 0 0 0-7.6z"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>'
  };

  function postCard(post) {
    const creator = post.profiles || {};
    const creatorName = creator.display_name || creator.username || "PIXORA creator";
    const media = post.media?.[0];
    if (!media) return "";

    const id = escapeHTML(post.id);
    const saved = savedIds.includes(post.id);
    const liked = likedIds.includes(post.id);
    const category = post.categories?.[0]?.name || "Uncategorised";

    const mediaHTML = media.media_type === "video"
      ? `<video src="${escapeHTML(media.publicUrl)}" controls preload="metadata" playsinline></video>`
      : `<img loading="lazy" src="${escapeHTML(media.publicUrl)}"
           alt="${escapeHTML(media.alt_text || post.caption || "PIXORA post")}">`;

    return `
      <article class="pin-card" data-id="${id}">
        <div class="pin-image-wrap">
          ${mediaHTML}
          <button class="pin-round pin-eye" data-preview="${id}" aria-label="View">${ICONS.eye}</button>
          <button class="pin-round pin-heart ${liked ? "liked" : ""}" data-like="${id}"
            aria-label="${liked ? "Unlike" : "Like"}">${ICONS.heart}</button>
          <button class="pin-round pin-download" data-download="${id}" aria-label="Download">${ICONS.download}</button>
        </div>
        <div class="pin-caption">
          <b>${escapeHTML(post.caption || "Untitled post")}</b>
          <span class="pin-cat">${escapeHTML(category)}</span>
          <div class="pin-meta">
            <button class="creator-link" data-user="${escapeHTML(post.creator_id)}">
              <i class="mini-avatar">${avatarInner(creator, creatorName)}</i>
              <span class="name">${escapeHTML(creatorName)}</span>
            </button>
            <span class="pin-meta-right">
              <span class="pin-likes-count">♥ ${post.likeCount || 0}</span>
              <button class="save-chip ${saved ? "saved" : ""}" data-save="${id}">${saved ? "✓ Saved" : "＋ Save"}</button>
            </span>
          </div>
        </div>
      </article>`;
  }

  function renderFeed(target, items, emptyMessage) {
    const el = $(target);
    if (!el) return;

    if (!items.length) {
      el.innerHTML = `
        <div class="empty-state">
          <h3>Nothing here yet.</h3>
          <p>${escapeHTML(emptyMessage || "Be among the first to publish something on PIXORA.")}</p>
        </div>`;
      return;
    }

    el.innerHTML = items.map(postCard).join("");
  }

  const matchesCategory = (post) =>
    activeCategory === "All" ||
    post.categories?.some(c => c.name === activeCategory);

  function renderHome() {
    let items = posts.filter(matchesCategory);
    let emptyMessage;

    if (activeFeed === "Following") {
      if (!currentUser) {
        renderFeed("#homeGrid", [], "Sign in to see posts from people you follow.");
        return;
      }
      items = items.filter(p => followingIds.includes(p.creator_id));
      emptyMessage = "Posts from people you follow will appear here.";
    } else if (activeFeed === "Popular") {
      items = items.slice().sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    }

    renderFeed("#homeGrid", items, emptyMessage);
  }

  function renderDiscover() {
    const source = searchResults !== null ? searchResults : posts;
    const items = source.filter(matchesCategory);
    const sort = $("#sortSelect")?.value;

    if (sort === "Newest") {
      items.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    } else if (sort === "Most liked") {
      items.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    }

    renderFeed(
      "#discoverGrid",
      items,
      searchResults !== null ? `No posts match “${searchTerm}”. Try a character name, a series or a tag.` : undefined
    );
  }

  function renderSaved() {
    renderFeed("#savedGrid", savedPosts, "Posts you save will appear here.");
    const count = $("#savedCount");
    if (count) count.textContent = savedIds.length;
  }

  function renderAll() {
    renderHome();
    renderDiscover();
    renderSaved();

    const more = $("#loadMore")?.closest(".load-row");
    if (more) more.hidden = !hasMore;
  }

  async function loadUserData() {
    if (!currentUser) {
      savedIds = [];
      likedIds = [];
      followingIds = [];
      savedPosts = [];
      mutedIds = [];
      return;
    }

    [savedIds, likedIds, followingIds, mutedIds] = await Promise.all([
      API.saves.mine(),
      API.likes.mine(),
      API.follows.mine(),
      API.mutes.ids()
    ]);

    // Muted people are hidden from your feed (blocked people are hidden by the database).
    posts = posts.filter(p => !mutedIds.includes(p.creator_id));

    savedPosts = await API.posts.byIds(savedIds);
  }

  async function loadFeed() {
    if (!requireBackend()) return;

    // A load already running? Run once more when it finishes.
    if (loading) {
      queued = true;
      return;
    }
    loading = true;

    const home = $("#homeGrid");
    const discover = $("#discoverGrid");
    if (home && !posts.length) home.innerHTML = '<div class="empty-state"><p>Loading PIXORA posts...</p></div>';
    if (discover && !posts.length) discover.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

    try {
      posts = await API.posts.feed({ limit: visibleCount });
      hasMore = posts.length >= visibleCount;
      await loadUserData();
      renderAll();
      renderProfile();
    } catch (error) {
      console.error("Feed error:", error);
      const message = `
        <div class="empty-state">
          <h3>We couldn't load the feed.</h3>
          <p>${escapeHTML(error.message)}</p>
          <button class="outline-button" onclick="location.reload()">Try again</button>
        </div>`;
      if (home) home.innerHTML = message;
      if (discover) discover.innerHTML = message;
    } finally {
      loading = false;
      if (queued) {
        queued = false;
        loadFeed();
      }
    }
  }

  /* ---------- likes & saves ---------- */

  function findPost(id) {
    return posts.find(p => p.id === id) ||
      savedPosts.find(p => p.id === id) ||
      extraPosts.get(id);
  }

  async function toggleSave(postId) {
    if (!currentUser) {
      toast("Sign in to save posts.");
      openAuth();
      return;
    }
    try {
      const saved = await API.saves.toggle(postId);
      savedIds = saved ? [...new Set([...savedIds, postId])] : savedIds.filter(i => i !== postId);
      savedPosts = await API.posts.byIds(savedIds);
      renderAll();
      renderProfile();
      refreshOpenPreview(postId);
      toast(saved ? "Post saved." : "Post removed from saved items.");
    } catch (error) {
      toast(error.message);
    }
  }

  async function toggleLike(postId) {
    if (!currentUser) {
      toast("Sign in to like posts.");
      openAuth();
      return;
    }
    try {
      const liked = await API.likes.toggle(postId);
      likedIds = liked ? [...new Set([...likedIds, postId])] : likedIds.filter(i => i !== postId);

      const adjust = (post) => {
        if (post) post.likeCount = Math.max(0, (post.likeCount || 0) + (liked ? 1 : -1));
      };
      adjust(posts.find(p => p.id === postId));
      adjust(savedPosts.find(p => p.id === postId));
      adjust(extraPosts.get(postId));

      renderAll();
      refreshOpenPreview(postId);
    } catch (error) {
      toast(error.message);
    }
  }

  /* ---------- navigation, search, preview ---------- */

  function setCategory(category) {
    activeCategory = category;

    $$("[data-category]").forEach(b =>
      b.classList.toggle("selected", b.dataset.category === category));
    $$("[data-filter]").forEach(b =>
      b.classList.toggle("active", b.dataset.filter === category));

    renderHome();
    renderDiscover();
  }

  function setFeedTab(tab) {
    activeFeed = tab;
    $$("[data-feed]").forEach(b => b.classList.toggle("active", b.dataset.feed === tab));
    renderHome();
  }

  function navigate(page) {
    $$(".page").forEach(s => s.classList.toggle("active", s.id === "page-" + page));
    $$("[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    $("#sidebar")?.classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (page === "profile") renderSaved();
    if (page === "discover") renderDiscover();

    window.dispatchEvent(new CustomEvent("pixora:navigate", { detail: { page } }));
  }

  async function runSearch(query) {
    const text = String(query || "").trim();
    const token = ++searchToken;

    if (text.length < 2) {
      searchResults = null;
      searchTerm = "";
      renderDiscover();
      return;
    }

    searchTerm = text;
    const grid = $("#discoverGrid");
    if (grid) grid.innerHTML = '<div class="empty-state"><p>Searching...</p></div>';

    try {
      const results = await API.posts.search(text);
      if (token !== searchToken) return;   // a newer search is running
      results.forEach(p => extraPosts.set(p.id, p));
      searchResults = results;
    } catch (error) {
      if (token !== searchToken) return;
      console.error("Search:", error);
      // Fall back to searching what is already loaded.
      const q = text.toLowerCase();
      searchResults = posts.filter(post => {
        const creator = post.profiles || {};
        const cats = (post.categories || []).map(c => c.name).join(" ");
        const tags = (post.tags || []).map(t => t.name).join(" ");
        return [post.caption, creator.username, creator.display_name, cats, tags]
          .join(" ").toLowerCase().includes(q);
      });
    }

    renderDiscover();
  }

  function searchFor(text) {
    const input = $("#globalSearch");
    if (input) input.value = text;
    navigate("discover");
    runSearch(text);
  }

  let previewId = null;

  function previewHTML(post) {
    const media = post.media?.[0];
    if (!media) return "";

    const creator = post.profiles || {};
    const creatorName = creator.display_name || creator.username || "PIXORA creator";
    const liked = likedIds.includes(post.id);

    const mediaHTML = media.media_type === "video"
      ? `<video src="${escapeHTML(media.publicUrl)}" controls playsinline></video>`
      : `<img src="${escapeHTML(media.publicUrl)}" alt="${escapeHTML(media.alt_text || post.caption || "PIXORA post")}">`;

    return `
      <div class="preview-layout">
        ${mediaHTML}
        <div class="preview-copy">
          <span class="eyebrow">PIXORA DISCOVERY</span>
          <h2>${escapeHTML(post.caption || "PIXORA post")}</h2>
          <p>Shared by <button class="creator-link inline" data-user="${escapeHTML(post.creator_id)}"><b>${escapeHTML(creatorName)}</b></button></p>
          ${(post.tags || []).length ? `<div class="tag-row">${post.tags.map(t => `
            <button class="tag-chip" data-tag="${escapeHTML(t.name)}">#${escapeHTML(t.name)}</button>`).join("")}</div>` : ""}
          <div class="preview-actions">
            <button class="primary-button" data-save="${escapeHTML(post.id)}">
              ${savedIds.includes(post.id) ? "✓ Saved" : "＋ Save"}
            </button>
            <button class="like-button ${liked ? "liked" : ""}" data-like="${escapeHTML(post.id)}">
              ${liked ? "♥" : "♡"} ${post.likeCount || 0}
            </button>
            <button class="outline-button" data-download="${escapeHTML(post.id)}">↓ Download</button>
          </div>
        </div>
      </div>`;
  }

  function openPreview(id) {
    const post = findPost(id);
    if (!post?.media?.length) return;
    previewId = id;
    $("#previewContent").innerHTML = previewHTML(post);
    $("#previewModal").classList.add("open");
    window.dispatchEvent(new CustomEvent("pixora:preview", { detail: { post } }));
  }

  // Update the buttons in place so a half-written comment is not lost.
  function refreshOpenPreview(postId) {
    if (previewId !== postId || !$("#previewModal")?.classList.contains("open")) return;
    const post = findPost(postId);
    if (!post) return;

    const saveBtn = $('#previewContent [data-save]');
    if (saveBtn) saveBtn.textContent = savedIds.includes(postId) ? "✓ Saved" : "＋ Save";

    const likeBtn = $('#previewContent [data-like]');
    if (likeBtn) {
      const liked = likedIds.includes(postId);
      likeBtn.classList.toggle("liked", liked);
      likeBtn.textContent = `${liked ? "♥" : "♡"} ${post.likeCount || 0}`;
    }
  }

  /* ---------- events ---------- */

  document.addEventListener("click", event => {
    const close = event.target.closest("[data-close]");
    if (close) {
      $("#" + close.dataset.close)?.classList.remove("open");
      if (close.dataset.close === "previewModal") previewId = null;
      return;
    }

    const save = event.target.closest("[data-save]");
    if (save) {
      event.stopPropagation();
      toggleSave(save.dataset.save);
      return;
    }

    const eye = event.target.closest("[data-preview]");
    if (eye) {
      event.stopPropagation();
      openPreview(eye.dataset.preview);
      return;
    }

    const like = event.target.closest("[data-like]");
    if (like) {
      event.stopPropagation();
      toggleLike(like.dataset.like);
      return;
    }

    const page = event.target.closest("[data-page]");
    if (page) {
      navigate(page.dataset.page);
      return;
    }

    const tagButton = event.target.closest("[data-tag]");
    if (tagButton) {
      $("#previewModal")?.classList.remove("open");
      previewId = null;
      searchFor(tagButton.dataset.tag);
      return;
    }

    const tab = event.target.closest("[data-feed]");
    if (tab) {
      setFeedTab(tab.dataset.feed);
      return;
    }

    const category = event.target.closest("[data-category], [data-filter]");
    if (category) {
      setCategory(category.dataset.category || category.dataset.filter);
      return;
    }

    // Clicking a video's own controls or any other button/link should not open the preview.
    if (event.target.closest("video, button, a, input, textarea, select, label")) return;

    const card = event.target.closest(".pin-card");
    if (card) openPreview(card.dataset.id);
  });

  $("#sortSelect")?.addEventListener("change", renderDiscover);

  $("#globalSearch")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      clearTimeout(searchTimer);
      navigate("discover");
      runSearch(event.target.value);
    }
  });

  $("#globalSearch")?.addEventListener("input", event => {
    clearTimeout(searchTimer);
    const value = event.target.value;
    searchTimer = setTimeout(() => {
      if (value.trim().length >= 2) {
        if (!$("#page-discover").classList.contains("active")) navigate("discover");
        runSearch(value);
      } else if (!value.trim()) {
        runSearch("");
      }
    }, 400);
  });

  $("#loadMore")?.addEventListener("click", async () => {
    visibleCount += 24;
    await loadFeed();
  });

  $("#menuToggle")?.addEventListener("click", () => {
    $("#sidebar")?.classList.toggle("open");
  });

  $("#atmosphereBtn")?.addEventListener("click", () => {
    $("#atmosphereModal")?.classList.add("open");
  });

  $$("[data-atmo]").forEach(button => {
    button.addEventListener("click", () => {
      $$("[data-atmo]").forEach(i => i.classList.remove("selected"));
      button.classList.add("selected");
    });
  });

  $("#applyAtmosphere")?.addEventListener("click", () => {
    const selected = $(".atmo-option.selected");
    if (!selected) return;

    const mode = selected.dataset.atmo;
    document.body.dataset.atmosphere = mode === "default" ? "" : mode;

    try {
      localStorage.setItem("pixoraAtmosphere", mode);
    } catch (_) { /* storage may be blocked */ }

    $("#atmosphereModal")?.classList.remove("open");
    toast("Your PIXORA atmosphere has been updated.");
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $$(".modal-backdrop.open").forEach(m => m.classList.remove("open"));
      previewId = null;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#globalSearch")?.focus();
    }
  });

  /* ---------- hooks used by features.js ---------- */

  window.PIXORA_APP = Object.freeze({
    escapeHTML,
    avatarInner,
    toast,
    openAuth: () => openAuth("login"),
    navigate,
    searchFor,
    refreshAccount,
    openPreview,
    refreshFeed: () => loadFeed(),
    getState: () => ({
      user: currentUser,
      profile: currentProfile,
      isAdmin,
      mutedIds: mutedIds.slice(),
      followingIds: followingIds.slice(),
      savedIds: savedIds.slice(),
      likedIds: likedIds.slice()
    }),
    findPost,
    registerPosts: (list = []) => list.forEach(p => extraPosts.set(p.id, p)),
    cardsHTML: (list = []) => list.map(postCard).join(""),
    renderInto: (target, list, emptyMessage) => {
      (list || []).forEach(p => extraPosts.set(p.id, p));
      renderFeed(target, list || [], emptyMessage);
    },
    renderSavedGrid: renderSaved,
    setFollowing: (userId, following) => {
      followingIds = following
        ? [...new Set([...followingIds, userId])]
        : followingIds.filter(i => i !== userId);
      renderHome();
      renderProfile();
    }
  });

  function loadFeatures() {
    if (document.querySelector('script[data-pixora-features]')) return;
    const script = document.createElement("script");
    script.src = "features.js";
    script.dataset.pixoraFeatures = "1";
    script.onerror = () => console.warn("PIXORA: features.js was not found.");
    document.body.appendChild(script);
  }

  /* ---------- initialize ---------- */

  async function initialize() {
    injectStyles();
    loadFeatures();
    createAuthInterface();
    createPublishInterface();
    createPublishButton();

    try {
      const savedAtmosphere = localStorage.getItem("pixoraAtmosphere");
      if (savedAtmosphere && savedAtmosphere !== "default") {
        document.body.dataset.atmosphere = savedAtmosphere;
      }
    } catch (_) { /* storage may be blocked */ }

    if (!requireBackend()) return;

    try {
      if (window.PIXORA_RECOVERY) openAuth("reset");
      await loadCategoryChips();
      await loadPublishCategories();
      await refreshAccount();
      await loadFeed();
      console.info("PIXORA live frontend initialized.");
    } catch (error) {
      console.error("PIXORA initialization:", error);
      toast("PIXORA could not finish loading. Check your connection.");
    }
  }

  initialize();

  // React only to real sign-in / sign-out changes (the auth library also fires
  // events on startup and when the tab regains focus).
  window.addEventListener("pixora:auth", async event => {
    const { event: type, user } = event.detail || {};

    if (type === "PASSWORD_RECOVERY") {
      openAuth("reset");
      return;
    }
    if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(type)) return;
    if ((user?.id || null) === (currentUser?.id || null) && type !== "USER_UPDATED") return;

    try {
      await refreshAccount();
      await loadFeed();
    } catch (error) {
      console.error("Authentication update:", error);
    }
  });
})();
