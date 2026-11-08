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
              <b>${esc(nameOf(c.profiles))}</b>${esc(c.body)}
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
      button.textContent = following ? "Following" : "Follow " + nameOf(post?.profiles);
      toast(following ? "You're now following this creator." : "Unfollowed.");
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function openReport(postId) {
    if (needSignIn("Sign in to report a post.")) return;
    const post = App.findPost(postId);

    const reasons = ["Spam or scam", "Nudity or sexual content", "Harassment or hate", "Violence or harm", "Copyright infringement", "Something else"];
    const modal = makeModal("reportModal", `
      <div class="eyebrow">KEEP PIXORA SAFE</div>
      <h2>Report <span>this post.</span></h2>
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
          reportedUserId: post?.creator_id || null,
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
     MESSAGES
  ===================================================== */

  let conversations = [];
  let activeConversationId = null;
  let chatMessages = [];
  let unsubscribeMessages = null;
  let inboxTimer = null;
  let inboxLoading = false;
  let messagingUserId = null;

  const conversationName = (c) => c.display_name || c.username || "PIXORA member";
  const avatarOf = (c) => App.avatarInner({ avatar_url: c.avatar_url }, conversationName(c));

  function setUnreadBadge() {
    const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
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

    list.innerHTML = items.map(c => `
      <div class="conversation ${c.conversation_id === activeConversationId ? "active" : ""}" data-conversation="${esc(c.conversation_id)}">
        <span class="conversation-avatar">${avatarOf(c)}</span>
        <div class="conversation-copy">
          <b>${esc(conversationName(c))}${c.unread_count ? `<i class="nav-count">${c.unread_count}</i>` : ""}</b>
          <p>${esc(c.last_body || "Say hello")}</p>
        </div>
        <span class="conversation-time">${esc(timeAgo(c.last_at))}</span>
      </div>`).join("");
  }

  async function loadConversations() {
    if (!me()) {
      conversations = [];
      renderConversationList();
      setUnreadBadge();
      return;
    }
    if (inboxLoading) return;
    inboxLoading = true;

    try {
      conversations = await API.messages.conversations();
      // The chat you are looking at is always read.
      const active = conversations.find(c => c.conversation_id === activeConversationId);
      if (active) active.unread_count = 0;
      renderConversationList();
      setUnreadBadge();
    } catch (error) {
      console.error("Conversations:", error);
    } finally {
      inboxLoading = false;
    }
  }

  function renderChatPanel() {
    const panel = $("#chatPanel");
    if (!panel) return;

    if (!me()) {
      panel.innerHTML = `<div class="chat-empty"><span class="empty-icon">✉</span>
        <h3>Sign in to start chatting.</h3>
        <button class="primary-button" id="chatSignIn">Sign in</button></div>`;
      $("#chatSignIn")?.addEventListener("click", () => App.openAuth());
      return;
    }

    const c = conversations.find(x => x.conversation_id === activeConversationId);
    if (!c) {
      panel.innerHTML = `<div class="chat-empty"><span class="empty-icon">✉</span>
        <h3>Your conversations live here.</h3>
        <p>Choose a conversation or start a new one.</p>
        <button class="primary-button" data-new-message>Start a conversation</button></div>`;
      return;
    }

    panel.innerHTML = `
      <div class="chat-top">
        <span class="conversation-avatar">${avatarOf(c)}</span>
        <div><b>${esc(conversationName(c))}</b><small>${c.username ? "@" + esc(c.username) : ""}</small></div>
      </div>
      <div class="chat-body" id="chatBody"></div>
      <form class="chat-compose" id="chatForm">
        <input name="body" maxlength="5000" placeholder="Write a message" autocomplete="off">
        <button type="submit">Send</button>
      </form>`;
    renderChatMessages();
  }

  function messageHTML(m) {
    const mine = m.sender_id === me()?.id;
    return `
      <div class="message ${mine ? "mine" : ""}" data-message="${esc(m.id)}">${esc(m.body)}<small>${esc(timeAgo(m.created_at))}${mine
        ? ` · <button class="link-button" data-unsend="${esc(m.id)}" style="color:inherit;font-size:8px">Unsend</button>` : ""}</small></div>`;
  }

  function renderChatMessages() {
    const body = $("#chatBody");
    if (!body) return;
    body.innerHTML = chatMessages.length
      ? chatMessages.map(messageHTML).join("")
      : '<div class="chat-date">No messages yet. Say hello.</div>';
    body.scrollTop = body.scrollHeight;
  }

  async function openConversation(id) {
    activeConversationId = id;
    chatMessages = [];
    renderConversationList();
    renderChatPanel();

    try {
      const loaded = await API.messages.list(id);
      if (activeConversationId !== id) return;
      chatMessages = loaded;
      renderChatMessages();

      await API.messages.markRead(id);
      const c = conversations.find(x => x.conversation_id === id);
      if (c) c.unread_count = 0;
      renderConversationList();
      setUnreadBadge();
    } catch (error) {
      toast(error.message);
    }
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

  function onMessageChange(payload) {
    const row = payload.new;
    const old = payload.old;

    if (payload.eventType === "INSERT" && row) {
      if (row.conversation_id === activeConversationId) {
        if (!chatMessages.some(m => m.id === row.id)) {
          chatMessages.push(row);
          renderChatMessages();
        }
        if (row.sender_id !== me()?.id) API.messages.markRead(row.conversation_id).catch(() => {});
      }
    } else if (payload.eventType === "DELETE" && old?.id) {
      const before = chatMessages.length;
      chatMessages = chatMessages.filter(m => m.id !== old.id);
      if (chatMessages.length !== before) renderChatMessages();
    } else if (payload.eventType === "UPDATE" && row?.deleted_at) {
      chatMessages = chatMessages.filter(m => m.id !== row.id);
      renderChatMessages();
    }

    loadConversations();
  }

  function resetMessaging() {
    unsubscribeMessages?.();
    unsubscribeMessages = null;
    clearInterval(inboxTimer);
    conversations = [];
    chatMessages = [];
    activeConversationId = null;
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

    unsubscribeMessages = API.messages.subscribe(onMessageChange);
    loadConversations();

    // Safety net in case the live connection drops.
    inboxTimer = setInterval(() => {
      if (me() && !document.hidden) loadConversations();
    }, 30000);
  }

  function openNewMessage() {
    if (needSignIn("Sign in to send messages.")) return;

    const modal = makeModal("newMessageModal", `
      <div class="eyebrow">NEW MESSAGE</div>
      <h2>Message <span>someone.</span></h2>
      <input id="peopleSearch" type="search" placeholder="Search by name or username" autocomplete="off"
        style="width:100%;margin:14px 0;background:#0d090c;border:1px solid var(--line);border-radius:9px;padding:12px;color:var(--text)">
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

    const conversation = t.closest("[data-conversation]");
    if (conversation) { openConversation(conversation.dataset.conversation); return; }

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

    const unsend = t.closest("[data-unsend]");
    if (unsend) {
      if (!window.confirm("Unsend this message?")) return;
      try {
        await API.messages.remove(unsend.dataset.unsend);
        chatMessages = chatMessages.filter(m => m.id !== unsend.dataset.unsend);
        renderChatMessages();
        loadConversations();
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const tab = t.closest(".profile-tabs button");
    if (tab) { showProfileTab($$(".profile-tabs button").indexOf(tab)); }
  });

  document.addEventListener("submit", async event => {
    if (event.target.id === "chatForm") {
      event.preventDefault();
      const formEl = event.target;
      const input = formEl.querySelector("input[name=body]");
      const button = formEl.querySelector("button");
      const conversationId = activeConversationId;
      const text = input.value;
      if (!conversationId || !text.trim()) return;

      button.disabled = true;
      try {
        const sent = await API.messages.send(conversationId, text);
        input.value = "";
        if (conversationId === activeConversationId && !chatMessages.some(m => m.id === sent.id)) {
          chatMessages.push(sent);
          renderChatMessages();
        }
        loadConversations();
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
        input.focus();
      }
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
    startMessaging();
    loadNotifications();
    loadCollections();
    if ($("#page-profile")?.classList.contains("active")) showProfileTab(profileTab);
  });

  window.addEventListener("pixora:navigate", event => {
    const page = event.detail?.page;
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
