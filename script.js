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
      .empty-state{column-span:all;grid-column:1/-1;text-align:center;padding:42px 20px;border:1px dashed var(--line);border-radius:14px;background:#110c0f;color:var(--muted)}
      .empty-state h3{font:700 17px Manrope,sans-serif;color:var(--text);margin:0 0 8px}
      .empty-state p{margin:0 0 14px;font-size:12px;line-height:1.6}
      .small-modal form label{display:block;margin:15px 0 6px;font-size:11px;color:#d8c4cd}
      .small-modal form input:not([type=file]),.small-modal form textarea,.small-modal form select{width:100%;background:#0d090c;border:1px solid var(--line);border-radius:9px;padding:12px;color:var(--text);font-size:13px}
      .small-modal form input[type=file]{width:100%;color:var(--muted);font-size:12px}
      .small-modal form textarea{resize:vertical;min-height:90px}
      .small-modal form small{display:block;margin-top:6px;color:var(--faint);font-size:10px}
      .small-modal form .primary-button{margin-top:20px;padding:13px}
      .small-modal .text-button{font-size:12px}
      .pin-card video,.preview-layout video{width:100%;display:block;background:#000;max-height:520px}
      .preview-layout img,.preview-layout video{width:100%;height:100%;min-height:390px;object-fit:cover}
      .like-button{border:0;background:none;color:#c9aeb8;font-size:10px;padding:2px 0;display:inline-flex;align-items:center;gap:4px}
      .like-button.liked{color:#ff6f95}
      .pin-caption small{display:block;margin-top:6px;color:#7d6e75;font-size:9px}
      .preview-actions{display:flex;gap:10px;align-items:center;margin-top:14px}
      #accountAction{padding:9px 12px;font-size:11px}
      #openPublish{padding:10px 14px}
      .load-row[hidden]{display:none}
      @media(max-width:760px){
        #openPublish .btn-label{display:none}
        #openPublish{padding:0;width:32px;height:32px;font-size:16px}
        #accountAction{padding:7px 9px;font-size:10px}
        .preview-layout video{height:260px;min-height:0}
      }`;
    document.head.appendChild(style);
  }

  /* ---------- remove demo content ---------- */

  function cleanDemoInterface() {
    const demoAdmin = $("#page-admin");
    if (demoAdmin) {
      demoAdmin.innerHTML = `
        <div class="page-heading">
          <div class="eyebrow">PIXORA CONTROL ROOM</div>
          <h1>Admin <span>access.</span></h1>
          <p class="subheading">Administration is restricted to authorized accounts.</p>
        </div>
        <div class="admin-warning">Admin tools are not publicly available.</div>`;
    }

    const emptyBox = (title, text) =>
      `<div class="empty-state"><h3>${title}</h3><p>${text}</p></div>`;

    const notifications = $("#page-notifications .notification-list");
    if (notifications) {
      notifications.innerHTML = emptyBox(
        "Your activity will appear here.",
        "You don't have any notifications to display yet."
      );
    }

    const collections = $("#page-collections .collection-grid");
    if (collections) {
      collections.innerHTML = emptyBox(
        "Your collections will live here.",
        "Collection management is being connected to your account."
      );
    }

    const chatPanel = $("#chatPanel");
    if (chatPanel) {
      chatPanel.innerHTML = `
        <div class="chat-empty">
          <span class="empty-icon">✉</span>
          <h3>Your conversations live here.</h3>
          <p>Real messaging is being connected.</p>
        </div>`;
    }

    const conversationList = $("#conversationList");
    if (conversationList) {
      conversationList.innerHTML = emptyBox("", "No conversations to display yet.");
    }

    $('footer [data-page="admin"]')?.remove();
    $(".nav-count")?.remove();
    $(".notification-dot")?.remove();
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
        <button class="modal-close" data-close="authModal">×</button>
        <div class="eyebrow">YOUR PIXORA ACCOUNT</div>
        <h2 id="authTitle">Welcome <span>back.</span></h2>
        <p id="authDescription">Sign in to continue exploring PIXORA.</p>
        <form id="authForm">
          <div id="usernameField" hidden>
            <label>Username</label>
            <input name="username" type="text" minlength="3" maxlength="30" autocomplete="username">
          </div>
          <div id="displayNameField" hidden>
            <label>Display name</label>
            <input name="displayName" type="text" maxlength="80">
          </div>
          <label>Email address</label>
          <input name="email" type="email" required autocomplete="email">
          <label>Password</label>
          <input name="password" type="password" minlength="8" required autocomplete="current-password">
          <button type="submit" class="primary-button full-button" id="authSubmit">Sign in</button>
        </form>
        <p><button class="text-button" id="authSwitch" type="button">Don't have an account? Create one.</button></p>
      </div>`;
    document.body.appendChild(modal);

    $("#authForm").addEventListener("submit", submitAuth);
    $("#authSwitch").addEventListener("click", () =>
      setAuthMode(authMode === "login" ? "signup" : "login")
    );
  }

  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === "signup";

    $("#authTitle").innerHTML = signup ? "Join <span>PIXORA.</span>" : "Welcome <span>back.</span>";
    $("#authDescription").textContent = signup
      ? "Create your account and start sharing."
      : "Sign in to continue exploring PIXORA.";
    $("#authSubmit").textContent = signup ? "Create account" : "Sign in";
    $("#usernameField").hidden = !signup;
    $("#displayNameField").hidden = !signup;
    $("#authSwitch").textContent = signup
      ? "Already have an account? Sign in."
      : "Don't have an account? Create one.";

    const username = $('#authForm [name="username"]');
    if (username) username.required = signup;

    $('#authForm [name="password"]').autocomplete = signup
      ? "new-password"
      : "current-password";
  }

  function openAuth() {
    if (!requireBackend()) return;
    setAuthMode("login");
    $("#authModal").classList.add("open");
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!requireBackend()) return;

    // Keep a reference: event.currentTarget is null after any await.
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const button = $("#authSubmit");

    button.disabled = true;
    button.textContent = "Please wait...";

    try {
      if (authMode === "signup") {
        const result = await API.auth.signUp({
          email: form.get("email"),
          password: form.get("password"),
          username: form.get("username"),
          displayName: form.get("displayName")
        });
        toast(result.session
          ? "Your PIXORA account has been created."
          : "Account created. Check your email if confirmation is required.");
      } else {
        await API.auth.signIn({
          email: form.get("email"),
          password: form.get("password")
        });
        toast("Welcome back to PIXORA.");
      }

      $("#authModal").classList.remove("open");
      formEl.reset();

      await refreshAccount();
      await loadFeed();
    } catch (error) {
      toast(error.message || "Authentication failed.");
    } finally {
      button.disabled = false;
      button.textContent = authMode === "signup" ? "Create account" : "Sign in";
    }
  }

  async function refreshAccount() {
    if (!API) return;

    const session = await API.auth.getSession();
    currentUser = session?.user || null;
    currentProfile = null;

    if (currentUser) {
      try {
        currentProfile = await API.profiles.get(currentUser.id);
      } catch (error) {
        console.error("Profile:", error);
      }
    }

    renderAccount();
    await renderProfile();
  }

  function renderAccount() {
    const name = currentProfile?.display_name || currentProfile?.username || "PIXORA member";
    const initial = (currentUser ? name : "G").charAt(0).toUpperCase();

    const mini = $(".user-mini");
    if (mini) {
      mini.innerHTML = `
        <span class="avatar avatar-you">${escapeHTML(initial)}</span>
        <span><b>${escapeHTML(currentUser ? name : "Guest")}</b>
        <small>${currentUser ? "Signed in" : "Guest account"}</small></span>
        <span class="more">···</span>`;
    }

    const avatar = $(".top-avatar");
    if (avatar) avatar.textContent = initial;

    const profileName = $("#page-profile h1");
    if (profileName) profileName.textContent = currentUser ? name : "Guest";

    const profileAvatar = $(".profile-avatar");
    if (profileAvatar) profileAvatar.textContent = initial;

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

  function createPublishInterface() {
    if ($("#publishModal")) return;

    const modal = document.createElement("div");
    modal.id = "publishModal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="small-modal">
        <button class="modal-close" data-close="publishModal">×</button>
        <div class="eyebrow">CREATE SOMETHING</div>
        <h2>Share with <span>PIXORA.</span></h2>
        <p>Publish images, videos or a carousel.</p>
        <form id="publishForm">
          <label>Select media</label>
          <input type="file" name="files" multiple required
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm">
          <small>Up to 10 images, or one video. Each file must be 50 MB or less.</small>
          <label>Caption</label>
          <textarea name="caption" maxlength="5000" rows="4" placeholder="Tell the world about your post..."></textarea>
          <label>Category</label>
          <select name="category"><option value="">Choose a category</option></select>
          <button class="primary-button full-button" type="submit" id="publishSubmit">Publish post</button>
        </form>
      </div>`;
    document.body.appendChild(modal);

    $("#publishForm").addEventListener("submit", submitPost);
    loadPublishCategories();
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
    const files = form.getAll("files").filter(f => f instanceof File && f.size > 0);
    const button = $("#publishSubmit");

    button.disabled = true;
    button.textContent = "Uploading and publishing...";

    try {
      await API.posts.publish({
        files,
        caption: form.get("caption"),
        categoryId: form.get("category") || null,
        visibility: "public",
        allowComments: true
      });

      $("#publishModal").classList.remove("open");
      formEl.reset();
      toast("Your post has been published.");

      await loadFeed();
      navigate("home");
    } catch (error) {
      toast(error.message || "Could not publish your post.");
    } finally {
      button.disabled = false;
      button.textContent = "Publish post";
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

  function postCard(post) {
    const creator = post.profiles || {};
    const creatorName = creator.display_name || creator.username || "PIXORA creator";
    const media = post.media?.[0];
    if (!media) return "";

    const saved = savedIds.includes(post.id);
    const liked = likedIds.includes(post.id);
    const category = post.categories?.[0]?.name || "PIXORA";

    const mediaHTML = media.media_type === "video"
      ? `<video src="${escapeHTML(media.publicUrl)}" controls preload="metadata" playsinline></video>`
      : `<img loading="lazy" src="${escapeHTML(media.publicUrl)}"
           alt="${escapeHTML(media.alt_text || post.caption || "PIXORA post")}">`;

    return `
      <article class="pin-card" data-id="${escapeHTML(post.id)}">
        <div class="pin-image-wrap">
          ${mediaHTML}
          <div class="pin-overlay"></div>
          <button class="save-button ${saved ? "saved" : ""}" data-save="${escapeHTML(post.id)}">
            ${saved ? "✓ Saved" : "＋ Save"}
          </button>
        </div>
        <div class="pin-caption">
          <b>${escapeHTML(post.caption || "Untitled post")}</b>
          <div class="pin-meta">
            <span class="pin-creator">
              <i class="mini-avatar">${escapeHTML(creatorName.charAt(0).toUpperCase())}</i>
              ${escapeHTML(creatorName)}
            </span>
            <button class="like-button ${liked ? "liked" : ""}" data-like="${escapeHTML(post.id)}"
              aria-label="${liked ? "Unlike" : "Like"}">
              ${liked ? "♥" : "♡"} ${post.likeCount || 0}
            </button>
          </div>
          <small>${escapeHTML(formatDate(post.published_at))} · ${escapeHTML(category)}</small>
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
    const items = posts.filter(matchesCategory);
    const sort = $("#sortSelect")?.value;

    if (sort === "Newest") {
      items.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    } else if (sort === "Most liked") {
      items.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    }

    renderFeed("#discoverGrid", items);
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
      return;
    }

    [savedIds, likedIds, followingIds] = await Promise.all([
      API.saves.mine(),
      API.likes.mine(),
      API.follows.mine()
    ]);

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
    return posts.find(p => p.id === id) || savedPosts.find(p => p.id === id);
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

      for (const list of [posts, savedPosts]) {
        const post = list.find(p => p.id === postId);
        if (post) post.likeCount = Math.max(0, (post.likeCount || 0) + (liked ? 1 : -1));
      }

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
  }

  function searchPosts(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      renderDiscover();
      return;
    }

    const results = posts.filter(post => {
      const creator = post.profiles || {};
      const cats = (post.categories || []).map(c => c.name).join(" ");
      return [post.caption, creator.username, creator.display_name, cats]
        .join(" ").toLowerCase().includes(q);
    });

    renderFeed("#discoverGrid", results, "No posts match your search.");
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
          <p>Shared by <b>${escapeHTML(creatorName)}</b></p>
          <div class="preview-actions">
            <button class="primary-button" data-save="${escapeHTML(post.id)}">
              ${savedIds.includes(post.id) ? "✓ Saved" : "＋ Save"}
            </button>
            <button class="like-button ${liked ? "liked" : ""}" data-like="${escapeHTML(post.id)}">
              ${liked ? "♥" : "♡"} ${post.likeCount || 0}
            </button>
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
  }

  function refreshOpenPreview(postId) {
    if (previewId !== postId || !$("#previewModal")?.classList.contains("open")) return;
    const post = findPost(postId);
    if (post) $("#previewContent").innerHTML = previewHTML(post);
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

    // Clicking a video's own controls should not open the preview.
    if (event.target.closest("video")) return;

    const card = event.target.closest(".pin-card");
    if (card) openPreview(card.dataset.id);
  });

  $("#sortSelect")?.addEventListener("change", renderDiscover);

  $("#globalSearch")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      navigate("discover");
      searchPosts(event.target.value);
    }
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

  $("#editProfile")?.addEventListener("click", () => {
    if (!currentUser) {
      openAuth();
      return;
    }
    toast("Profile editing is the next integration stage.");
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

  /* ---------- initialize ---------- */

  async function initialize() {
    injectStyles();
    cleanDemoInterface();
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
