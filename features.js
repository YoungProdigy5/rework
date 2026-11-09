/* =========================================================
   PIXORA — FEATURES (loaded automatically by script.js)
   Notifications, follow, comments, reporting, collections,
   profile editing and profile tabs.
   Needs: backend.js and script.js (window.PIXORA, window.PIXORA_APP)
========================================================= */
(() => {
  "use strict";

  const API = window.PIXORA;
  const App = window.PIXORA_APP;
  if (!API || !App) return;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = App.escapeHTML;
  const toast = App.toast;

  let collections = [];
  let openCollectionId = null;
  let notifications = [];
  let notifTimer = null;
  let profileTab = 0;

  const me = () => App.getState().user;

  /* ---------- styles ---------- */

  const style = document.createElement("style");
  style.textContent = `
    .extras{margin-top:22px;border-top:1px solid var(--line);padding-top:16px}
    .extras h4{font:700 12px Manrope,sans-serif;margin:0 0 10px;color:#e9d3dc}
    .extra-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}
    .extra-row select{background:#171014;border:1px solid var(--line);border-radius:8px;color:#cbb9c1;padding:9px;font-size:11px;max-width:100%}
    .link-button{border:0;background:none;color:#ef8ba5;font-size:11px;padding:0;text-decoration:underline}
    .comment-list{max-height:210px;overflow:auto;display:grid;gap:12px;margin-bottom:12px;padding-right:4px}
    .comment{font-size:11px;line-height:1.5;color:#d6c3cb}
    .comment b{color:#fff;margin-right:6px}.comment small{color:#7d6e75;margin-left:6px}
    .comment .link-button{margin-left:8px;color:#9b8992;font-size:10px}
    .comment-form{display:flex;gap:8px}
    .comment-form input{flex:1;min-width:0;background:#0d090c;border:1px solid var(--line);border-radius:8px;padding:10px;color:var(--text);font-size:12px}
    .notif-head{display:flex;justify-content:flex-end;max-width:760px;margin-bottom:12px}
    .notification-item{cursor:pointer}
    .notification-item.is-read .unread{display:none}
    .collection-card{cursor:pointer}
    .collection-card:hover{border-color:#a33a57}
    .collection-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px}
    .collection-bar h2{font:700 20px Manrope,sans-serif;margin:0 auto 0 4px}
    .mini-remove{position:absolute;left:10px;top:10px;z-index:3;border:0;border-radius:8px;background:#35151bdd;color:#ffb1ba;padding:7px 9px;font-size:10px}
    .field-note{color:var(--faint);font-size:10px;margin-top:6px}
    .check-row{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12px;color:#d8c4cd}
    .check-row input{width:auto!important}
    .about-card{border:1px solid var(--line);border-radius:12px;padding:18px;background:#151014;max-width:560px;font-size:12px;line-height:1.7;color:#cdbac3}
    .profile-tabs button{cursor:pointer}
    .reason-list{display:grid;gap:8px;margin:14px 0}
    .avatar-edit{display:flex;gap:14px;align-items:center;margin:16px 0 4px}
    .avatar-edit input[type=file]{font-size:11px}
    .profile-avatar-preview{width:64px;height:64px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:linear-gradient(140deg,#f18ba5,#922343);font:700 24px Manrope,sans-serif;flex:none}
    .profile-avatar-preview img{width:100%;height:100%;object-fit:cover}
    .message{white-space:pre-wrap;overflow-wrap:anywhere}
    .conversation-copy b .nav-count{margin-left:6px}
    .person-row{display:flex;align-items:center;gap:12px;width:100%;border:0;background:#1a1217;border-radius:10px;padding:10px;margin-bottom:8px;text-align:left;color:var(--text)}
    .person-row:hover{background:#29151e}
    .person-row b{display:block;font-size:12px}.person-row small{color:var(--muted);font-size:10px}
    .chat-compose button:disabled{opacity:.6}
    .reason-list label{display:flex!important;gap:10px;align-items:center;margin:0!important;padding:10px;border:1px solid var(--line);border-radius:9px;font-size:12px!important}
    .reason-list input{width:auto!important}
    .user-link{cursor:pointer}.user-link:hover{text-decoration:underline}
    .creator-link.inline{display:inline-flex}
    /* download picker */
    .dl-stage{display:grid;place-items:center;margin:18px 0 6px;min-height:120px}
    .dl-frame{border-radius:18px;overflow:hidden;background:#1a1a24;box-shadow:0 14px 34px rgba(0,0,0,.5)}
    .dl-frame img{width:100%;height:100%;object-fit:cover;display:block}
    .dl-heading{font:700 14px Manrope,sans-serif;margin:18px 0 10px;color:#f1f1f6}
    .ratio-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}
    .ratio-option{text-align:left;padding:13px 14px;border-radius:16px;border:1px solid rgba(255,255,255,.1);background:#14141c;color:#fff;display:grid;gap:3px}
    .ratio-option b{font-size:14px}.ratio-option small{font-size:11px;color:var(--muted)}
    .ratio-option.selected{background:var(--accent);border-color:var(--accent);box-shadow:0 10px 26px rgba(255,61,105,.35)}
    .ratio-option.selected small{color:#ffe3ea}
    /* chat */
    .chat-panel{position:relative}
    .chat-top{gap:12px}
    .chat-top .chat-back{display:none}
    .chat-title{min-width:0;flex:1}
    .chat-title small{display:block;color:var(--muted);font-size:10px;margin-top:3px}
    .chat-title small.live{color:#5ee0a0}
    #chatAvatar{position:relative;overflow:visible}
    #chatAvatar.is-online::after{content:"";position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;background:#33d17a;border:2px solid #0f0f16}
    .chat-body{gap:6px;padding:16px 14px}
    .message{position:relative;max-width:80%;padding:8px 12px 20px;font-size:13px;line-height:1.45;background:#1c1c26;border-radius:14px 14px 14px 4px}
    .message.mine{background:#c4244f;border-radius:14px 14px 4px 14px}
    .message a{color:#9ad8ff}
    .message .msg-meta{position:absolute;right:10px;bottom:4px;display:flex;gap:4px;align-items:center;font-size:9px;opacity:.75;white-space:nowrap}
    .ticks{font-size:10px;letter-spacing:-2px;color:#a8a8b6}
    .ticks.read{color:#6fd0ff}
    .message.is-deleted{font-style:italic;opacity:.7;background:#17171f}
    .message.menu-open{box-shadow:0 0 0 1px rgba(255,255,255,.2)}
    .message.flash{animation:flash 1.2s}
    @keyframes flash{0%,60%{box-shadow:0 0 0 3px rgba(255,61,105,.7)}100%{box-shadow:none}}
    .message:has(.reactions){margin-bottom:12px}
    .quote{display:grid;gap:2px;margin:0 0 6px;padding:6px 9px;border-left:3px solid var(--accent);background:rgba(0,0,0,.24);border-radius:8px;font-size:11px;cursor:pointer}
    .quote b{color:#ffb3c5;font-size:10px}.quote span{opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .reactions{position:absolute;left:8px;bottom:-13px;display:flex;gap:4px}
    .reaction{border:1px solid rgba(255,255,255,.14);background:#1f1f2a;color:#fff;border-radius:14px;padding:1px 7px;font-size:12px}
    .reaction.mine{border-color:var(--accent);background:#3a1626}
    .msg-menu{position:absolute;z-index:8;top:calc(100% + 6px);left:0;display:grid;gap:6px;min-width:190px}
    .message.mine .msg-menu{left:auto;right:0}
    .react-bar{display:flex;gap:2px;background:#1c1d26;border:1px solid rgba(255,255,255,.1);border-radius:26px;padding:5px 7px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
    .react-bar button{border:0;background:none;font-size:19px;padding:2px 3px;border-radius:50%}
    .react-bar button:hover{background:rgba(255,255,255,.1)}
    .menu-actions{display:grid;background:#1c1d26;border:1px solid rgba(255,255,255,.1);border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.5)}
    .menu-actions button{border:0;background:none;color:#f1f1f6;text-align:left;padding:10px 14px;font-size:12px}
    .menu-actions button:hover{background:rgba(255,255,255,.07)}
    .menu-actions .danger{color:#ff8a9c}
    .chat-date{align-self:center;background:#1c1d26;color:#b9b9c6;font-size:10px;padding:4px 11px;border-radius:12px;margin:8px 0 4px}
    .unread-divider{align-self:stretch;text-align:center;background:rgba(255,61,105,.14);color:#ffc2d0;font-size:10px;padding:5px 10px;border-radius:10px;margin:8px 0}
    .scroll-down{position:absolute;right:16px;bottom:86px;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:#1c1d26;color:#fff;font-size:16px;z-index:5;box-shadow:0 8px 20px rgba(0,0,0,.5)}
    .scroll-down[hidden]{display:none}
    .scroll-down i{position:absolute;top:-6px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:var(--accent);font-style:normal;font-size:10px;display:grid;place-items:center;padding:0 4px}
    .scroll-down i:empty{display:none}
    .compose-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px;background:#15151d;border-top:1px solid var(--line);border-left:3px solid var(--accent)}
    .compose-bar[hidden]{display:none}
    .compose-bar div{display:grid;gap:2px;min-width:0}.compose-bar b{font-size:11px;color:#ffb3c5}
    .compose-bar span{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .compose-bar button{border:0;background:none;color:#fff;font-size:20px}
    .chat-compose{align-items:flex-end}
    .chat-compose textarea{flex:1;min-width:0;resize:none;max-height:120px;background:#15151d;border:1px solid var(--line);border-radius:18px;padding:10px 14px;color:var(--text);font:inherit;font-size:13px;line-height:1.4}
    .chat-compose textarea:focus{outline:0;border-color:var(--accent)}
    .chat-compose #sendBtn{width:42px;height:42px;border-radius:50%;padding:0;background:var(--accent);box-shadow:0 8px 20px rgba(255,61,105,.35);font-size:16px}
    .chat-compose .icon-button{width:42px;height:42px;border-radius:50%;font-size:20px}
    .emoji-panel{position:absolute;left:10px;right:10px;bottom:66px;z-index:6;display:grid;grid-template-columns:repeat(8,1fr);gap:2px;background:#1c1d26;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:8px;box-shadow:0 14px 34px rgba(0,0,0,.55)}
    .emoji-panel[hidden]{display:none}
    .emoji-panel button{border:0;background:none;font-size:21px;padding:5px;border-radius:8px}
    .emoji-panel button:hover{background:rgba(255,255,255,.1)}
    .muted-badge{background:#4a4a58!important}
    @media(max-width:760px){
      .messages-layout{grid-template-columns:1fr!important;height:calc(100vh - 230px);min-height:480px}
      .messages-layout .chat-panel{display:none}
      .messages-layout.chat-open .conversation-panel{display:none}
      .messages-layout.chat-open .chat-panel{display:flex}
      .chat-top .chat-back{display:grid}
      .conversation-time{display:block!important}
      .conversation{flex-wrap:nowrap!important;gap:12px!important;padding:12px 8px!important}
      .conversation-avatar{width:42px!important;height:42px!important;font-size:14px!important}
      .conversation-copy b{font-size:13px!important}.conversation-copy p{font-size:11px!important}
      .message{max-width:88%}
      .emoji-panel{grid-template-columns:repeat(7,1fr)}
    }
  `;
  document.head.appendChild(style);

  /* ---------- small helpers ---------- */

  function makeModal(id, html) {
    $("#" + id)?.remove();
    const modal = document.createElement("div");
    modal.id = id;
    modal.className = "modal-backdrop";
    modal.innerHTML = `<div class="small-modal"><button class="modal-close" data-close="${id}">×</button>${html}</div>`;
    document.body.appendChild(modal);
    return modal;
  }

  const needSignIn = (message = "Sign in first.") => {
    if (me()) return false;
    toast(message);
    App.openAuth();
    return true;
  };

  function timeAgo(value) {
    const seconds = Math.max(1, Math.floor((Date.now() - new Date(value)) / 1000));
    const units = [["y", 31536000], ["mo", 2592000], ["d", 86400], ["h", 3600], ["m", 60]];
    for (const [label, size] of units) {
      if (seconds >= size) return `${Math.floor(seconds / size)}${label} ago`;
    }
    return "Just now";
  }

  const nameOf = (profile) => profile?.display_name || profile?.username || "Someone";

  /* =====================================================
     NOTIFICATIONS
  ===================================================== */

  const NOTIFICATION_TEXT = {
    follow: "started following you.",
    like: "liked your post.",
    comment: "commented on your post.",
    reply: "replied to your comment.",
    message: "sent you a message.",
    mention: "mentioned you.",
    system: "",
    moderation: "Your content was reviewed by the PIXORA team."
  };

  function setNotificationDot(count) {
    $$('.top-actions [data-page="notifications"] .tiny-dot').forEach(dot => {
      dot.style.display = count ? "" : "none";
    });
  }

  function renderNotifications() {
    const list = $("#page-notifications .notification-list");
    if (!list) return;

    if (!me()) {
      list.innerHTML = `<div class="empty-state"><h3>Sign in to see your activity.</h3>
        <button class="primary-button" id="notifSignIn">Sign in</button></div>`;
      $("#notifSignIn")?.addEventListener("click", () => App.openAuth());
      return;
    }

    if (!notifications.length) {
      list.innerHTML = `<div class="empty-state"><h3>Your activity will appear here.</h3>
        <p>Likes, follows and comments on your posts show up in this list.</p></div>`;
      return;
    }

    list.innerHTML = notifications.map(n => {
      const actor = nameOf(n.profiles);
      const initial = actor.charAt(0).toUpperCase();
      const text = NOTIFICATION_TEXT[n.notification_type] ?? "";
      const body = n.notification_type === "moderation" || !n.profiles
        ? esc(text || "You have a new notification.")
        : `<b>${esc(actor)}</b><p>${esc(text)}</p>`;

      return `
        <article class="notification-item ${n.read_at ? "is-read" : ""}" data-notification="${esc(n.id)}"
          data-entity="${esc(n.entity_type || "")}" data-entity-id="${esc(n.entity_id || "")}">
          <span class="notification-avatar">${n.profiles ? App.avatarInner(n.profiles, actor) : esc(initial)}</span>
          <div>${body}<small>${esc(timeAgo(n.created_at))}</small></div>
          <i class="unread"></i>
        </article>`;
    }).join("");
  }

  async function loadNotifications() {
    if (!me()) {
      notifications = [];
      setNotificationDot(0);
      renderNotifications();
      return;
    }
    try {
      notifications = await API.notifications.list();
      setNotificationDot(notifications.filter(n => !n.read_at).length);
      renderNotifications();
    } catch (error) {
      console.error("Notifications:", error);
    }
  }

  function installNotificationHeader() {
    const page = $("#page-notifications");
    if (!page || $("#markAllRead")) return;
    const head = document.createElement("div");
    head.className = "notif-head";
    head.innerHTML = '<button class="outline-button" id="markAllRead">Mark all as read</button>';
    page.querySelector(".page-heading")?.after(head);

    $("#markAllRead").addEventListener("click", async () => {
      if (needSignIn("Sign in to manage notifications.")) return;
      try {
        await API.notifications.markRead();
        await loadNotifications();
      } catch (error) {
        toast(error.message);
      }
    });
  }

  function startNotificationPolling() {
    clearInterval(notifTimer);
    notifTimer = setInterval(() => {
      if (me() && !document.hidden) {
        API.notifications.unread()
          .then(count => {
            setNotificationDot(count);
            if ($("#page-notifications")?.classList.contains("active")) loadNotifications();
          })
          .catch(() => {});
      }
    }, 60000);
  }

  async function openNotification(element) {
    const id = element.dataset.notification;
    const entity = element.dataset.entity;
    const entityId = element.dataset.entityId;

    if (!element.classList.contains("is-read")) {
      element.classList.add("is-read");
      API.notifications.markRead([id])
        .then(() => API.notifications.unread().then(setNotificationDot))
        .catch(() => {});
    }

    if (entity === "profile" && entityId) {
      openUserProfile(entityId);
      return;
    }

    if (entity === "conversation" && entityId) {
      App.navigate("messages");
      await loadConversations();
      openConversation(entityId);
      return;
    }

    if (entity === "post" && entityId) {
      try {
        let post = App.findPost(entityId);
        if (!post) {
          [post] = await API.posts.byIds([entityId]);
          if (post) App.registerPosts([post]);
        }
        if (post) App.openPreview(entityId);
        else toast("That post is no longer available.");
      } catch (error) {
        toast(error.message);
      }
    }
  }

  /* =====================================================
     COLLECTIONS
  ===================================================== */

  async function loadCollections() {
    if (!me()) {
      collections = [];
      renderCollections();
      return;
    }
    try {
      collections = await API.collections.list();
    } catch (error) {
      console.error("Collections:", error);
    }
    renderCollections();
  }

  async function coverImages(collection) {
    const ids = collection.items.slice(0, 3).map(i => i.post_id);
    if (!ids.length) return [];
    try {
      const posts = await API.posts.byIds(ids, { keepOrder: true });
      App.registerPosts(posts);
      return posts.map(p => p.media?.[0]).filter(m => m && m.media_type === "image").map(m => m.publicUrl);
    } catch (_) {
      return [];
    }
  }

  async function renderCollections() {
    const grid = $("#page-collections .collection-grid");
    if (!grid) return;

    if (!me()) {
      grid.innerHTML = `<div class="empty-state"><h3>Sign in to build your collections.</h3>
        <button class="primary-button" id="collSignIn">Sign in</button></div>`;
      $("#collSignIn")?.addEventListener("click", () => App.openAuth());
      return;
    }

    if (openCollectionId) {
      await renderCollectionDetail();
      return;
    }

    const covers = await Promise.all(collections.map(coverImages));

    const cards = collections.map((c, index) => {
      const images = covers[index];
      const visual = images.length
        ? `<div class="collection-images">${images.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</div>`
        : '<div class="collection-empty">✧</div>';
      return `
        <article class="collection-card" data-open-collection="${esc(c.id)}">
          ${visual}
          <div class="collection-info">
            <span class="eyebrow">${c.is_private ? "PRIVATE" : "PUBLIC"} COLLECTION</span>
            <h3>${esc(c.title)}</h3>
            <p>${c.items.length} saved ${c.items.length === 1 ? "visual" : "visuals"}</p>
          </div>
        </article>`;
    }).join("");

    grid.innerHTML = cards + `
      <button class="new-collection" id="newCollection">
        <span>＋</span><b>Create a collection</b><small>Give your inspiration a home.</small>
      </button>`;
  }

  async function renderCollectionDetail() {
    const grid = $("#page-collections .collection-grid");
    const collection = collections.find(c => c.id === openCollectionId);

    if (!collection) {
      openCollectionId = null;
      renderCollections();
      return;
    }

    grid.innerHTML = `
      <div style="grid-column:1/-1">
        <div class="collection-bar">
          <button class="outline-button" id="collBack">← All collections</button>
          <h2>${esc(collection.title)}</h2>
          <button class="outline-button" id="collDelete">Delete collection</button>
        </div>
        <div class="masonry-grid" id="collectionPosts"></div>
      </div>`;

    try {
      const posts = await API.posts.byIds(collection.items.map(i => i.post_id), { keepOrder: true });
      App.renderInto("#collectionPosts", posts, "Nothing here yet. Open a post and choose “Add to collection”.");

      $$("#collectionPosts .pin-card").forEach(card => {
        const remove = document.createElement("button");
        remove.className = "mini-remove";
        remove.dataset.removeFromCollection = card.dataset.id;
        remove.textContent = "Remove";
        card.querySelector(".pin-image-wrap")?.appendChild(remove);
      });
    } catch (error) {
      $("#collectionPosts").innerHTML = `<div class="empty-state"><p>${esc(error.message)}</p></div>`;
    }
  }

  function openCreateCollection(afterCreate) {
    if (needSignIn("Sign in to create a collection.")) return;

    const modal = makeModal("collectionModal", `
      <div class="eyebrow">KEEP WHAT INSPIRES YOU</div>
      <h2>New <span>collection.</span></h2>
      <form id="collectionForm">
        <label>Name</label>
        <input name="title" maxlength="120" required placeholder="e.g. Anime wallpapers">
        <label>Description (optional)</label>
        <textarea name="description" rows="3" maxlength="1000"></textarea>
        <label class="check-row"><input type="checkbox" name="isPrivate" checked> Keep it private</label>
        <button class="primary-button full-button" type="submit">Create collection</button>
      </form>`);
    modal.classList.add("open");

    $("#collectionForm").addEventListener("submit", async event => {
      event.preventDefault();
      const formEl = event.currentTarget;
      const form = new FormData(formEl);
      const button = formEl.querySelector("button[type=submit]");
      button.disabled = true;

      try {
        const created = await API.collections.create({
          title: form.get("title"),
          description: form.get("description"),
          isPrivate: form.get("isPrivate") === "on"
        });
        modal.classList.remove("open");
        toast("Collection created.");
        await loadCollections();
        if (afterCreate) afterCreate(created);
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  /* =====================================================
     POST PREVIEW EXTRAS: follow, collections, report, comments
  ===================================================== */

  async function decoratePreview(post) {
    const copy = $("#previewContent .preview-copy");
    if (!copy || !post) return;

    copy.querySelector(".extras")?.remove();

    const state = App.getState();
    const isOwn = state.user?.id === post.creator_id;
    const creatorName = nameOf(post.profiles);
    const following = state.followingIds.includes(post.creator_id);

    const extras = document.createElement("div");
    extras.className = "extras";
    extras.dataset.postId = post.id;
    extras.innerHTML = `
      <div class="extra-row">
        ${isOwn ? "" : `<button class="outline-button" data-follow="${esc(post.creator_id)}">${following ? "Following" : "Follow " + esc(creatorName)}</button>`}
        ${isOwn ? "" : `<button class="outline-button" data-message-user="${esc(post.creator_id)}">Message</button>`}
        <button class="link-button" data-report="${esc(post.id)}">Report</button>
      </div>
      <div class="extra-row" id="collectionPicker"></div>
      <h4>Comments</h4>
      <div class="comment-list" id="commentList"><small class="muted">Loading comments…</small></div>
      <form class="comment-form" id="commentForm">
        <input name="body" maxlength="3000" placeholder="${state.user ? "Add a comment" : "Sign in to comment"}" autocomplete="off">
        <button class="primary-button" type="submit">Post</button>
      </form>`;
    copy.appendChild(extras);

    renderCollectionPicker(post);
    loadComments(post.id);
  }

  function renderCollectionPicker(post) {
    const box = $("#collectionPicker");
    if (!box) return;

    if (!me()) {
      box.innerHTML = '<button class="link-button" data-signin>Sign in to add this to a collection</button>';
      return;
    }

    if (!collections.length) {
      box.innerHTML = '<button class="outline-button" data-new-collection-for-post>＋ Add to a new collection</button>';
      return;
    }

    box.innerHTML = `
      <select id="pickCollection" aria-label="Choose a collection">
        ${collections.map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join("")}
      </select>
      <button class="outline-button" data-add-to-collection="${esc(post.id)}">Add to collection</button>
      <button class="link-button" data-new-collection-for-post>New</button>`;
  }

  async function loadComments(postId) {
    const list = $("#commentList");
    if (!list) return;

    try {
      const comments = await API.comments.list(postId);
      if ($("#commentList")?.closest(".extras")?.dataset.postId !== postId) return;

      const myId = me()?.id;
      list.innerHTML = comments.length
        ? comments.map(c => `
            <div class="comment">
              <b class="user-link" data-user="${esc(c.author_id)}" style="cursor:pointer">${esc(nameOf(c.profiles))}</b>${esc(c.body)}
              <small>${esc(timeAgo(c.created_at))}</small>
              ${c.author_id === myId ? `<button class="link-button" data-delete-comment="${esc(c.id)}">Delete</button>` : ""}
            </div>`).join("")
        : '<small class="muted">No comments yet. Be the first.</small>';
    } catch (error) {
      list.innerHTML = `<small class="muted">${esc(error.message)}</small>`;
    }
  }

  function currentPreviewPostId() {
    return $("#previewContent .extras")?.dataset.postId || null;
  }

  async function toggleFollow(userId, button) {
    if (needSignIn("Sign in to follow creators.")) return;
    button.disabled = true;
    try {
      const following = await API.follows.toggle(userId);
      App.setFollowing(userId, following);
      const post = App.findPost(currentPreviewPostId());
      button.textContent = following ? "Following" : (button.dataset.name ? "Follow" : "Follow " + nameOf(post?.profiles));
      const counter = $("#userFollowers");
      if (counter && viewingUserId === userId) counter.textContent = Math.max(0, Number(counter.textContent) + (following ? 1 : -1));
      toast(following ? "You're now following this creator." : "Unfollowed.");
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function openReport(postId, userId = null) {
    if (needSignIn("Sign in to report a post.")) return;
    const post = postId ? App.findPost(postId) : null;

    const reasons = ["Spam or scam", "Nudity or sexual content", "Harassment or hate", "Violence or harm", "Copyright infringement", "Something else"];
    const modal = makeModal("reportModal", `
      <div class="eyebrow">KEEP PIXORA SAFE</div>
      <h2>Report <span>${postId ? "this post." : "this account."}</span></h2>
      <form id="reportForm">
        <div class="reason-list">
          ${reasons.map((r, i) => `<label><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? "checked" : ""}> ${esc(r)}</label>`).join("")}
        </div>
        <label>Details (optional)</label>
        <textarea name="details" rows="3" maxlength="3000" placeholder="Tell us what's wrong"></textarea>
        <button class="primary-button full-button" type="submit">Send report</button>
      </form>`);
    modal.classList.add("open");

    $("#reportForm").addEventListener("submit", async event => {
      event.preventDefault();
      const formEl = event.currentTarget;
      const form = new FormData(formEl);
      const button = formEl.querySelector("button[type=submit]");
      button.disabled = true;

      try {
        await API.reports.create({
          postId,
          reportedUserId: userId || post?.creator_id || null,
          reason: form.get("reason"),
          details: form.get("details")
        });
        modal.classList.remove("open");
        toast("Thanks. Our team will review this post.");
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  /* =====================================================
     PROFILE: editing and tabs
  ===================================================== */

  function openEditProfile() {
    if (needSignIn("Sign in to edit your profile.")) return;
    const profile = App.getState().profile || {};

    const modal = makeModal("profileModal", `
      <div class="eyebrow">YOUR PROFILE</div>
      <h2>Edit <span>profile.</span></h2>
      <form id="profileForm">
        <div class="avatar-edit">
          <span class="profile-avatar-preview" id="avatarPreview">${App.avatarInner(profile)}</span>
          <div>
            <input type="file" id="avatarFile" accept="image/jpeg,image/png,image/webp,image/gif">
            <button type="button" class="link-button" id="avatarRemove">Remove photo</button>
            <p class="field-note">Square photos work best. We resize it for you.</p>
          </div>
        </div>
        <label>Display name</label>
        <input name="displayName" maxlength="80" value="${esc(profile.display_name || "")}">
        <label>Bio</label>
        <textarea name="bio" rows="4" maxlength="500">${esc(profile.bio || "")}</textarea>
        <label>Website</label>
        <input name="website" type="url" placeholder="https://" value="${esc(profile.website || "")}">
        <label class="check-row"><input type="checkbox" name="isPrivate" ${profile.is_private ? "checked" : ""}> Private profile</label>
        <button type="button" class="link-button" id="manageBlocked" style="margin-top:12px">Blocked &amp; muted accounts</button>
        <p class="field-note">Your username (@${esc(profile.username || "")}) can't be changed here.</p>
        <button class="primary-button full-button" type="submit">Save changes</button>
      </form>`);
    modal.classList.add("open");

    let removeAvatarFlag = false;
    const initialLetter = App.avatarInner({ display_name: profile.display_name, username: profile.username });

    $("#avatarFile").addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (!file) return;
      removeAvatarFlag = false;
      const preview = $("#avatarPreview");
      preview.innerHTML = "";
      const img = document.createElement("img");
      img.alt = "";
      img.src = URL.createObjectURL(file);
      preview.appendChild(img);
    });

    $("#avatarRemove").addEventListener("click", () => {
      removeAvatarFlag = true;
      $("#avatarFile").value = "";
      $("#avatarPreview").innerHTML = initialLetter;
    });

    $("#profileForm").addEventListener("submit", async event => {
      event.preventDefault();
      const formEl = event.currentTarget;
      const form = new FormData(formEl);
      const button = formEl.querySelector("button[type=submit]");
      const photo = $("#avatarFile")?.files?.[0];
      button.disabled = true;

      try {
        if (photo) await API.profiles.uploadAvatar(photo);
        else if (removeAvatarFlag && profile.avatar_url) await API.profiles.removeAvatar();

        await API.profiles.update({
          displayName: form.get("displayName"),
          bio: form.get("bio"),
          website: form.get("website"),
          isPrivate: form.get("isPrivate") === "on"
        });
        modal.classList.remove("open");
        await App.refreshAccount();
        toast("Profile updated.");
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  async function showProfileTab(index) {
    profileTab = index;
    $$(".profile-tabs button").forEach((b, i) => b.classList.toggle("active", i === index));

    const state = App.getState();
    const grid = $("#savedGrid");
    if (!grid) return;

    if (!state.user) {
      grid.innerHTML = '<div class="empty-state"><h3>Sign in to see your profile.</h3></div>';
      return;
    }

    if (index === 0) {
      App.renderSavedGrid();
    } else if (index === 1) {
      grid.innerHTML = '<div class="empty-state"><p>Loading…</p></div>';
      try {
        const mine = await API.posts.byCreator(state.user.id);
        if (profileTab !== 1) return;
        App.renderInto("#savedGrid", mine, "Posts you publish will appear here.");
      } catch (error) {
        grid.innerHTML = `<div class="empty-state"><p>${esc(error.message)}</p></div>`;
      }
    } else {
      const p = state.profile || {};
      grid.innerHTML = `
        <div class="about-card" style="column-span:all">
          <b>${esc(nameOf(p))}</b> · @${esc(p.username || "")}<br>
          ${p.bio ? esc(p.bio) + "<br>" : ""}
          ${p.website ? `<a class="link" style="color:#ef8ba5" href="${esc(p.website)}" target="_blank" rel="noopener noreferrer">${esc(p.website)}</a><br>` : ""}
          Joined ${p.created_at ? esc(new Date(p.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })) : "—"}
          · ${p.is_private ? "Private profile" : "Public profile"}
        </div>`;
    }
  }

  /* =====================================================
     DOWNLOAD (choose the screen shape, like the original)
  ===================================================== */

  const RATIOS = [
    { key: "original", label: "Original", sub: "Keep as uploaded", ratio: null },
    { key: "9:16", label: "9:16", sub: "Phone", ratio: 9 / 16 },
    { key: "9:19.5", label: "9:19.5", sub: "Tall phone", ratio: 9 / 19.5 },
    { key: "16:9", label: "16:9", sub: "Landscape", ratio: 16 / 9 },
    { key: "1:1", label: "1:1", sub: "Square", ratio: 1 },
    { key: "4:5", label: "4:5", sub: "Portrait", ratio: 4 / 5 }
  ];

  const slugify = (text) =>
    String(text || "pixora").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "pixora";

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const extensionFor = (type) =>
    ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm" }[type] || "jpg");

  function loadImageElement(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That image could not be read.")); };
      img.src = url;
    });
  }

  // Centre-crops the picture to the chosen shape and saves it.
  async function cropAndSave(media, ratioKey, name) {
    const response = await fetch(media.publicUrl);
    if (!response.ok) throw new Error("Could not fetch the picture.");
    const blob = await response.blob();
    const choice = RATIOS.find(r => r.key === ratioKey) || RATIOS[0];

    if (!choice.ratio) {
      saveBlob(blob, `${name}.${extensionFor(blob.type || media.mime_type)}`);
      return;
    }

    const img = await loadImageElement(blob);
    const sw = img.naturalWidth, sh = img.naturalHeight;
    let cw = sw, ch = sh;
    if (sw / sh > choice.ratio) cw = Math.round(sh * choice.ratio);
    else ch = Math.round(sw / choice.ratio);

    const scale = Math.min(1, 4096 / Math.max(cw, ch));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(cw * scale));
    canvas.height = Math.max(1, Math.round(ch * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, Math.round((sw - cw) / 2), Math.round((sh - ch) / 2), cw, ch, 0, 0, canvas.width, canvas.height);

    const out = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!out) throw new Error("Could not prepare the picture.");
    saveBlob(out, `${name}-${ratioKey.replace(":", "x")}.jpg`);
  }

  async function openDownload(postId) {
    let post = App.findPost(postId);
    if (!post) {
      try {
        [post] = await API.posts.byIds([postId]);
        if (post) App.registerPosts([post]);
      } catch (_) { /* handled below */ }
    }
    const media = post?.media?.[0];
    if (!media) { toast("That file isn't available."); return; }

    const name = slugify(post.caption);

    if (media.media_type === "video") {
      const modal = makeModal("downloadModal", `
        <div class="eyebrow">PIXORA</div>
        <h2>Download <span>video.</span></h2>
        <p>Save this video to your device.</p>
        <button class="primary-button full-button" id="dlGo" style="margin-top:18px">Download video</button>`);
      modal.classList.add("open");
      $("#dlGo").addEventListener("click", async () => {
        const button = $("#dlGo");
        button.disabled = true;
        button.textContent = "Preparing...";
        try {
          await cropAndSave(media, "original", name);
          modal.classList.remove("open");
        } catch (_) {
          window.open(media.publicUrl, "_blank", "noopener");
        } finally {
          button.disabled = false;
          button.textContent = "Download video";
        }
      });
      return;
    }

    let selected = "original";
    let natural = 1;

    const modal = makeModal("downloadModal", `
      <div class="eyebrow">PIXORA</div>
      <h2>Download <span>wallpaper</span></h2>
      <p>Pick the shape that fits your screen. The picture is cropped from the centre.</p>
      <div class="dl-stage"><div class="dl-frame" id="dlFrame"><img id="dlImage" alt="" src="${esc(media.publicUrl)}"></div></div>
      <h4 class="dl-heading">Aspect ratio</h4>
      <div class="ratio-grid" id="ratioGrid">
        ${RATIOS.map(r => `
          <button type="button" class="ratio-option ${r.key === selected ? "selected" : ""}" data-ratio="${esc(r.key)}">
            <b>${esc(r.label)}</b><small>${esc(r.sub)}</small>
          </button>`).join("")}
      </div>
      <button class="primary-button full-button" id="dlGo" style="margin-top:20px">Download wallpaper</button>`);
    modal.classList.add("open");

    function sizeFrame() {
      const choice = RATIOS.find(r => r.key === selected);
      const ratio = choice.ratio || natural;
      const stage = $("#dlFrame")?.parentElement;
      if (!stage) return;
      const maxW = Math.min(stage.clientWidth || 280, 300);
      const maxH = 300;
      const w = Math.min(maxW, maxH * ratio);
      const frame = $("#dlFrame");
      frame.style.width = `${Math.round(w)}px`;
      frame.style.height = `${Math.round(w / ratio)}px`;
    }

    const probe = $("#dlImage");
    probe.addEventListener("load", () => {
      natural = probe.naturalWidth / probe.naturalHeight || 1;
      sizeFrame();
    });
    sizeFrame();

    $("#ratioGrid").addEventListener("click", event => {
      const option = event.target.closest("[data-ratio]");
      if (!option) return;
      selected = option.dataset.ratio;
      $$("#ratioGrid .ratio-option").forEach(o => o.classList.toggle("selected", o === option));
      sizeFrame();
    });

    $("#dlGo").addEventListener("click", async () => {
      const button = $("#dlGo");
      button.disabled = true;
      button.textContent = "Preparing...";
      try {
        await cropAndSave(media, selected, name);
        toast("Download started.");
        modal.classList.remove("open");
      } catch (error) {
        toast("Couldn't prepare that download. Opening the picture instead.");
        window.open(media.publicUrl, "_blank", "noopener");
      } finally {
        button.disabled = false;
        button.textContent = "Download wallpaper";
      }
    });
  }

  /* =====================================================
     BLOCKED & MUTED PEOPLE
  ===================================================== */

  let blockedIds = [];
  let mutedIds = [];

  async function loadRelations() {
    if (!me()) { blockedIds = []; mutedIds = []; return; }
    try {
      const [blocks, mutes] = await Promise.all([API.blocks.list(), API.mutes.list()]);
      blockedIds = blocks.map(b => b.id);
      mutedIds = mutes.map(m => m.id);
    } catch (error) {
      console.error("Blocked and muted lists:", error);
    }
  }

  async function setBlocked(userId, block) {
    if (needSignIn("Sign in first.")) return false;
    try {
      if (block) {
        await API.blocks.add(userId);
        App.setFollowing(userId, false);
        if (!blockedIds.includes(userId)) blockedIds.push(userId);
        toast("Blocked. They can no longer see your posts or message you.");
      } else {
        await API.blocks.remove(userId);
        blockedIds = blockedIds.filter(i => i !== userId);
        toast("Unblocked.");
      }
      App.refreshFeed();
      loadConversations();
      return true;
    } catch (error) {
      toast(error.message);
      return false;
    }
  }

  async function setMutedUser(userId, mute) {
    if (needSignIn("Sign in first.")) return false;
    try {
      if (mute) {
        await API.mutes.add(userId);
        if (!mutedIds.includes(userId)) mutedIds.push(userId);
        toast("Muted. Their posts are hidden from your feed.");
      } else {
        await API.mutes.remove(userId);
        mutedIds = mutedIds.filter(i => i !== userId);
        toast("Unmuted.");
      }
      App.refreshFeed();
      return true;
    } catch (error) {
      toast(error.message);
      return false;
    }
  }

  async function openBlockedList() {
    const modal = makeModal("blockedModal", `
      <div class="eyebrow">PRIVACY</div>
      <h2>Blocked &amp; <span>muted.</span></h2>
      <div id="blockedBody"><p class="field-note">Loading…</p></div>`);
    modal.classList.add("open");

    try {
      const [blocks, mutes] = await Promise.all([API.blocks.list(), API.mutes.list()]);
      const row = (item, kind) => `
        <div class="person-row" style="cursor:default">
          <span class="avatar">${App.avatarInner(item.profile || {})}</span>
          <span style="flex:1"><b>${esc(nameOf(item.profile))}</b><small>@${esc(item.profile?.username || "")}</small></span>
          <button class="outline-button" data-undo="${kind}" data-id="${esc(item.id)}">${kind === "block" ? "Unblock" : "Unmute"}</button>
        </div>`;

      $("#blockedBody").innerHTML =
        (blocks.length ? `<h4 class="dl-heading">Blocked</h4>${blocks.map(b => row(b, "block")).join("")}` : "") +
        (mutes.length ? `<h4 class="dl-heading">Muted</h4>${mutes.map(m => row(m, "mute")).join("")}` : "") +
        (!blocks.length && !mutes.length ? '<p class="field-note">You haven\'t blocked or muted anyone.</p>' : "");
    } catch (error) {
      $("#blockedBody").innerHTML = `<p class="field-note">${esc(error.message)}</p>`;
    }
  }

  /* =====================================================
     SOMEONE ELSE'S PROFILE
  ===================================================== */

  let prevPage = "home";
  let viewingUserId = null;

  async function openUserProfile(userId) {
    if (!userId) return;
    if (userId === me()?.id) { App.navigate("profile"); return; }

    $("#previewModal")?.classList.remove("open");

    let page = $("#page-user");
    if (!page) {
      page = document.createElement("section");
      page.className = "page";
      page.id = "page-user";
      const footer = $(".footer");
      if (footer) footer.before(page);
      else $(".main-area")?.appendChild(page);
    }

    viewingUserId = userId;
    page.innerHTML = '<div class="empty-state"><p>Loading profile…</p></div>';
    App.navigate("user");

    const back = '<button class="outline-button" data-back style="margin-bottom:16px">← Back</button>';

    try {
      const [profile, stats] = await Promise.all([API.profiles.get(userId), API.profiles.stats(userId)]);
      if (viewingUserId !== userId) return;

      if (!profile) {
        page.innerHTML = `${back}<div class="empty-state"><h3>This profile is private or unavailable.</h3></div>`;
        return;
      }

      const state = App.getState();
      const following = state.followingIds.includes(userId);
      const blocked = blockedIds.includes(userId);
      const name = nameOf(profile);

      page.innerHTML = `
        ${back}
        <div class="profile-cover"><div class="cover-orb"></div></div>
        <div class="profile-main">
          <div class="profile-avatar">${App.avatarInner(profile)}</div>
          <div class="profile-actions">
            ${blocked ? "" : `<button class="primary-button" data-follow="${esc(userId)}" data-name="${esc(name)}">${following ? "Following" : "Follow"}</button>
            <button class="outline-button" data-message-user="${esc(userId)}">Message</button>`}
            <button class="icon-button" data-user-menu="${esc(userId)}" aria-label="More">⋯</button>
          </div>
          <h1>${esc(name)}</h1>
          <p class="profile-handle">@${esc(profile.username || "")}</p>
          <p class="profile-bio">${esc(profile.bio || "")}</p>
          ${profile.website ? `<p><a style="color:#ff7a99" href="${esc(profile.website)}" target="_blank" rel="noopener noreferrer">${esc(profile.website)}</a></p>` : ""}
          <div class="profile-stats">
            <span><b>${stats.posts}</b> <small>Posts</small></span>
            <span><b id="userFollowers">${stats.followers}</b> <small>Followers</small></span>
            <span><b>${stats.following}</b> <small>Following</small></span>
          </div>
          ${blocked ? '<div class="empty-state"><h3>You blocked this account.</h3><p>Unblock them from the ⋯ menu to see their posts.</p></div>' : '<div class="masonry-grid" id="userPosts"></div>'}
        </div>`;

      if (!blocked) {
        const posts = await API.posts.byCreator(userId);
        if (viewingUserId !== userId) return;
        App.renderInto("#userPosts", posts, "No posts yet.");
      }
    } catch (error) {
      page.innerHTML = `${back}<div class="empty-state"><p>${esc(error.message)}</p></div>`;
    }
  }

  function openUserMenu(userId) {
    const blocked = blockedIds.includes(userId);
    const muted = mutedIds.includes(userId);

    const modal = makeModal("userMenuModal", `
      <div class="eyebrow">OPTIONS</div>
      <h2>This <span>account.</span></h2>
      <div style="display:grid;gap:10px;margin-top:16px">
        <button class="outline-button" data-menu="mute">${muted ? "Unmute their posts" : "Mute their posts"}</button>
        <button class="outline-button" data-menu="block">${blocked ? "Unblock" : "Block"}</button>
        <button class="outline-button" data-menu="report">Report account</button>
      </div>
      <p class="field-note">Muting hides their posts from your feed. Blocking also stops them seeing your posts, following, commenting and messaging you.</p>`);
    modal.classList.add("open");

    modal.addEventListener("click", async event => {
      const item = event.target.closest("[data-menu]");
      if (!item) return;
      modal.classList.remove("open");
      if (item.dataset.menu === "mute") await setMutedUser(userId, !muted);
      if (item.dataset.menu === "block") {
        if (blocked || window.confirm("Block this account?")) await setBlocked(userId, !blocked);
      }
      if (item.dataset.menu === "report") openReport(null, userId);
      if (viewingUserId === userId && $("#page-user")?.classList.contains("active")) openUserProfile(userId);
    });
  }

  /* =====================================================
     MESSAGES (WhatsApp-style)
     replies, reactions, edit, delete for everyone, read ticks,
     typing, online, emoji, mute chat, block, unread divider
  ===================================================== */

  let conversations = [];
  let activeConversationId = null;
  let chatMessages = [];
  let unsubscribeChat = null;
  let room = null;
  let inboxTimer = null;
  let inboxLoading = false;
  let messagingUserId = null;
  let replyTo = null;
  let editingId = null;
  let openMenuId = null;
  let dividerBeforeId = null;
  let dividerCount = 0;
  let onlineIds = [];
  let typingIds = new Set();
  const typingTimers = new Map();
  let newBelow = 0;

  const EDIT_WINDOW_MS = 15 * 60 * 1000;
  const EMOJI_SET = ["😀","😂","🥹","😍","😘","🥰","😎","🤔","😅","😭","😮","😡","👍","👎","👏","🙏","💪","🔥","❤️","💔","🎉","✨","💯","👀","🙌","😴","🤝","🤩","😇","🥳","😬","🙄","😉","😋","🤗","🤭","🫶","💀","🌹","⭐"];

  const conversationName = (c) => c.display_name || c.username || "PIXORA member";
  const avatarOf = (c) => App.avatarInner({ avatar_url: c.avatar_url }, conversationName(c));
  const activeConversation = () => conversations.find(c => c.conversation_id === activeConversationId);

  const fmtTime = (value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  function dayLabel(value) {
    const d = new Date(value);
    const today = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(today) - startOf(d)) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return d.toLocaleDateString([], { weekday: "long" });
    return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  }

  const linkify = (text) =>
    esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

  // One grey tick = sent, two blue ticks = read.
  function ticksFor(message) {
    const c = activeConversation();
    const read = c?.other_last_read_at && new Date(c.other_last_read_at) >= new Date(message.created_at);
    return `<span class="ticks ${read ? "read" : ""}" title="${read ? "Read" : "Sent"}">${read ? "✓✓" : "✓"}</span>`;
  }

  function setUnreadBadge() {
    const total = conversations.reduce((sum, c) => sum + (c.is_muted ? 0 : (c.unread_count || 0)), 0);
    const nav = $('#sidebar .nav-item[data-page="messages"]');
    if (!nav) return;
    nav.querySelector(".nav-count")?.remove();
    if (total) {
      const badge = document.createElement("i");
      badge.className = "nav-count";
      badge.textContent = total > 99 ? "99+" : String(total);
      nav.appendChild(badge);
    }
  }

  function previewText(c) {
    if (c.last_deleted) return "🚫 This message was deleted";
    return c.last_body || "Say hello";
  }

  function renderConversationList() {
    const list = $("#conversationList");
    if (!list) return;

    if (!me()) {
      list.innerHTML = '<div class="empty-state"><p>Sign in to see your messages.</p></div>';
      return;
    }

    const term = ($("#conversationSearch")?.value || "").trim().toLowerCase();
    const items = conversations.filter(c =>
      `${conversationName(c)} ${c.username || ""}`.toLowerCase().includes(term));

    if (!items.length) {
      list.innerHTML = `<div class="empty-state"><p>${conversations.length ? "No conversations match." : "No conversations yet."}</p></div>`;
      return;
    }

    list.innerHTML = items.map(c => {
      const mine = c.last_sender_id === me()?.id && !c.last_deleted && c.last_body;
      const badge = c.unread_count ? `<i class="nav-count ${c.is_muted ? "muted-badge" : ""}">${c.unread_count}</i>` : "";
      return `
      <div class="conversation ${c.conversation_id === activeConversationId ? "active" : ""}" data-conversation="${esc(c.conversation_id)}">
        <span class="conversation-avatar">${avatarOf(c)}</span>
        <div class="conversation-copy">
          <b>${esc(conversationName(c))}${c.is_muted ? ' <span title="Muted">🔇</span>' : ""}${badge}</b>
          <p>${mine ? (c.last_sender_id === me()?.id && c.other_last_read_at && new Date(c.other_last_read_at) >= new Date(c.last_at) ? '<span class="ticks read">✓✓</span> ' : '<span class="ticks">✓</span> ') : ""}${esc(previewText(c))}</p>
        </div>
        <span class="conversation-time">${esc(timeAgo(c.last_at))}</span>
      </div>`;
    }).join("");
  }

  let loadAgain = false;
  async function loadConversations() {
    if (!me()) {
      conversations = [];
      renderConversationList();
      setUnreadBadge();
      return;
    }
    if (inboxLoading) { loadAgain = true; return; }
    inboxLoading = true;

    try {
      conversations = await API.messages.conversations();
      const active = activeConversation();
      if (active) active.unread_count = 0;       // the chat you are looking at is read
      renderConversationList();
      setUnreadBadge();
      updateChatHeader();
    } catch (error) {
      console.error("Conversations:", error);
    } finally {
      inboxLoading = false;
      if (loadAgain) { loadAgain = false; loadConversations(); }
    }
  }

  /* ---------- chat panel ---------- */

  function statusText(c) {
    if (c && typingIds.has(c.other_user_id)) return "typing…";
    if (c && onlineIds.includes(c.other_user_id)) return "online";
    return c?.username ? "@" + c.username : "";
  }

  function updateChatHeader() {
    const c = activeConversation();
    const status = $("#chatStatus");
    if (status && c) {
      status.textContent = statusText(c);
      status.classList.toggle("live", typingIds.has(c.other_user_id) || onlineIds.includes(c.other_user_id));
    }
    $("#chatAvatar")?.classList.toggle("is-online", Boolean(c && onlineIds.includes(c.other_user_id)));
  }

  function renderChatPanel() {
    const panel = $("#chatPanel");
    if (!panel) return;

    if (!me()) {
      panel.innerHTML = `<div class="chat-empty"><span class="empty-icon">✉</span>
        <h3>Sign in to start chatting.</h3>
        <button class="primary-button" id="chatSignIn">Sign in</button></div>`;
      $("#chatSignIn")?.addEventListener("click", () => App.openAuth());
      $(".messages-layout")?.classList.remove("chat-open");
      return;
    }

    const c = activeConversation();
    if (!c) {
      panel.innerHTML = `<div class="chat-empty"><span class="empty-icon">✉</span>
        <h3>Your conversations live here.</h3>
        <p>Choose a conversation or start a new one.</p>
        <button class="primary-button" data-new-message>Start a conversation</button></div>`;
      $(".messages-layout")?.classList.remove("chat-open");
      return;
    }

    $(".messages-layout")?.classList.add("chat-open");

    panel.innerHTML = `
      <div class="chat-top">
        <button class="icon-button chat-back" id="chatBack" aria-label="Back to chats">←</button>
        <span class="conversation-avatar" id="chatAvatar">${avatarOf(c)}</span>
        <div class="chat-title" data-user="${esc(c.other_user_id || "")}" style="cursor:pointer">
          <b>${esc(conversationName(c))}</b><small id="chatStatus">${esc(statusText(c))}</small>
        </div>
        <button class="icon-button" id="chatMenuBtn" aria-label="Chat options">⋮</button>
      </div>
      <div class="chat-body" id="chatBody"></div>
      <button class="scroll-down" id="scrollDown" hidden>↓<i id="scrollDownCount"></i></button>
      <div class="compose-bar" id="replyBar" hidden></div>
      <form class="chat-compose" id="chatForm">
        <button type="button" class="icon-button" id="emojiBtn" aria-label="Emoji">☺</button>
        <textarea name="body" rows="1" maxlength="5000" placeholder="Write a message" aria-label="Message"></textarea>
        <button type="submit" id="sendBtn" aria-label="Send">➤</button>
      </form>
      <div class="emoji-panel" id="emojiPanel" hidden>${EMOJI_SET.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join("")}</div>`;

    wireComposer();
    renderChatMessages({ stick: true });
    renderReplyBar();
  }

  function wireComposer() {
    const area = $("#chatForm textarea");
    const body = $("#chatBody");
    if (!area) return;

    const grow = () => {
      area.style.height = "auto";
      area.style.height = Math.min(area.scrollHeight, 120) + "px";
    };

    area.addEventListener("input", () => {
      grow();
      if (area.value.trim()) {
        room?.sendTyping(true);
        clearTimeout(wireComposer.timer);
        wireComposer.timer = setTimeout(() => room?.sendTyping(false), 2500);
      }
    });

    area.addEventListener("keydown", event => {
      // On phones Enter adds a new line (use the send button); on computers Enter sends.
      const touch = window.matchMedia?.("(pointer: coarse)").matches;
      if (event.key === "Enter" && !event.shiftKey && !touch) {
        event.preventDefault();
        $("#chatForm")?.requestSubmit?.();
      }
      if (event.key === "Escape") { cancelReplyOrEdit(); }
    });

    body?.addEventListener("scroll", () => {
      if (isNearBottom()) {
        newBelow = 0;
        $("#scrollDown")?.setAttribute("hidden", "");
      } else {
        $("#scrollDown")?.removeAttribute("hidden");
      }
    });
  }

  function isNearBottom() {
    const b = $("#chatBody");
    return !b || b.scrollHeight - b.scrollTop - b.clientHeight < 120;
  }

  function reactionSummary(message) {
    const groups = new Map();
    for (const r of message.reactions || []) {
      const g = groups.get(r.emoji) || { count: 0, mine: false };
      g.count += 1;
      if (r.user_id === me()?.id) g.mine = true;
      groups.set(r.emoji, g);
    }
    return [...groups.entries()];
  }

  function bubbleHTML(m) {
    const mine = m.sender_id === me()?.id;
    const cls = `message ${mine ? "mine" : ""} ${openMenuId === m.id ? "menu-open" : ""}`;

    if (m.deleted_at) {
      return `<div class="${cls} is-deleted" data-message="${esc(m.id)}">🚫 This message was deleted
        <span class="msg-meta">${esc(fmtTime(m.created_at))}</span></div>`;
    }

    const quoted = m.reply_to_id ? chatMessages.find(x => x.id === m.reply_to_id) : null;
    const quote = m.reply_to_id ? `
      <div class="quote" data-jump="${esc(m.reply_to_id)}">
        <b>${quoted ? (quoted.sender_id === me()?.id ? "You" : esc(conversationName(activeConversation() || {}))) : "Message"}</b>
        <span>${quoted ? (quoted.deleted_at ? "🚫 This message was deleted" : esc(quoted.body.slice(0, 90))) : "Original message unavailable"}</span>
      </div>` : "";

    const reactions = reactionSummary(m);
    const reactionRow = reactions.length ? `<div class="reactions">${reactions.map(([emoji, g]) =>
      `<button class="reaction ${g.mine ? "mine" : ""}" data-react="${esc(emoji)}" data-id="${esc(m.id)}">${emoji}${g.count > 1 ? ` ${g.count}` : ""}</button>`).join("")}</div>` : "";

    const withinEdit = mine && m.message_type === "text" && Date.now() - new Date(m.created_at) <= EDIT_WINDOW_MS;

    const menu = openMenuId === m.id ? `
      <div class="msg-menu">
        <div class="react-bar">${API.messages.REACTIONS.map(e => `<button data-react="${esc(e)}" data-id="${esc(m.id)}">${e}</button>`).join("")}</div>
        <div class="menu-actions">
          <button data-reply="${esc(m.id)}">↩ Reply</button>
          <button data-copy="${esc(m.id)}">⧉ Copy</button>
          ${withinEdit ? `<button data-edit="${esc(m.id)}">✎ Edit</button>` : ""}
          ${mine ? `<button data-delete="${esc(m.id)}" class="danger">🗑 Delete</button>` : ""}
        </div>
      </div>` : "";

    return `
      <div class="${cls}" data-message="${esc(m.id)}">
        ${quote}
        <span class="msg-text">${linkify(m.body)}</span>
        <span class="msg-meta">${m.edited_at ? "edited · " : ""}${esc(fmtTime(m.created_at))}${mine ? " " + ticksFor(m) : ""}</span>
        ${reactionRow}
        ${menu}
      </div>`;
  }

  function renderChatMessages({ stick = false } = {}) {
    const body = $("#chatBody");
    if (!body) return;
    const wasNearBottom = isNearBottom();

    if (!chatMessages.length) {
      body.innerHTML = '<div class="chat-date">No messages yet. Say hello 👋</div>';
      return;
    }

    let html = "";
    let lastDay = "";
    for (const m of chatMessages) {
      const label = dayLabel(m.created_at);
      if (label !== lastDay) {
        html += `<div class="chat-date">${esc(label)}</div>`;
        lastDay = label;
      }
      if (m.id === dividerBeforeId && dividerCount) {
        html += `<div class="unread-divider">${dividerCount} unread message${dividerCount > 1 ? "s" : ""}</div>`;
      }
      html += bubbleHTML(m);
    }
    body.innerHTML = html;

    if (stick || wasNearBottom) body.scrollTop = body.scrollHeight;
  }

  function renderReplyBar() {
    const bar = $("#replyBar");
    if (!bar) return;
    if (editingId) {
      bar.hidden = false;
      bar.innerHTML = `<div><b>Editing message</b><span>Change it, then press send</span></div><button type="button" data-cancel-compose aria-label="Cancel">×</button>`;
    } else if (replyTo) {
      const who = replyTo.sender_id === me()?.id ? "You" : conversationName(activeConversation() || {});
      bar.hidden = false;
      bar.innerHTML = `<div><b>Replying to ${esc(who)}</b><span>${esc(replyTo.body.slice(0, 90))}</span></div><button type="button" data-cancel-compose aria-label="Cancel">×</button>`;
    } else {
      bar.hidden = true;
      bar.innerHTML = "";
    }
  }

  function cancelReplyOrEdit() {
    replyTo = null;
    if (editingId) {
      editingId = null;
      const area = $("#chatForm textarea");
      if (area) { area.value = ""; area.style.height = "auto"; }
    }
    renderReplyBar();
  }

  async function openConversation(id) {
    const c = conversations.find(x => x.conversation_id === id);
    const unread = c?.unread_count || 0;

    room?.leave();
    room = null;
    activeConversationId = id;
    chatMessages = [];
    replyTo = null; editingId = null; openMenuId = null;
    dividerBeforeId = null; dividerCount = 0;
    typingIds = new Set(); onlineIds = []; newBelow = 0;
    renderConversationList();
    renderChatPanel();

    try {
      const loaded = await API.messages.list(id);
      if (activeConversationId !== id) return;
      chatMessages = loaded;

      // Mark where the unread messages start (like the "N unread messages" line in WhatsApp).
      if (unread) {
        const theirs = loaded.filter(m => m.sender_id !== me()?.id && !m.deleted_at);
        const first = theirs[Math.max(0, theirs.length - unread)];
        if (first) { dividerBeforeId = first.id; dividerCount = unread; }
      }
      renderChatMessages({ stick: true });

      API.messages.markRead(id).then(() => {
        const row = conversations.find(x => x.conversation_id === id);
        if (row) row.unread_count = 0;
        renderConversationList();
        setUnreadBadge();
      }).catch(() => {});

      room = await API.messages.room(id, {
        onTyping: (userId, typing) => {
          clearTimeout(typingTimers.get(userId));
          if (typing) {
            typingIds.add(userId);
            typingTimers.set(userId, setTimeout(() => { typingIds.delete(userId); updateChatHeader(); }, 4000));
          } else {
            typingIds.delete(userId);
          }
          updateChatHeader();
        },
        onPresence: (ids) => { onlineIds = ids; updateChatHeader(); }
      });
      if (activeConversationId !== id) room.leave();
    } catch (error) {
      toast(error.message);
    }
  }

  function closeConversation() {
    room?.leave();
    room = null;
    activeConversationId = null;
    chatMessages = [];
    cancelReplyOrEdit();
    renderConversationList();
    renderChatPanel();
  }

  async function startChatWith(userId) {
    if (needSignIn("Sign in to send messages.")) return;
    try {
      const id = await API.messages.start(userId);
      await loadConversations();
      App.navigate("messages");
      await openConversation(id);
    } catch (error) {
      toast(error.message);
    }
  }

  /* ---------- live updates ---------- */

  function mergeMessage(row) {
    const index = chatMessages.findIndex(m => m.id === row.id);
    if (index === -1) return false;
    chatMessages[index] = { ...chatMessages[index], ...row, reactions: row.deleted_at ? [] : chatMessages[index].reactions };
    return true;
  }

  function onMessageChange(payload) {
    const row = payload.new;

    if (payload.eventType === "INSERT" && row && row.conversation_id === activeConversationId) {
      if (!chatMessages.some(m => m.id === row.id)) {
        const wasNear = isNearBottom();
        chatMessages.push({ ...row, reactions: [] });
        renderChatMessages();
        if (row.sender_id !== me()?.id) {
          API.messages.markRead(row.conversation_id).catch(() => {});
          if (!wasNear) {
            newBelow += 1;
            const count = $("#scrollDownCount");
            if (count) count.textContent = newBelow;
            $("#scrollDown")?.removeAttribute("hidden");
          }
        }
      }
    } else if (payload.eventType === "UPDATE" && row && row.conversation_id === activeConversationId) {
      if (mergeMessage(row)) renderChatMessages();
    }
    loadConversations();
  }

  function onReactionChange(payload) {
    const row = payload.new?.message_id ? payload.new : payload.old;
    if (!row?.message_id) return;
    const message = chatMessages.find(m => m.id === row.message_id);
    if (!message) return;

    message.reactions = (message.reactions || []).filter(r => r.user_id !== row.user_id);
    if (payload.eventType !== "DELETE" && payload.new?.emoji) {
      message.reactions.push({ message_id: row.message_id, user_id: payload.new.user_id, emoji: payload.new.emoji });
    }
    renderChatMessages();
  }

  function onMemberChange(payload) {
    const row = payload.new;
    if (!row || row.user_id === me()?.id) return;     // only the OTHER person's read time matters for ticks
    const c = conversations.find(x => x.conversation_id === row.conversation_id);
    if (c) {
      c.other_last_read_at = row.last_read_at;
      if (row.conversation_id === activeConversationId) renderChatMessages();
      renderConversationList();
    }
  }

  function resetMessaging() {
    unsubscribeChat?.();
    unsubscribeChat = null;
    room?.leave();
    room = null;
    clearInterval(inboxTimer);
    conversations = [];
    chatMessages = [];
    activeConversationId = null;
    replyTo = null; editingId = null; openMenuId = null;
    renderConversationList();
    renderChatPanel();
    setUnreadBadge();
  }

  function startMessaging() {
    const userId = me()?.id || null;
    if (userId === messagingUserId) return;
    messagingUserId = userId;

    resetMessaging();
    if (!userId) return;

    unsubscribeChat = API.messages.subscribe({
      onMessage: onMessageChange,
      onReaction: onReactionChange,
      onMember: onMemberChange
    });
    loadConversations();

    // Safety net in case the live connection drops.
    inboxTimer = setInterval(() => {
      if (me() && !document.hidden) loadConversations();
    }, 30000);
  }

  /* ---------- sending, editing, reacting ---------- */

  async function submitChat(formEl) {
    const area = formEl.querySelector("textarea");
    const button = formEl.querySelector("#sendBtn");
    const conversationId = activeConversationId;
    const text = area.value;
    if (!conversationId || !text.trim()) return;

    button.disabled = true;
    try {
      room?.sendTyping(false);

      if (editingId) {
        const updated = await API.messages.edit(editingId, text);
        mergeMessage(updated);
        editingId = null;
      } else {
        const sent = await API.messages.send(conversationId, text, replyTo?.id || null);
        if (conversationId === activeConversationId && !chatMessages.some(m => m.id === sent.id)) {
          chatMessages.push(sent);
        }
        replyTo = null;
      }

      area.value = "";
      area.style.height = "auto";
      renderReplyBar();
      renderChatMessages({ stick: true });
      loadConversations();
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
      area.focus();
    }
  }

  async function reactTo(messageId, emoji) {
    const message = chatMessages.find(m => m.id === messageId);
    if (!message) return;
    const mine = (message.reactions || []).find(r => r.user_id === me()?.id);
    const next = mine?.emoji === emoji ? null : emoji;    // tap the same emoji again to remove it

    // show it straight away, the database confirms in the background
    message.reactions = (message.reactions || []).filter(r => r.user_id !== me()?.id);
    if (next) message.reactions.push({ message_id: messageId, user_id: me().id, emoji: next });
    openMenuId = null;
    renderChatMessages();

    try {
      await API.messages.react(messageId, next);
    } catch (error) {
      toast(error.message);
      const fresh = await API.messages.list(activeConversationId).catch(() => null);
      if (fresh) { chatMessages = fresh; renderChatMessages(); }
    }
  }

  async function deleteForEveryone(messageId) {
    if (!window.confirm("Delete this message for everyone?")) return;
    try {
      const updated = await API.messages.remove(messageId);
      mergeMessage({ ...updated, reactions: [] });
      openMenuId = null;
      renderChatMessages();
      loadConversations();
    } catch (error) {
      toast(error.message);
    }
  }

  function startEdit(messageId) {
    const m = chatMessages.find(x => x.id === messageId);
    if (!m) return;
    editingId = messageId;
    replyTo = null;
    openMenuId = null;
    renderChatMessages();
    renderReplyBar();
    const area = $("#chatForm textarea");
    if (area) {
      area.value = m.body;
      area.style.height = "auto";
      area.style.height = Math.min(area.scrollHeight, 120) + "px";
      area.focus();
    }
  }

  function startReply(messageId) {
    const m = chatMessages.find(x => x.id === messageId);
    if (!m) return;
    replyTo = m;
    editingId = null;
    openMenuId = null;
    renderChatMessages();
    renderReplyBar();
    $("#chatForm textarea")?.focus();
  }

  async function copyMessage(messageId) {
    const m = chatMessages.find(x => x.id === messageId);
    openMenuId = null;
    renderChatMessages();
    if (!m) return;
    try {
      await navigator.clipboard.writeText(m.body);
      toast("Copied.");
    } catch (_) {
      toast("Couldn't copy. Press and hold the text instead.");
    }
  }

  function openChatMenu() {
    const c = activeConversation();
    if (!c) return;
    const blocked = blockedIds.includes(c.other_user_id);

    const modal = makeModal("chatMenuModal", `
      <div class="eyebrow">CHAT</div>
      <h2>${esc(conversationName(c))}</h2>
      <div style="display:grid;gap:10px;margin-top:16px">
        <button class="outline-button" data-chat-menu="profile">View profile</button>
        <button class="outline-button" data-chat-menu="mute">${c.is_muted ? "Unmute notifications" : "Mute notifications"}</button>
        <button class="outline-button" data-chat-menu="block">${blocked ? "Unblock" : "Block"}</button>
        <button class="outline-button" data-chat-menu="report">Report</button>
      </div>`);
    modal.classList.add("open");

    modal.addEventListener("click", async event => {
      const item = event.target.closest("[data-chat-menu]");
      if (!item) return;
      modal.classList.remove("open");
      const action = item.dataset.chatMenu;

      if (action === "profile") openUserProfile(c.other_user_id);
      if (action === "mute") {
        try {
          await API.messages.setMuted(c.conversation_id, !c.is_muted);
          c.is_muted = !c.is_muted;
          renderConversationList();
          setUnreadBadge();
          toast(c.is_muted ? "Chat muted." : "Chat unmuted.");
        } catch (error) { toast(error.message); }
      }
      if (action === "block") {
        if (blocked || window.confirm("Block this person? They won't be able to message you.")) {
          await setBlocked(c.other_user_id, !blocked);
        }
      }
      if (action === "report") openReport(null, c.other_user_id);
    });
  }

  function openNewMessage() {
    if (needSignIn("Sign in to send messages.")) return;

    const modal = makeModal("newMessageModal", `
      <div class="eyebrow">NEW MESSAGE</div>
      <h2>Message <span>someone.</span></h2>
      <input id="peopleSearch" type="search" placeholder="Search by name or username" autocomplete="off"
        style="width:100%;margin:14px 0;background:#0c0c13;border:1px solid var(--line);border-radius:9px;padding:12px;color:var(--text)">
      <div id="peopleResults"><p class="field-note">Type at least 2 letters.</p></div>`);
    modal.classList.add("open");
    $("#peopleSearch").focus();

    let timer = null;
    let token = 0;
    $("#peopleSearch").addEventListener("input", event => {
      clearTimeout(timer);
      const value = event.target.value;
      timer = setTimeout(async () => {
        const mine = ++token;
        const box = $("#peopleResults");
        if (value.trim().length < 2) {
          box.innerHTML = '<p class="field-note">Type at least 2 letters.</p>';
          return;
        }
        try {
          const people = await API.users.search(value);
          if (mine !== token) return;
          box.innerHTML = people.length
            ? people.map(p => `
                <button class="person-row" data-start-chat="${esc(p.id)}">
                  <span class="avatar">${App.avatarInner(p)}</span>
                  <span><b>${esc(nameOf(p))}</b><small>@${esc(p.username || "")}</small></span>
                </button>`).join("")
            : '<p class="field-note">No one found.</p>';
        } catch (error) {
          box.innerHTML = `<p class="field-note">${esc(error.message)}</p>`;
        }
      }, 300);
    });
  }

  /* =====================================================
     EVENTS
  ===================================================== */

  document.addEventListener("click", async event => {
    const t = event.target;

    const notif = t.closest("[data-notification]");
    if (notif) { openNotification(notif); return; }

    const openColl = t.closest("[data-open-collection]");
    if (openColl) { openCollectionId = openColl.dataset.openCollection; renderCollections(); return; }

    if (t.closest("#collBack")) { openCollectionId = null; renderCollections(); return; }

    if (t.closest("#collDelete")) {
      const collection = collections.find(c => c.id === openCollectionId);
      if (collection && window.confirm(`Delete “${collection.title}”? The posts themselves are not deleted.`)) {
        try {
          await API.collections.remove(collection.id);
          openCollectionId = null;
          toast("Collection deleted.");
          await loadCollections();
        } catch (error) {
          toast(error.message);
        }
      }
      return;
    }

    if (t.closest("#newCollection")) { openCreateCollection(); return; }

    const removeItem = t.closest("[data-remove-from-collection]");
    if (removeItem) {
      event.stopPropagation();
      try {
        await API.collections.removeItem(openCollectionId, removeItem.dataset.removeFromCollection);
        toast("Removed from collection.");
        await loadCollections();
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const follow = t.closest("[data-follow]");
    if (follow) { toggleFollow(follow.dataset.follow, follow); return; }

    const report = t.closest("[data-report]");
    if (report) { openReport(report.dataset.report); return; }

    if (t.closest("[data-signin]")) { App.openAuth(); return; }

    if (t.closest("[data-new-collection-for-post]")) {
      const postId = currentPreviewPostId();
      openCreateCollection(async created => {
        if (!postId) return;
        try {
          await API.collections.add(created.id, postId);
          toast("Added to your new collection.");
          await loadCollections();
          const post = App.findPost(postId);
          if (post) renderCollectionPicker(post);
        } catch (error) {
          toast(error.message);
        }
      });
      return;
    }

    const add = t.closest("[data-add-to-collection]");
    if (add) {
      const collectionId = $("#pickCollection")?.value;
      if (!collectionId) return;
      add.disabled = true;
      try {
        const result = await API.collections.add(collectionId, add.dataset.addToCollection);
        toast(result === "exists" ? "Already in that collection." : "Added to collection.");
        await loadCollections();
      } catch (error) {
        toast(error.message);
      } finally {
        add.disabled = false;
      }
      return;
    }

    const del = t.closest("[data-delete-comment]");
    if (del) {
      try {
        await API.comments.remove(del.dataset.deleteComment);
        loadComments(currentPreviewPostId());
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    if (t.closest("#editProfile")) { openEditProfile(); return; }

    const userLink = t.closest("[data-user]");
    if (userLink) { openUserProfile(userLink.dataset.user); return; }

    const download = t.closest("[data-download]");
    if (download) { event.stopPropagation(); openDownload(download.dataset.download); return; }

    if (t.closest("[data-back]")) { App.navigate(prevPage || "home"); return; }

    const userMenu = t.closest("[data-user-menu]");
    if (userMenu) { openUserMenu(userMenu.dataset.userMenu); return; }

    if (t.closest("#manageBlocked")) { openBlockedList(); return; }

    const undo = t.closest("[data-undo]");
    if (undo) {
      const ok = undo.dataset.undo === "block"
        ? await setBlocked(undo.dataset.id, false)
        : await setMutedUser(undo.dataset.id, false);
      if (ok) openBlockedList();
      return;
    }

    const conversation = t.closest("[data-conversation]");
    if (conversation) { openConversation(conversation.dataset.conversation); return; }

    if (t.closest("#chatBack")) { closeConversation(); return; }
    if (t.closest("#chatMenuBtn")) { openChatMenu(); return; }
    if (t.closest("[data-new-message], #newMessage")) { openNewMessage(); return; }

    const startChat = t.closest("[data-start-chat]");
    if (startChat) {
      $("#newMessageModal")?.classList.remove("open");
      startChatWith(startChat.dataset.startChat);
      return;
    }

    const messageUser = t.closest("[data-message-user]");
    if (messageUser) {
      $("#previewModal")?.classList.remove("open");
      startChatWith(messageUser.dataset.messageUser);
      return;
    }

    // ----- inside an open chat -----
    const react = t.closest("[data-react]");
    if (react) { reactTo(react.dataset.id, react.dataset.react); return; }

    const reply = t.closest("[data-reply]");
    if (reply) { startReply(reply.dataset.reply); return; }

    const edit = t.closest("[data-edit]");
    if (edit) { startEdit(edit.dataset.edit); return; }

    const delMsg = t.closest("[data-delete]");
    if (delMsg) { deleteForEveryone(delMsg.dataset.delete); return; }

    const copy = t.closest("[data-copy]");
    if (copy) { copyMessage(copy.dataset.copy); return; }

    const jump = t.closest("[data-jump]");
    if (jump) {
      const target = $(`#chatBody [data-message="${CSS.escape(jump.dataset.jump)}"]`);
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        target.classList.add("flash");
        setTimeout(() => target.classList.remove("flash"), 1200);
      }
      return;
    }

    if (t.closest("[data-cancel-compose]")) { cancelReplyOrEdit(); return; }

    if (t.closest("#emojiBtn")) { const panel = $("#emojiPanel"); if (panel) panel.hidden = !panel.hidden; return; }

    const emoji = t.closest("[data-emoji]");
    if (emoji) {
      const area = $("#chatForm textarea");
      if (area) {
        const start = area.selectionStart ?? area.value.length;
        area.value = area.value.slice(0, start) + emoji.dataset.emoji + area.value.slice(area.selectionEnd ?? start);
        area.focus();
        area.dispatchEvent(new Event("input"));
      }
      return;
    }

    if (t.closest("#scrollDown")) {
      const body = $("#chatBody");
      if (body) body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
      newBelow = 0;
      return;
    }

    // tapping a message opens its menu (react, reply, copy, edit, delete)
    const bubble = t.closest("#chatBody [data-message]");
    if (bubble && !t.closest("a, .msg-menu, .quote")) {
      const id = bubble.dataset.message;
      const m = chatMessages.find(x => x.id === id);
      if (m && !m.deleted_at) {
        openMenuId = openMenuId === id ? null : id;
        renderChatMessages();
      }
      return;
    }
    if (openMenuId && !t.closest(".msg-menu")) { openMenuId = null; renderChatMessages(); }

    const tab = t.closest(".profile-tabs button");
    if (tab) { showProfileTab($$(".profile-tabs button").indexOf(tab)); }
  });

  document.addEventListener("submit", async event => {
    if (event.target.id === "chatForm") {
      event.preventDefault();
      submitChat(event.target);
      return;
    }

    if (event.target.id !== "commentForm") return;
    event.preventDefault();

    if (needSignIn("Sign in to comment.")) return;

    const formEl = event.target;
    const input = formEl.querySelector("input[name=body]");
    const postId = currentPreviewPostId();
    const button = formEl.querySelector("button");
    if (!postId || !input.value.trim()) return;

    button.disabled = true;
    try {
      await API.comments.add(postId, input.value);
      input.value = "";
      await loadComments(postId);
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  document.addEventListener("input", event => {
    if (event.target.id === "conversationSearch") renderConversationList();
  });

  window.addEventListener("pixora:preview", event => decoratePreview(event.detail.post));

  window.addEventListener("pixora:account", () => {
    openCollectionId = null;
    loadRelations();
    startMessaging();
    loadNotifications();
    loadCollections();
    if ($("#page-profile")?.classList.contains("active")) showProfileTab(profileTab);
  });

  window.addEventListener("pixora:navigate", event => {
    const page = event.detail?.page;
    if (page && page !== "user") prevPage = page;
    if (page === "notifications") loadNotifications();
    if (page === "collections") loadCollections();
    if (page === "messages") { startMessaging(); loadConversations(); renderChatPanel(); }
    if (page === "profile") showProfileTab(0);
  });

  /* ---------- start ---------- */

  installNotificationHeader();
  startNotificationPolling();
  setNotificationDot(0);
  if (me()) {
    loadRelations();
    loadNotifications();
    loadCollections();
    startMessaging();
  } else {
    renderNotifications();
    renderCollections();
    renderConversationList();
    renderChatPanel();
  }
})();
