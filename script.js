
/* =========================================================
   PIXORA — LIVE FRONTEND
   Current project: YoungProdigy5/rework
   Uses backend.js and the CURRENT PIXORA Supabase project.
========================================================= */

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const API = window.PIXORA;

  let posts = [];
  let savedIds = [];
  let currentUser = null;
  let currentProfile = null;
  let activeCategory = "All";
  let visibleCount = 24;
  let loading = false;

  const escapeHTML = (value = "") =>
    String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function toast(message) {
    const element = $("#toast");
    if (!element) return;

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toast.timer);
    toast.timer = setTimeout(
      () => element.classList.remove("show"),
      3000
    );
  }

  function formatDate(value) {
    if (!value) return "";

    return new Date(value).toLocaleDateString(
      undefined,
      { day: "numeric", month: "short" }
    );
  }

  function requireBackend() {
    if (!API) {
      toast("PIXORA backend could not load. Refresh the page.");
      return false;
    }

    return true;
  }

  /* =====================================================
     REMOVE DEMO CONTENT
  ===================================================== */

  function cleanDemoInterface() {
    const demoAdmin = $("#page-admin");

    if (demoAdmin) {
      demoAdmin.innerHTML = `
        <div class="page-heading">
          <div class="eyebrow">PIXORA CONTROL ROOM</div>
          <h1>Admin <span>access.</span></h1>
          <p class="subheading">
            Administration is restricted to authorized accounts.
          </p>
        </div>
        <div class="admin-warning">
          Admin tools are not publicly available.
        </div>
      `;
    }

    const notifications = $(
      "#page-notifications .notification-list"
    );

    if (notifications) {
      notifications.innerHTML = `
        <div class="empty-state">
          <h3>Your activity will appear here.</h3>
          <p>You don't have any notifications to display yet.</p>
        </div>
      `;
    }

    const collections = $("#page-collections .collection-grid");

    if (collections) {
      collections.innerHTML = `
        <div class="empty-state">
          <h3>Your collections will live here.</h3>
          <p>Collection management is being connected to your account.</p>
        </div>
      `;
    }

    const chatPanel = $("#chatPanel");

    if (chatPanel) {
      chatPanel.innerHTML = `
        <div class="chat-empty">
          <span class="empty-icon">✉</span>
          <h3>Your conversations live here.</h3>
          <p>Real messaging is being connected.</p>
        </div>
      `;
    }

    const conversationList = $("#conversationList");

    if (conversationList) {
      conversationList.innerHTML = `
        <div class="empty-state">
          <p>No conversations to display yet.</p>
        </div>
      `;
    }

    const adminLink = $('footer [data-page="admin"]');

    if (adminLink) {
      adminLink.remove();
    }

    const messageCount = $(".nav-count");

    if (messageCount) messageCount.remove();

    const notificationDot = $(".notification-dot");

    if (notificationDot) notificationDot.remove();

    const fakeStats = $$(".profile-stats span");

    if (fakeStats.length >= 2) {
      fakeStats[0].innerHTML =
        '<b id="followingCount">—</b> <small>Following</small>';

      fakeStats[1].innerHTML =
        '<b id="followersCount">—</b> <small>Followers</small>';
    }
  }

  /* =====================================================
     AUTHENTICATION INTERFACE
  ===================================================== */

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

        <p id="authDescription">
          Sign in to continue exploring PIXORA.
        </p>

        <form id="authForm">

          <div id="usernameField" hidden>
            <label>Username</label>
            <input
              name="username"
              type="text"
              minlength="3"
              maxlength="30"
              autocomplete="username"
            >
          </div>

          <div id="displayNameField" hidden>
            <label>Display name</label>
            <input
              name="displayName"
              type="text"
              maxlength="80"
            >
          </div>

          <label>Email address</label>
          <input
            name="email"
            type="email"
            required
            autocomplete="email"
          >

          <label>Password</label>
          <input
            name="password"
            type="password"
            minlength="8"
            required
            autocomplete="current-password"
          >

          <button
            type="submit"
            class="primary-button full-button"
            id="authSubmit"
          >
            Sign in
          </button>

        </form>

        <p>
          <button class="text-button" id="authSwitch">
            Don't have an account? Create one.
          </button>
        </p>
      </div>
    `;

    document.body.appendChild(modal);

    $("#authForm").addEventListener(
      "submit",
      submitAuth
    );

    $("#authSwitch").addEventListener(
      "click",
      () => setAuthMode(
        authMode === "login" ? "signup" : "login"
      )
    );
  }

  let authMode = "login";

  function setAuthMode(mode) {
    authMode = mode;

    const signup = mode === "signup";

    $("#authTitle").innerHTML = signup
      ? 'Join <span>PIXORA.</span>'
      : 'Welcome <span>back.</span>';

    $("#authDescription").textContent = signup
      ? "Create your account and start sharing."
      : "Sign in to continue exploring PIXORA.";

    $("#authSubmit").textContent = signup
      ? "Create account"
      : "Sign in";

    $("#usernameField").hidden = !signup;
    $("#displayNameField").hidden = !signup;

    $("#authSwitch").textContent = signup
      ? "Already have an account? Sign in."
      : "Don't have an account? Create one.";

    const password = $('#authForm [name="password"]');

    password.autocomplete = signup
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

    const form = new FormData(event.currentTarget);

    const email = form.get("email");
    const password = form.get("password");

    const button = $("#authSubmit");

    button.disabled = true;
    button.textContent = "Please wait...";

    try {
      if (authMode === "signup") {
        const result = await API.auth.signUp({
          email,
          password,
          username: form.get("username"),
          displayName: form.get("displayName")
        });

        if (!result.session) {
          toast(
            "Account created. Check your email if confirmation is required."
          );
        } else {
          toast("Your PIXORA account has been created.");
        }
      } else {
        await API.auth.signIn({
          email,
          password
        });

        toast("Welcome back to PIXORA.");
      }

      $("#authModal").classList.remove("open");

      await refreshAccount();

      event.currentTarget.reset();

    } catch (error) {
      toast(error.message || "Authentication failed.");
    } finally {
      button.disabled = false;

      button.textContent =
        authMode === "signup"
          ? "Create account"
          : "Sign in";
    }
  }

  async function refreshAccount() {
    if (!API) return;

    const session = await API.auth.getSession();

    currentUser = session?.user || null;
    currentProfile = null;

    if (currentUser) {
      currentProfile = await API.profiles.get(
        currentUser.id
      );
    }

    renderAccount();
    renderProfile();
  }

  function renderAccount() {
    const name = currentProfile?.display_name ||
      currentProfile?.username ||
      "PIXORA member";

    const initial = name.charAt(0).toUpperCase();

    const mini = $(".user-mini");

    if (mini) {
      mini.innerHTML = `
        <span class="avatar avatar-you">
          ${escapeHTML(initial)}
        </span>

        <span>
          <b>${escapeHTML(name)}</b>
          <small>
            ${currentUser ? "Signed in" : "Guest account"}
          </small>
        </span>

        <span class="more">···</span>
      `;
    }

    const avatar = $(".top-avatar");

    if (avatar) avatar.textContent = initial;

    const profileName = $("#page-profile h1");

    if (profileName) {
      profileName.textContent = currentUser
        ? name
        : "Guest";
    }

    const handle = $(".profile-handle");

    if (handle) {
      handle.textContent = currentProfile
        ? "@" + currentProfile.username
        : "Sign in to access your profile";
    }

    const bio = $(".profile-bio");

    if (bio) {
      bio.textContent = currentProfile?.bio || "";
    }

    updateAuthButton();
  }

  function updateAuthButton() {
    let button = $("#accountAction");

    if (!button) {
      button = document.createElement("button");

      button.id = "accountAction";
      button.className = "outline-button";

      const actions = $(".top-actions");

      if (actions) actions.prepend(button);
    }

    if (!button) return;

    button.textContent = currentUser
      ? "Sign out"
      : "Sign in";

    button.onclick = async () => {
      if (!currentUser) {
        openAuth();
        return;
      }

      try {
        await API.auth.signOut();

        currentUser = null;
        currentProfile = null;
        savedIds = [];

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

    if (!currentUser) {
      stats.innerHTML = `
        <span><b>—</b> <small>Following</small></span>
        <span><b>—</b> <small>Followers</small></span>
        <span><b>0</b> <small>Saved</small></span>
      `;

      return;
    }

    try {
      const client = API.supabase;

      const [following, followers] = await Promise.all([
        client.from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", currentUser.id),

        client.from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", currentUser.id)
      ]);

      stats.innerHTML = `
        <span>
          <b>${following.count ?? 0}</b>
          <small>Following</small>
        </span>

        <span>
          <b>${followers.count ?? 0}</b>
          <small>Followers</small>
        </span>

        <span>
          <b>${savedIds.length}</b>
          <small>Saved</small>
        </span>
      `;

    } catch (error) {
      console.error("Profile statistics:", error);
    }
  }

  /* =====================================================
     PUBLISHING INTERFACE
  ===================================================== */

  function createPublishInterface() {
    if ($("#publishModal")) return;

    const modal = document.createElement("div");

    modal.id = "publishModal";
    modal.className = "modal-backdrop";

    modal.innerHTML = `
      <div class="small-modal">

        <button class="modal-close" data-close="publishModal">
          ×
        </button>

        <div class="eyebrow">CREATE SOMETHING</div>

        <h2>Share with <span>PIXORA.</span></h2>

        <p>Publish images, videos or a carousel.</p>

        <form id="publishForm">

          <label>Select media</label>

          <input
            type="file"
            name="files"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            multiple
            required
          >

          <small>
            Maximum 10 files. Each file must be 50 MB or less.
          </small>

          <label>Caption</label>

          <textarea
            name="caption"
            maxlength="5000"
            rows="4"
            placeholder="Tell the world about your post..."
          ></textarea>

          <label>Category</label>

          <select name="category">
            <option value="">Choose a category</option>
          </select>

          <button
            class="primary-button full-button"
            type="submit"
            id="publishSubmit"
          >
            Publish post
          </button>

        </form>

      </div>
    `;

    document.body.appendChild(modal);

    $("#publishForm").addEventListener(
      "submit",
      submitPost
    );

    loadPublishCategories();
  }

  async function loadPublishCategories() {
    if (!API) return;

    try {
      const categories = await API.categories.list();

      const select = $('#publishForm [name="category"]');

      select.innerHTML =
        '<option value="">Choose a category</option>' +
        categories.map(category => `
          <option value="${escapeHTML(category.id)}">
            ${escapeHTML(category.name)}
          </option>
        `).join("");

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

    const form = new FormData(event.currentTarget);

    const files = form.getAll("files").filter(
      file => file instanceof File && file.size > 0
    );

    const button = $("#publishSubmit");

    button.disabled = true;
    button.textContent = "Uploading and publishing...";

    try {
      const category = form.get("category");

      await API.posts.publish({
        files,
        caption: form.get("caption"),
        categoryId: category || null,
        visibility: "public",
        allowComments: true
      });

      $("#publishModal").classList.remove("open");

      event.currentTarget.reset();

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
    button.textContent = "+ Create";

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

  /* =====================================================
     REAL DATABASE FEED
  ===================================================== */

  function postCard(post) {
    const creator = post.profiles || {};

    const creatorName =
      creator.display_name ||
      creator.username ||
      "PIXORA creator";

    const media = post.media?.[0];

    if (!media) return "";

    const isVideo = media.media_type === "video";

    const saved = savedIds.includes(post.id);

    const mediaHTML = isVideo
      ? `
        <video
          src="${escapeHTML(media.publicUrl)}"
          controls
          preload="metadata"
          playsinline
        ></video>
      `
      : `
        <img
          loading="lazy"
          src="${escapeHTML(media.publicUrl)}"
          alt="${escapeHTML(media.alt_text || post.caption || "PIXORA post")}"
        >
      `;

    const category = post.categories?.[0]?.name || "PIXORA";

    return `
      <article class="pin-card" data-id="${escapeHTML(post.id)}">

        <div class="pin-image-wrap">
          ${mediaHTML}

          <div class="pin-overlay"></div>

          <button
            class="save-button ${saved ? "saved" : ""}"
            data-save="${escapeHTML(post.id)}"
          >
            ${saved ? "✓ Saved" : "＋ Save"}
          </button>
        </div>

        <div class="pin-caption">

          <b>${escapeHTML(post.caption || "Untitled post")}</b>

          <div class="pin-meta">

            <span class="pin-creator">
              <i class="mini-avatar">
                ${escapeHTML(creatorName.charAt(0).toUpperCase())}
              </i>

              ${escapeHTML(creatorName)}
            </span>

            <span class="pin-likes">
              ${escapeHTML(category)}
            </span>

          </div>

          <small>${formatDate(post.published_at)}</small>

        </div>

      </article>
    `;
  }

  function renderFeed(target, items) {
    const element = $(target);

    if (!element) return;

    if (!items.length) {
      element.innerHTML = `
        <div class="empty-state">
          <h3>Nothing here yet.</h3>
          <p>Be among the first to publish something on PIXORA.</p>
        </div>
      `;

      return;
    }

    element.innerHTML = items.map(postCard).join("");
  }

  async function loadFeed() {
    if (!requireBackend() || loading) return;

    loading = true;

    const home = $("#homeGrid");
    const discover = $("#discoverGrid");

    if (home) home.innerHTML = "<p>Loading PIXORA posts...</p>";
    if (discover) discover.innerHTML = "<p>Loading...</p>";

    try {
      posts = await API.posts.feed({
        limit: visibleCount
      });

      await loadSavedIds();

      renderHome();
      renderDiscover();
      renderSaved();
      renderProfile();

    } catch (error) {
      console.error("Feed error:", error);

      const message = `
        <div class="empty-state">
          <h3>We couldn't load the feed.</h3>
          <p>${escapeHTML(error.message)}</p>
          <button class="outline-button" onclick="location.reload()">
            Try again
          </button>
        </div>
      `;

      if (home) home.innerHTML = message;
      if (discover) discover.innerHTML = message;

    } finally {
      loading = false;
    }
  }

  function renderHome() {
    const items = posts.filter(post =>
      activeCategory === "All" ||
      post.categories?.some(
        category => category.name === activeCategory
      )
    );

    renderFeed("#homeGrid", items);
  }

  function renderDiscover() {
    let items = posts.filter(post =>
      activeCategory === "All" ||
      post.categories?.some(
        category => category.name === activeCategory
      )
    );

    const sort = $("#sortSelect")?.value;

    if (sort === "Newest") {
      items.sort((a, b) =>
        new Date(b.published_at) - new Date(a.published_at)
      );
    }

    renderFeed("#discoverGrid", items);
  }

  /* =====================================================
     REAL SAVES
  ===================================================== */

  async function loadSavedIds() {
    if (!currentUser) {
      savedIds = [];
      return;
    }

    const { data, error } = await API.supabase
      .from("saves")
      .select("post_id")
      .eq("user_id", currentUser.id);

    if (error) throw error;

    savedIds = (data || []).map(row => row.post_id);
  }

  async function toggleSave(postId) {
    if (!currentUser) {
      toast("Sign in to save posts.");
      openAuth();
      return;
    }

    try {
      const saved = await API.saves.toggle(postId);

      await loadSavedIds();

      renderHome();
      renderDiscover();
      renderSaved();
      renderProfile();

      toast(saved ? "Post saved." : "Post removed from saved items.");

    } catch (error) {
      toast(error.message);
    }
  }

  function renderSaved() {
    const savedPosts = posts.filter(
      post => savedIds.includes(post.id)
    );

    renderFeed("#savedGrid", savedPosts);

    const count = $("#savedCount");

    if (count) count.textContent = savedIds.length;
  }

  /* =====================================================
     SEARCH AND NAVIGATION
  ===================================================== */

  function setCategory(category) {
    activeCategory = category;

    $$("[data-category]").forEach(button => {
      button.classList.toggle(
        "selected",
        button.dataset.category === category
      );
    });

    $$("[data-filter]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.filter === category
      );
    });

    renderHome();
    renderDiscover();
  }

  function navigate(page) {
    $$(".page").forEach(section => {
      section.classList.toggle(
        "active",
        section.id === "page-" + page
      );
    });

    $$("[data-page]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

    $("#sidebar")?.classList.remove("open");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

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

      const categories = (post.categories || [])
        .map(category => category.name)
        .join(" ");

      return [
        post.caption,
        creator.username,
        creator.display_name,
        categories
      ].join(" ").toLowerCase().includes(q);
    });

    renderFeed("#discoverGrid", results);
  }

  /* =====================================================
     POST PREVIEW
  ===================================================== */

  function openPreview(id) {
    const post = posts.find(item => item.id === id);

    if (!post) return;

    const media = post.media?.[0];

    if (!media) return;

    const creator = post.profiles || {};

    const creatorName =
      creator.display_name ||
      creator.username ||
      "PIXORA creator";

    const mediaHTML = media.media_type === "video"
      ? `<video src="${escapeHTML(media.publicUrl)}" controls playsinline></video>`
      : `<img src="${escapeHTML(media.publicUrl)}" alt="${escapeHTML(post.caption || "PIXORA post")}">`;

    $("#previewContent").innerHTML = `
      <div class="preview-layout">

        ${mediaHTML}

        <div class="preview-copy">

          <span class="eyebrow">
            PIXORA DISCOVERY
          </span>

          <h2>${escapeHTML(post.caption || "PIXORA post")}</h2>

          <p>
            Shared by <b>${escapeHTML(creatorName)}</b>
          </p>

          <button
            class="primary-button"
            data-save="${escapeHTML(post.id)}"
          >
            ${savedIds.includes(post.id) ? "✓ Saved" : "＋ Save"}
          </button>

        </div>

      </div>
    `;

    $("#previewModal").classList.add("open");
  }

  /* =====================================================
     EVENTS
  ===================================================== */

  document.addEventListener("click", event => {
    const page = event.target.closest("[data-page]");

    if (page) {
      navigate(page.dataset.page);
      return;
    }

    const save = event.target.closest("[data-save]");

    if (save) {
      event.stopPropagation();
      toggleSave(save.dataset.save);
      return;
    }

    const category = event.target.closest(
      "[data-category], [data-filter]"
    );

    if (category) {
      setCategory(
        category.dataset.category ||
        category.dataset.filter
      );
      return;
    }

    const card = event.target.closest(".pin-card");

    if (card) {
      openPreview(card.dataset.id);
      return;
    }

    const close = event.target.closest("[data-close]");

    if (close) {
      $("#" + close.dataset.close)?.classList.remove("open");
    }
  });

  $("#sortSelect")?.addEventListener(
    "change",
    renderDiscover
  );

  $("#globalSearch")?.addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        navigate("discover");
        searchPosts(event.target.value);
      }
    }
  );

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
      $$("[data-atmo]").forEach(item =>
        item.classList.remove("selected")
      );

      button.classList.add("selected");
    });
  });

  $("#applyAtmosphere")?.addEventListener("click", () => {
    const selected = $(".atmo-option.selected");

    if (!selected) return;

    const mode = selected.dataset.atmo;

    document.body.dataset.atmosphere =
      mode === "default" ? "" : mode;

    localStorage.setItem("pixoraAtmosphere", mode);

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
      $$(".modal-backdrop.open").forEach(modal =>
        modal.classList.remove("open")
      );
    }

    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();
      $("#globalSearch")?.focus();
    }
  });

  /* =====================================================
     INITIALIZE PIXORA
  ===================================================== */

  async function initialize() {
    cleanDemoInterface();

    createAuthInterface();
    createPublishInterface();
    createPublishButton();

    const savedAtmosphere =
      localStorage.getItem("pixoraAtmosphere");

    if (savedAtmosphere && savedAtmosphere !== "default") {
      document.body.dataset.atmosphere = savedAtmosphere;
    }

    if (!requireBackend()) return;

    try {
      await refreshAccount();
      await loadFeed();

      console.info("PIXORA live frontend initialized.");

    } catch (error) {
      console.error("PIXORA initialization:", error);
      toast("PIXORA could not finish loading. Check your connection.");
    }
  }

  initialize();

  window.addEventListener("pixora:auth", async () => {
    try {
      await refreshAccount();
      await loadFeed();
    } catch (error) {
      console.error("Authentication update:", error);
    }
  });

})();

