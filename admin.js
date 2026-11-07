
/* PIXORA Admin Control Center — CURRENT project only */
(() => {
  "use strict";

  const API = window.PIXORA;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

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
    String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);

  const date = value =>
    value ? new Date(value).toLocaleString() : "—";

  const shortId = value =>
    value ? `${value.slice(0, 8)}…` : "—";

  function message(target, text, type = "error") {
    const el = $(target);
    if (!el) return;

    el.innerHTML =
      `<div class="${type}">${esc(text)}</div>`;
  }

  function showAdmin(user) {
    adminUser = user;

    $("#authView").classList.add("hidden");
    $("#adminView").classList.remove("hidden");

    $("#adminIdentity").textContent =
      user.email || "PIXORA administrator";

    $("#securityIdentity").textContent =
      user.email || user.id;

    loadAll();
  }

  async function verifyAdmin(user) {
    const { data, error } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (data?.role !== "admin") {
      throw new Error(
        "This account does not have the PIXORA admin role."
      );
    }

    return true;
  }

  async function enterWithSession() {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    if (!data.session?.user) return;

    await verifyAdmin(data.session.user);
    showAdmin(data.session.user);
  }

  // ADMIN LOGIN

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

      const { data, error: userError } =
        await db.auth.getUser();

      if (userError) throw userError;

      await verifyAdmin(data.user);

      showAdmin(data.user);

      $("#password").value = "";

    } catch (error) {
      message(
        "#authMessage",
        error.message || "Unable to sign in."
      );

      try {
        const { data } = await db.auth.getSession();

        if (data.session?.user) {
          await db.auth.signOut();
        }
      } catch (_) {}

    } finally {
      button.disabled = false;
      button.textContent = "Sign in securely";
    }
  });

  // ADMIN LOGOUT

  $("#logoutButton").addEventListener("click", async () => {
    await db.auth.signOut();

    adminUser = null;

    $("#adminView").classList.add("hidden");
    $("#authView").classList.remove("hidden");
  });

  // NAVIGATION

  $$(".side [data-section]").forEach(button => {
    button.addEventListener("click", () => {
      $$(".side [data-section]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      $$(".admin-section").forEach(section => {
        section.classList.add("hidden");
      });

      $(`#section-${button.dataset.section}`)
        .classList.remove("hidden");
    });
  });

  // DATABASE COUNTS

  async function countRows(table, filters = []) {
    let query = db
      .from(table)
      .select("*", { count: "exact", head: true });

    for (const [column, value] of filters) {
      query = query.eq(column, value);
    }

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  }

  // LOAD DASHBOARD

  async function loadAll() {
    $("#refreshButton").disabled = true;

    message(
      "#pageMessage",
      "Refreshing live dashboard data…",
      "success"
    );

    try {
      const [
        userCount,
        postCount,
        publishedCount,
        reportCount
      ] = await Promise.all([
        countRows("profiles"),
        countRows("posts"),
        countRows("posts", [["status", "published"]]),
        countRows("reports", [["status", "open"]])
      ]);

      $("#statUsers").textContent =
        userCount.toLocaleString();

      $("#statPosts").textContent =
        postCount.toLocaleString();

      $("#statPublished").textContent =
        publishedCount.toLocaleString();

      $("#statReports").textContent =
        reportCount.toLocaleString();

      $("#reportBadge").textContent =
        reportCount ? `(${reportCount})` : "";

      await Promise.all([
        loadPosts(),
        loadReports(),
        loadProfiles(),
        loadActions()
      ]);

      renderRecentPosts();

      message(
        "#pageMessage",
        "Dashboard data refreshed successfully.",
        "success"
      );

    } catch (error) {
      message(
        "#pageMessage",
        error.message || "Could not load dashboard data."
      );

      console.error(
        "PIXORA admin dashboard:",
        error
      );

    } finally {
      $("#refreshButton").disabled = false;
    }
  }

  // LOAD POSTS

  async function loadPosts() {
    const { data, error } = await db
      .from("posts")
      .select(`
        id,
        creator_id,
        caption,
        post_type,
        visibility,
        status,
        created_at,
        published_at
      `)
      .order("created_at", {
        ascending: false
      })
      .limit(100);

    if (error) throw error;

    posts = data || [];

    renderPosts();
  }

  // LOAD REPORTS

  async function loadReports() {
    const { data, error } = await db
      .from("reports")
      .select(`
        id,
        reporter_id,
        reported_user_id,
        post_id,
        reason,
        details,
        status,
        created_at
      `)
      .order("created_at", {
        ascending: false
      })
      .limit(100);

    if (error) throw error;

    reports = data || [];

    renderReports();
  }

  // LOAD PROFILES

  async function loadProfiles() {
    const { data, error } = await db
      .from("profiles")
      .select(`
        id,
        username,
        display_name,
        bio,
        is_private,
        created_at
      `)
      .order("created_at", {
        ascending: false
      })
      .limit(200);

    if (error) throw error;

    profiles = data || [];

    renderUsers();
  }

  // LOAD MODERATION HISTORY

  async function loadActions() {
    const { data, error } = await db
      .from("moderation_actions")
      .select(`
        id,
        moderator_id,
        target_user_id,
        post_id,
        action_type,
        reason,
        created_at
      `)
      .order("created_at", {
        ascending: false
      })
      .limit(100);

    if (error) throw error;

    actions = data || [];

    renderActions();
  }

  // PROFILE NAME HELPER

  function profileName(id) {
    const profile = profiles.find(
      item => item.id === id
    );

    return profile
      ? (
          profile.display_name ||
          profile.username ||
          shortId(id)
        )
      : shortId(id);
  }

  // RECENT POSTS

  function renderRecentPosts() {
    const latest = posts.slice(0, 6);

    $("#recentPosts").innerHTML = latest.length
      ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>POST</th>
                <th>STATUS</th>
                <th>CREATED</th>
              </tr>
            </thead>
            <tbody>
              ${latest.map(post => `
                <tr>
                  <td>
                    ${esc(
                      (post.caption || post.post_type || "Untitled post").slice(0, 70)
                    )}
                    <br>
                    <span class="muted">
                      ${esc(profileName(post.creator_id))}
                    </span>
                  </td>
                  <td>
                    <span class="pill ${
                      post.status === "published"
                        ? "green"
                        : "orange"
                    }">
                      ${esc(post.status)}
                    </span>
                  </td>
                  <td>${esc(date(post.created_at))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : '<div class="empty">No posts have been submitted yet.</div>';
  }

  // CONTENT TABLE

  function renderPosts() {
    const term =
      ($("#contentSearch")?.value || "").toLowerCase();

    const rows = posts.filter(post =>
      `${post.caption || ""} ${post.creator_id} ${post.status}`
        .toLowerCase()
        .includes(term)
    );

    $("#contentTable").innerHTML = rows.length
      ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CAPTION / ID</th>
                <th>CREATOR</th>
                <th>TYPE</th>
                <th>STATUS</th>
                <th>DATE</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(post => `
                <tr>
                  <td>
                    ${esc((post.caption || "No caption").slice(0, 90))}
                    <br>
                    <span class="muted">
                      ${esc(shortId(post.id))}
                    </span>
                  </td>
                  <td>${esc(profileName(post.creator_id))}</td>
                  <td>${esc(post.post_type)}</td>
                  <td>
                    <span class="pill ${
                      post.status === "published"
                        ? "green"
                        : "orange"
                    }">
                      ${esc(post.status)}
                    </span>
                  </td>
                  <td>${esc(date(post.created_at))}</td>
                  <td>
                    ${
                      post.status === "removed"
                        ? '<span class="muted">Removed</span>'
                        : `
                          <button
                            class="action danger"
                            data-remove-post="${esc(post.id)}"
                          >
                            Remove post
                          </button>
                        `
                    }
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : '<div class="empty">No matching posts found.</div>';
  }

  // REPORTS TABLE

  function renderReports() {
    const term =
      ($("#reportSearch")?.value || "").toLowerCase();

    const rows = reports.filter(report =>
      `${report.reason} ${report.details || ""} ${report.id} ${report.status}`
        .toLowerCase()
        .includes(term)
    );

    $("#reportsTable").innerHTML = rows.length
      ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>REASON / DETAILS</th>
                <th>REPORTER</th>
                <th>REPORTED USER / POST</th>
                <th>STATUS</th>
                <th>DATE</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(report => `
                <tr>
                  <td>
                    <b>${esc(report.reason)}</b>
                    <br>
                    <span class="muted">
                      ${esc(report.details || "No additional details")}
                    </span>
                  </td>
                  <td>${esc(profileName(report.reporter_id))}</td>
                  <td>
                    ${esc(
                      report.reported_user_id
                        ? profileName(report.reported_user_id)
                        : "—"
                    )}
                    <br>
                    <span class="muted">
                      ${esc(shortId(report.post_id))}
                    </span>
                  </td>
                  <td>
                    <span class="pill ${
                      report.status === "resolved"
                        ? "green"
                        : "orange"
                    }">
                      ${esc(report.status)}
                    </span>
                  </td>
                  <td>${esc(date(report.created_at))}</td>
                  <td>
                    ${
                      report.status === "resolved"
                        ? '<span class="muted">Completed</span>'
                        : `
                          <button
                            class="action"
                            data-resolve-report="${esc(report.id)}"
                          >
                            Mark resolved
                          </button>
                        `
                    }
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : '<div class="empty">No matching reports.</div>';
  }

  // USERS TABLE

  function renderUsers() {
    const term =
      ($("#userSearch")?.value || "").toLowerCase();

    const rows = profiles.filter(profile =>
      `${profile.username || ""} ${profile.display_name || ""} ${profile.id}`
        .toLowerCase()
        .includes(term)
    );

    $("#usersTable").innerHTML = rows.length
      ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>MEMBER</th>
                <th>USERNAME</th>
                <th>PROFILE VISIBILITY</th>
                <th>JOINED</th>
                <th>USER ID</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(profile => `
                <tr>
                  <td>${esc(profile.display_name || "PIXORA member")}</td>
                  <td>${esc(profile.username || "—")}</td>
                  <td>
                    <span class="pill">
                      ${profile.is_private ? "Private" : "Public"}
                    </span>
                  </td>
                  <td>${esc(date(profile.created_at))}</td>
                  <td>${esc(shortId(profile.id))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : '<div class="empty">No matching profiles.</div>';
  }

  // MODERATION HISTORY

  function renderActions() {
    $("#actionsTable").innerHTML = actions.length
      ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ACTION</th>
                <th>MODERATOR</th>
                <th>TARGET USER</th>
                <th>POST ID</th>
                <th>REASON</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody>
              ${actions.map(action => `
                <tr>
                  <td>${esc(action.action_type)}</td>
                  <td>${esc(profileName(action.moderator_id))}</td>
                  <td>
                    ${esc(
                      action.target_user_id
                        ? profileName(action.target_user_id)
                        : "—"
                    )}
                  </td>
                  <td>${esc(shortId(action.post_id))}</td>
                  <td>${esc(action.reason || "—")}</td>
                  <td>${esc(date(action.created_at))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : '<div class="empty">No moderation actions recorded yet.</div>';
  }

  // ADMIN AUDIT LOG

  async function writeAudit(
    action,
    targetType,
    targetId,
    metadata = {}
  ) {
    const { error } = await db
      .from("admin_audit_logs")
      .insert({
        admin_id: adminUser.id,
        action,
        target_type: targetType,
        target_id: targetId,
        metadata
      });

    if (error) throw error;
  }

  // MODERATION ACTIONS

  document.addEventListener("click", async event => {
    const removeButton =
      event.target.closest("[data-remove-post]");

    const resolveButton =
      event.target.closest("[data-resolve-report]");

    // REMOVE POST

    if (removeButton) {
      const postId = removeButton.dataset.removePost;

      const reason = window.prompt(
        "Reason for removing this post:"
      );

      if (!reason || !reason.trim()) return;

      removeButton.disabled = true;

      try {
        const post = posts.find(
          item => item.id === postId
        );

        const { error } = await db
          .from("posts")
          .update({ status: "removed" })
          .eq("id", postId);

        if (error) throw error;

        const { error: actionError } = await db
          .from("moderation_actions")
          .insert({
            moderator_id: adminUser.id,
            target_user_id: post?.creator_id || null,
            post_id: postId,
            action_type: "remove_post",
            reason: reason.trim().slice(0, 1000)
          });

        if (actionError) throw actionError;

        await writeAudit(
          "remove_post",
          "post",
          postId,
          { reason: reason.trim() }
        );

        await loadAll();

      } catch (error) {
        alert(
          `Could not complete moderation action: ${error.message}`
        );

        removeButton.disabled = false;
      }
    }

    // RESOLVE REPORT

    if (resolveButton) {
      const reportId =
        resolveButton.dataset.resolveReport;

      if (!window.confirm(
        "Mark this report as resolved?"
      )) return;

      resolveButton.disabled = true;

      try {
        const { error } = await db
          .from("reports")
          .update({ status: "resolved" })
          .eq("id", reportId);

        if (error) throw error;

        await writeAudit(
          "resolve_report",
          "report",
          reportId,
          {}
        );

        await loadAll();

      } catch (error) {
        alert(
          `Could not resolve report: ${error.message}`
        );

        resolveButton.disabled = false;
      }
    }
  });

  // SEARCH LISTENERS

  $("#contentSearch").addEventListener(
    "input",
    renderPosts
  );

  $("#reportSearch").addEventListener(
    "input",
    renderReports
  );

  $("#userSearch").addEventListener(
    "input",
    renderUsers
  );

  // REFRESH BUTTON

  $("#refreshButton").addEventListener(
    "click",
    loadAll
  );

  // CHECK EXISTING SESSION

  enterWithSession().catch(error => {
    console.warn(
      "No active admin session:",
      error.message
    );

    if (
      error.message.includes(
        "does not have the PIXORA admin role"
      )
    ) {
      message("#authMessage", error.message);
    }
  });

})();
