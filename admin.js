/* PIXORA Admin Control Center — CURRENT project only (fixed) */
(() => {
  "use strict";

  // Keep this page out of search engines.
  if (!document.querySelector('meta[name="robots"]')) {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);
  }

  const API = window.PIXORA;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  if (!API?.supabase) {
    $("#authMessage").innerHTML =
      '<div class="error">PIXORA backend did not load. Return to the homepage and refresh.</div>';
    return;
  }

  const db = API.supabase;

  let adminUser = null;
  let profiles = [];
  let posts = [];
  let reports = [];
  let actions = [];

  const esc = (value = "") =>
    String(value).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);

  const date = (v) => (v ? new Date(v).toLocaleString() : "—");
  const shortId = (v) => (v ? `${v.slice(0, 8)}…` : "—");

  function message(target, text, type = "error") {
    const el = $(target);
    if (el) el.innerHTML = `<div class="${type}">${esc(text)}</div>`;
  }

  function showAdmin(user) {
    adminUser = user;
    $("#authView").classList.add("hidden");
    $("#adminView").classList.remove("hidden");
    $("#adminIdentity").textContent = user.email || "PIXORA administrator";
    $("#securityIdentity").textContent = user.email || user.id;
    loadAll();
  }

  function showLogin() {
    adminUser = null;
    profiles = [];
    posts = [];
    reports = [];
    actions = [];
    $("#adminView").classList.add("hidden");
    $("#authView").classList.remove("hidden");
  }

  async function verifyAdmin(user) {
    const { data, error } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (data?.role !== "admin") {
      throw new Error("This account does not have the PIXORA admin role.");
    }
  }

  async function enterWithSession() {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) return;

    await verifyAdmin(data.session.user);
    showAdmin(data.session.user);
  }

  // ---------- login / logout ----------

  $("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const button = $("#loginButton");
    button.disabled = true;
    button.textContent = "Checking access…";
    $("#authMessage").innerHTML = "";

    try {
      const { error } = await db.auth.signInWithPassword({
        email: $("#email").value.trim().toLowerCase(),
        password: $("#password").value
      });
      if (error) throw error;

      const { data, error: userError } = await db.auth.getUser();
      if (userError) throw userError;

      await verifyAdmin(data.user);
      showAdmin(data.user);
      $("#password").value = "";
    } catch (error) {
      message("#authMessage", error.message || "Unable to sign in.");
      try {
        await db.auth.signOut();
      } catch (_) { /* ignore */ }
    } finally {
      button.disabled = false;
      button.textContent = "Sign in securely";
    }
  });

  $("#logoutButton").addEventListener("click", async () => {
    await db.auth.signOut();
    showLogin();
  });

  // If the session ends elsewhere (expired, signed out in another tab), leave the dashboard.
  window.addEventListener("pixora:auth", event => {
    if (event.detail?.event === "SIGNED_OUT" && adminUser) showLogin();
  });

  // ---------- navigation ----------

  $$(".side [data-section]").forEach(button => {
    button.addEventListener("click", () => {
      $$(".side [data-section]").forEach(i => i.classList.toggle("active", i === button));
      $$(".admin-section").forEach(s => s.classList.add("hidden"));
      $(`#section-${button.dataset.section}`).classList.remove("hidden");
    });
  });

  // ---------- data ----------

  async function countRows(table, filters = []) {
    let query = db.from(table).select("*", { count: "exact", head: true });
    for (const [column, value] of filters) query = query.eq(column, value);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  }

  async function loadAll() {
    $("#refreshButton").disabled = true;
    message("#pageMessage", "Refreshing live dashboard data…", "success");

    try {
      const [userCount, postCount, publishedCount, reportCount] = await Promise.all([
        countRows("profiles"),
        countRows("posts"),
        countRows("posts", [["status", "published"]]),
        countRows("reports", [["status", "open"]])
      ]);

      $("#statUsers").textContent = userCount.toLocaleString();
      $("#statPosts").textContent = postCount.toLocaleString();
      $("#statPublished").textContent = publishedCount.toLocaleString();
      $("#statReports").textContent = reportCount.toLocaleString();
      $("#reportBadge").textContent = reportCount ? `(${reportCount})` : "";

      // Profiles first so names resolve in the other tables.
      await loadProfiles();
      await Promise.all([loadPosts(), loadReports(), loadActions()]);

      renderRecentPosts();
      message("#pageMessage", "Dashboard data refreshed successfully.", "success");
    } catch (error) {
      message("#pageMessage", error.message || "Could not load dashboard data.");
      console.error("PIXORA admin dashboard:", error);
    } finally {
      $("#refreshButton").disabled = false;
    }
  }

  async function loadPosts() {
    const { data, error } = await db
      .from("posts")
      .select("id, creator_id, caption, post_type, visibility, status, created_at, published_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    posts = data || [];
    renderPosts();
  }

  async function loadReports() {
    const { data, error } = await db
      .from("reports")
      .select("id, reporter_id, reported_user_id, post_id, reason, details, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    reports = data || [];
    renderReports();
  }

  async function loadProfiles() {
    const { data, error } = await db
      .from("profiles")
      .select("id, username, display_name, bio, is_private, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    profiles = data || [];
    renderUsers();
  }

  async function loadActions() {
    const { data, error } = await db
      .from("moderation_actions")
      .select("id, moderator_id, target_user_id, post_id, action_type, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    actions = data || [];
    renderActions();
  }

  function profileName(id) {
    const p = profiles.find(item => item.id === id);
    return p ? (p.display_name || p.username || shortId(id)) : shortId(id);
  }

  // ---------- rendering ----------

  const table = (head, rows) => `
    <div class="table-wrap"><table>
      <thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table></div>`;

  const statusPill = (status, good) =>
    `<span class="pill ${status === good ? "green" : "orange"}">${esc(status)}</span>`;

  function renderRecentPosts() {
    const latest = posts.slice(0, 6);

    $("#recentPosts").innerHTML = latest.length
      ? table(["POST", "STATUS", "CREATED"], latest.map(post => `
          <tr>
            <td>${esc((post.caption || post.post_type || "Untitled post").slice(0, 70))}<br>
              <span class="muted">${esc(profileName(post.creator_id))}</span></td>
            <td>${statusPill(post.status, "published")}</td>
            <td>${esc(date(post.created_at))}</td>
          </tr>`))
      : '<div class="empty">No posts have been submitted yet.</div>';
  }

  function renderPosts() {
    const term = ($("#contentSearch")?.value || "").toLowerCase();
    const rows = posts.filter(post =>
      `${post.caption || ""} ${post.creator_id} ${post.status} ${profileName(post.creator_id)}`
        .toLowerCase().includes(term));

    $("#contentTable").innerHTML = rows.length
      ? table(["CAPTION / ID", "CREATOR", "TYPE", "STATUS", "DATE", "ACTION"], rows.map(post => `
          <tr>
            <td>${esc((post.caption || "No caption").slice(0, 90))}<br>
              <span class="muted">${esc(shortId(post.id))}</span></td>
            <td>${esc(profileName(post.creator_id))}</td>
            <td>${esc(post.post_type)}</td>
            <td>${statusPill(post.status, "published")}</td>
            <td>${esc(date(post.created_at))}</td>
            <td>${post.status === "removed"
              ? '<span class="muted">Removed</span>'
              : `<button class="action danger" data-remove-post="${esc(post.id)}">Remove post</button>`}</td>
          </tr>`))
      : '<div class="empty">No matching posts found.</div>';
  }

  function renderReports() {
    const term = ($("#reportSearch")?.value || "").toLowerCase();
    const rows = reports.filter(r =>
      `${r.reason} ${r.details || ""} ${r.id} ${r.status}`.toLowerCase().includes(term));

    $("#reportsTable").innerHTML = rows.length
      ? table(["REASON / DETAILS", "REPORTER", "REPORTED USER / POST", "STATUS", "DATE", "ACTION"],
          rows.map(r => `
          <tr>
            <td><b>${esc(r.reason)}</b><br>
              <span class="muted">${esc(r.details || "No additional details")}</span></td>
            <td>${esc(profileName(r.reporter_id))}</td>
            <td>${esc(r.reported_user_id ? profileName(r.reported_user_id) : "—")}<br>
              <span class="muted">${esc(shortId(r.post_id))}</span></td>
            <td>${statusPill(r.status, "resolved")}</td>
            <td>${esc(date(r.created_at))}</td>
            <td>${r.status === "resolved" || r.status === "dismissed"
              ? '<span class="muted">Completed</span>'
              : `<button class="action" data-resolve-report="${esc(r.id)}">Mark resolved</button>`}</td>
          </tr>`))
      : '<div class="empty">No matching reports.</div>';
  }

  function renderUsers() {
    const term = ($("#userSearch")?.value || "").toLowerCase();
    const rows = profiles.filter(p =>
      `${p.username || ""} ${p.display_name || ""} ${p.id}`.toLowerCase().includes(term));

    $("#usersTable").innerHTML = rows.length
      ? table(["MEMBER", "USERNAME", "PROFILE VISIBILITY", "JOINED", "USER ID"], rows.map(p => `
          <tr>
            <td>${esc(p.display_name || "PIXORA member")}</td>
            <td>${esc(p.username || "—")}</td>
            <td><span class="pill">${p.is_private ? "Private" : "Public"}</span></td>
            <td>${esc(date(p.created_at))}</td>
            <td>${esc(shortId(p.id))}</td>
          </tr>`))
      : '<div class="empty">No matching profiles.</div>';
  }

  function renderActions() {
    $("#actionsTable").innerHTML = actions.length
      ? table(["ACTION", "MODERATOR", "TARGET USER", "POST ID", "REASON", "DATE"], actions.map(a => `
          <tr>
            <td>${esc(a.action_type)}</td>
            <td>${esc(profileName(a.moderator_id))}</td>
            <td>${esc(a.target_user_id ? profileName(a.target_user_id) : "—")}</td>
            <td>${esc(shortId(a.post_id))}</td>
            <td>${esc(a.reason || "—")}</td>
            <td>${esc(date(a.created_at))}</td>
          </tr>`))
      : '<div class="empty">No moderation actions recorded yet.</div>';
  }

  // ---------- moderation actions (atomic, audited in the database) ----------

  document.addEventListener("click", async event => {
    const removeButton = event.target.closest("[data-remove-post]");
    const resolveButton = event.target.closest("[data-resolve-report]");

    if (removeButton) {
      const reason = window.prompt("Reason for removing this post:");
      if (!reason || !reason.trim()) return;

      removeButton.disabled = true;
      try {
        const { error } = await db.rpc("admin_remove_post", {
          p_post_id: removeButton.dataset.removePost,
          p_reason: reason.trim().slice(0, 1000)
        });
        if (error) throw error;
        await loadAll();
      } catch (error) {
        alert(`Could not complete moderation action: ${error.message}`);
        removeButton.disabled = false;
      }
    }

    if (resolveButton) {
      if (!window.confirm("Mark this report as resolved?")) return;

      resolveButton.disabled = true;
      try {
        const { error } = await db.rpc("admin_resolve_report", {
          p_report_id: resolveButton.dataset.resolveReport
        });
        if (error) throw error;
        await loadAll();
      } catch (error) {
        alert(`Could not resolve report: ${error.message}`);
        resolveButton.disabled = false;
      }
    }
  });

  $("#contentSearch").addEventListener("input", renderPosts);
  $("#reportSearch").addEventListener("input", renderReports);
  $("#userSearch").addEventListener("input", renderUsers);
  $("#refreshButton").addEventListener("click", loadAll);

  enterWithSession().catch(error => {
    console.warn("No active admin session:", error.message);
    if (error.message.includes("does not have the PIXORA admin role")) {
      message("#authMessage", error.message);
    }
  });
})();
