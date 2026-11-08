/* =========================================================
   CURRENT PIXORA BACKEND (fixed)
   Supabase auth, profiles, uploads, publishing, feed,
   likes (with counts) and saves.
   ========================================================= */
(() => {
  "use strict";

  const SUPABASE_URL = "https://nvixxssenrgbviewimix.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PmVE-SElQpR-MbldI-2aWg_i9BE6dXD";

  const PUBLIC_BUCKET = "pixora-public-media";
  const MAX_FILE_BYTES = 50 * 1024 * 1024;
  const MAX_POST_FILES = 10;

  const ALLOWED_TYPES = new Set([
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/webm"
  ]);

  if (!window.supabase?.createClient) {
    console.error("PIXORA: Supabase library was not loaded.");
    return;
  }
  if (window.PIXORA) {
    console.warn("PIXORA backend was already initialized.");
    return;
  }

  const client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );

  // ---------- helpers ----------

  function cleanError(error) {
    return new Error(
      error?.message || error?.error_description ||
      "Something went wrong. Please try again."
    );
  }

  // Turns Supabase sign-in/sign-up errors into plain language.
  // The returned error keeps a short `code` so the screen can react (e.g. offer "resend email").
  function authError(error) {
    const code = String(error?.code || "").toLowerCase();
    const text = String(error?.message || "").toLowerCase();
    const has = (...parts) => parts.some(p => code.includes(p) || text.includes(p));

    let message;
    let kind = "unknown";

    if (has("invalid_credentials", "invalid login credentials")) {
      message = "Incorrect email or password."; kind = "bad_credentials";
    } else if (has("email_not_confirmed", "email not confirmed")) {
      message = "Please confirm your email first. Check your inbox (and spam) for our message."; kind = "email_not_confirmed";
    } else if (has("user_already_exists", "already registered", "already been registered")) {
      message = "An account with this email already exists. Try signing in."; kind = "exists";
    } else if (has("weak_password", "password should", "password is known")) {
      message = "Choose a stronger password: at least 8 characters, and not one that's commonly used."; kind = "weak_password";
    } else if (has("same_password", "different from the old")) {
      message = "Your new password must be different from the old one."; kind = "same_password";
    } else if (has("over_email_send_rate_limit", "email rate limit", "rate limit")) {
      message = "Too many emails were requested. Please wait a few minutes and try again."; kind = "rate_limit";
    } else if (has("over_request_rate_limit", "too many requests")) {
      message = "Too many attempts. Please wait a minute and try again."; kind = "rate_limit";
    } else if (has("signup_disabled", "signups not allowed")) {
      message = "New sign-ups are turned off right now."; kind = "signup_disabled";
    } else if (has("email_address_invalid", "invalid email", "unable to validate email")) {
      message = "That email address doesn't look right."; kind = "bad_email";
    } else if (has("failed to fetch", "networkerror", "network request failed")) {
      message = "Can't reach PIXORA. Check your connection and try again."; kind = "network";
    } else if (has("database error saving new user")) {
      message = "We couldn't finish creating your account. Please try a different username."; kind = "database";
    } else if (has("session_not_found", "jwt expired", "auth session missing")) {
      message = "Your session has expired. Please sign in again."; kind = "session";
    } else {
      message = error?.message || "Something went wrong. Please try again.";
    }

    const out = new Error(message);
    out.kind = kind;
    return out;
  }

  // Where email links (confirm / reset) should bring people back to.
  function siteUrl() {
    return /^https?:$/.test(location.protocol) ? location.origin + location.pathname : undefined;
  }

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function requireValue(value, message) {
    if (!value) throw new Error(message);
  }

  async function requireUser() {
    const { data, error } = await client.auth.getUser();
    if (error) throw cleanError(error);
    if (!data?.user) throw new Error("Please sign in before doing that.");
    return data.user;
  }

  function safeFileName(name) {
    return String(name || "upload")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-90) || "upload";
  }

  function createFileId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function validateFile(file) {
    if (!(file instanceof File)) throw new Error("Choose an image or video file.");
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error("Unsupported format. Use JPG, PNG, WebP, GIF, MP4 or WebM.");
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      throw new Error("File must be between 1 byte and 50 MB.");
    }
  }

  // ---------- auth ----------

  async function usernameAvailable(username) {
    const { data, error } = await client.rpc("username_available", {
      p_username: String(username || "").trim().toLowerCase()
    });
    if (error) return null;      // unknown: let the database decide
    return Boolean(data);
  }

  async function signUp({ email, password, username, displayName } = {}) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) throw new Error("Enter your email address.");
    if (!EMAIL_PATTERN.test(cleanEmail)) throw new Error("That email address doesn't look right.");

    if (!password) throw new Error("Choose a password.");
    if (String(password).length < 8) {
      throw new Error("Your password needs at least 8 characters.");
    }

    const cleanUsername = String(username || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      throw new Error("Usernames can use letters, numbers and underscores only (3 to 30 characters).");
    }

    if ((await usernameAvailable(cleanUsername)) === false) {
      throw new Error("That username isn't available. Try another one.");
    }

    const { data, error } = await client.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: siteUrl(),
        data: {
          username: cleanUsername,
          display_name: String(displayName || cleanUsername).trim().slice(0, 80)
        }
      }
    });
    if (error) throw authError(error);

    // For an email that is already registered Supabase answers "success" with no identities.
    const alreadyRegistered =
      Boolean(data?.user) && Array.isArray(data.user.identities) && data.user.identities.length === 0;
    if (alreadyRegistered) {
      const out = new Error("An account with this email already exists. Try signing in, or reset your password.");
      out.kind = "exists";
      throw out;
    }

    return { user: data.user, session: data.session, needsConfirmation: !data.session };
  }

  async function signIn({ email, password } = {}) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) throw new Error("Enter your email address.");
    if (!EMAIL_PATTERN.test(cleanEmail)) throw new Error("That email address doesn't look right.");
    if (!password) throw new Error("Enter your password.");

    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password: String(password)
    });
    if (error) throw authError(error);
    return data;
  }

  async function resendConfirmation(email) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!EMAIL_PATTERN.test(cleanEmail)) throw new Error("Enter your email address first.");
    const { error } = await client.auth.resend({
      type: "signup",
      email: cleanEmail,
      options: { emailRedirectTo: siteUrl() }
    });
    if (error) throw authError(error);
    return true;
  }

  async function requestPasswordReset(email) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!EMAIL_PATTERN.test(cleanEmail)) throw new Error("Enter the email address you signed up with.");
    const { error } = await client.auth.resetPasswordForEmail(cleanEmail, { redirectTo: siteUrl() });
    if (error) throw authError(error);
    return true;
  }

  async function updatePassword(password) {
    if (String(password || "").length < 8) {
      throw new Error("Your new password needs at least 8 characters.");
    }
    const { error } = await client.auth.updateUser({ password: String(password) });
    if (error) throw authError(error);
    return true;
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) throw cleanError(error);
    return true;
  }

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw cleanError(error);
    return data.session;
  }

  // ---------- profiles & categories ----------

  async function getProfile(userId) {
    const id = userId || (await requireUser()).id;
    const { data, error } = await client
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url, cover_url, website, is_private, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw cleanError(error);
    return data;
  }

  async function getCategories() {
    const { data, error } = await client
      .from("categories")
      .select("id, name, slug")
      .order("name");
    if (error) throw cleanError(error);
    return data || [];
  }

  // ---------- media upload ----------

  async function uploadMedia(file, options = {}) {
    const user = await requireUser();
    validateFile(file);

    if (options.visibility && options.visibility !== "public") {
      throw new Error("Private and followers-only uploads are not enabled yet.");
    }

    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    const objectPath = `${user.id}/${createFileId()}-${safeFileName(file.name)}`;

    const { error: uploadError } = await client.storage
      .from(PUBLIC_BUCKET)
      .upload(objectPath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      });
    if (uploadError) throw cleanError(uploadError);

    // NOTE: the database only lets a post be published when its media is
    // "ready", and there is no processing pipeline yet, so images/videos
    // are marked ready on upload. Revisit when transcoding is added.
    const { data: asset, error: assetError } = await client
      .from("media_assets")
      .insert({
        owner_id: user.id,
        media_type: mediaType,
        storage_bucket: PUBLIC_BUCKET,
        storage_path: objectPath,
        mime_type: file.type,
        file_size_bytes: file.size,
        processing_status: "ready",
        alt_text: String(options.altText || "").trim().slice(0, 500) || null
      })
      .select("id, media_type, storage_bucket, storage_path, mime_type, file_size_bytes, processing_status, alt_text")
      .single();

    if (assetError) {
      await client.storage.from(PUBLIC_BUCKET).remove([objectPath]);
      throw cleanError(assetError);
    }

    const { data: publicData } = client.storage
      .from(PUBLIC_BUCKET)
      .getPublicUrl(objectPath);

    return { ...asset, publicUrl: publicData.publicUrl };
  }

  async function deleteUploadedAssets(assets, userId) {
    for (const asset of assets) {
      try {
        await client.storage.from(asset.storage_bucket).remove([asset.storage_path]);
        await client.from("media_assets").delete()
          .eq("id", asset.id).eq("owner_id", userId);
      } catch (cleanupError) {
        console.error("PIXORA cleanup warning:", cleanupError);
      }
    }
  }

  // ---------- publishing ----------

  async function publishPost({
    files,
    caption = "",
    categoryId = null,
    categoryIds = [],
    tags = [],
    visibility = "public",
    allowComments = true
  } = {}) {
    const user = await requireUser();
    const selectedFiles = Array.from(files || []);
    const cleanedTags = cleanTags(tags);

    if (!selectedFiles.length) throw new Error("Select at least one image or video.");
    if (selectedFiles.length > MAX_POST_FILES) {
      throw new Error("A post can contain up to 10 media files.");
    }
    if (String(caption).length > 5000) throw new Error("Caption is too long.");
    if (visibility !== "public") {
      throw new Error("Only public publishing is currently enabled.");
    }

    selectedFiles.forEach(validateFile);

    const hasVideo = selectedFiles.some(f => f.type.startsWith("video/"));
    const hasImage = selectedFiles.some(f => f.type.startsWith("image/"));

    if (hasVideo && hasImage) {
      throw new Error("Image and video files cannot be mixed in one post yet.");
    }
    if (hasVideo && selectedFiles.length > 1) {
      throw new Error("Only one video is supported per post currently.");
    }

    const assets = [];
    let postId = null;

    try {
      for (const file of selectedFiles) {
        // Alt text is left empty: a caption is not a description of each file.
        assets.push(await uploadMedia(file, { visibility }));
      }

      const postType = hasVideo ? "video" : assets.length > 1 ? "carousel" : "image";

      const { data: post, error: postError } = await client
        .from("posts")
        .insert({
          creator_id: user.id,
          caption: String(caption).trim() || null,
          post_type: postType,
          visibility: "public",
          status: "draft",
          allow_comments: Boolean(allowComments),
          published_at: null
        })
        .select("id")
        .single();
      if (postError) throw cleanError(postError);
      postId = post.id;

      const { error: linkError } = await client.from("post_media").insert(
        assets.map((asset, index) => ({
          post_id: post.id,
          media_asset_id: asset.id,
          display_order: index,
          is_cover: index === 0
        }))
      );
      if (linkError) throw cleanError(linkError);

      const ids = [...new Set([categoryId, ...categoryIds].filter(Boolean))];
      if (ids.length) {
        const { error: categoryError } = await client
          .from("post_categories")
          .insert(ids.map(id => ({ post_id: post.id, category_id: id })));
        if (categoryError) throw cleanError(categoryError);
      }

      if (cleanedTags.length) {
        const { error: tagError } = await client.rpc("set_post_tags", {
          p_post_id: post.id,
          p_tags: cleanedTags
        });
        if (tagError) throw cleanError(tagError);
      }

      const { data: publishedPost, error: publishError } = await client
        .from("posts")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", post.id)
        .eq("creator_id", user.id)
        .select("id, creator_id, caption, post_type, visibility, status, published_at, created_at")
        .single();
      if (publishError) throw cleanError(publishError);

      return { ...publishedPost, media: assets };

    } catch (error) {
      if (postId) {
        const { error: deletePostError } = await client
          .from("posts").delete().eq("id", postId).eq("creator_id", user.id);
        if (deletePostError) {
          console.error("PIXORA post cleanup warning:", deletePostError);
        }
      }
      await deleteUploadedAssets(assets, user.id);
      throw error;
    }
  }

  // ---------- feed ----------

  const FEED_SELECT = `
    id, creator_id, caption, post_type, visibility, published_at, created_at,
    profiles:creator_id ( id, username, display_name, avatar_url ),
    post_media (
      id, display_order, is_cover,
      media_assets ( id, media_type, storage_bucket, storage_path, mime_type, alt_text )
    ),
    post_categories ( categories ( id, name, slug ) ),
    post_tags ( tags ( id, name, slug ) ),
    like_count
  `;

  function mapPost(post) {
    const media = (post.post_media || [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map(link => {
        const asset = link.media_assets;
        if (!asset) return null;
        const { data: urlData } = client.storage
          .from(asset.storage_bucket)
          .getPublicUrl(asset.storage_path);
        return { ...asset, publicUrl: urlData.publicUrl };
      })
      .filter(Boolean);

    const categories = (post.post_categories || [])
      .map(row => row.categories)
      .filter(Boolean);

    const tags = (post.post_tags || [])
      .map(row => row.tags)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      ...post,
      media,
      categories,
      tags,
      likeCount: post.like_count ?? 0
    };
  }

  async function getFeed({ limit = 24, before = null } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 50);

    let query = client
      .from("posts")
      .select(FEED_SELECT)
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false })
      .limit(safeLimit);

    if (before) query = query.lt("published_at", before);

    const { data, error } = await query;
    if (error) throw cleanError(error);
    return (data || []).map(mapPost);
  }

  async function getPostsByIds(ids = [], { keepOrder = false } = {}) {
    const list = [...new Set(ids)].filter(Boolean).slice(0, 100);
    if (!list.length) return [];

    const { data, error } = await client
      .from("posts")
      .select(FEED_SELECT)
      .in("id", list)
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) throw cleanError(error);

    const mapped = (data || []).map(mapPost);
    if (!keepOrder) return mapped;

    const position = new Map(list.map((id, index) => [id, index]));
    return mapped.sort((a, b) => position.get(a.id) - position.get(b.id));
  }

  // Ranked search across tags, captions and creator names (done in the database).
  async function searchPosts(query, limit = 40) {
    const text = String(query || "").trim().slice(0, 100);
    if (text.length < 2) return [];

    const { data, error } = await client.rpc("search_posts", {
      p_query: text,
      p_limit: limit
    });
    if (error) throw cleanError(error);

    return getPostsByIds((data || []).map(row => row.post_id), { keepOrder: true });
  }

  // ---------- tags ----------

  function cleanTags(input) {
    const list = Array.isArray(input) ? input : String(input || "").split(",");
    const seen = new Set();
    for (const raw of list) {
      const tag = String(raw).trim().replace(/^#+/, "").replace(/\s+/g, " ").trim().toLowerCase();
      if (tag.length < 2 || tag.length > 40) continue;
      if (!/^[\p{L}\p{N} .'-]+$/u.test(tag)) continue;
      seen.add(tag);
    }
    return [...seen].slice(0, 15);
  }

  async function suggestTags(prefix) {
    const text = String(prefix || "").trim().toLowerCase().replace(/[%_,()*\\]/g, "");
    if (text.length < 2) return [];
    const { data, error } = await client
      .from("tags").select("name").ilike("name", text + "%").order("name").limit(8);
    if (error) throw cleanError(error);
    return (data || []).map(row => row.name);
  }

  async function isAdmin() {
    const { data: auth } = await client.auth.getUser();
    if (!auth?.user) return false;
    const { data, error } = await client
      .from("user_roles").select("role").eq("user_id", auth.user.id).maybeSingle();
    if (error) return false;
    return data?.role === "admin";
  }

  // ---------- likes, saves, follows ----------

  async function toggleRow(table, postId) {
    const user = await requireUser();
    requireValue(postId, "A post ID is required.");

    const { data: existing, error: readError } = await client
      .from(table).select("post_id")
      .eq("post_id", postId).eq("user_id", user.id).maybeSingle();
    if (readError) throw cleanError(readError);

    if (existing) {
      const { error } = await client.from(table).delete()
        .eq("post_id", postId).eq("user_id", user.id);
      if (error) throw cleanError(error);
      return false;
    }

    const { error } = await client.from(table)
      .insert({ post_id: postId, user_id: user.id });

    // A double-tap can insert the same row twice (unique violation).
    // Treat that as "already on".
    if (error && error.code !== "23505") throw cleanError(error);
    return true;
  }

  const toggleLike = postId => toggleRow("likes", postId);
  const toggleSave = postId => toggleRow("saves", postId);

  async function myIds(table) {
    const { data: auth } = await client.auth.getUser();
    if (!auth?.user) return [];
    const { data, error } = await client
      .from(table).select("post_id").eq("user_id", auth.user.id);
    if (error) throw cleanError(error);
    return (data || []).map(row => row.post_id);
  }

  async function followingIds() {
    const { data: auth } = await client.auth.getUser();
    if (!auth?.user) return [];
    const { data, error } = await client
      .from("follows").select("following_id").eq("follower_id", auth.user.id);
    if (error) throw cleanError(error);
    return (data || []).map(row => row.following_id);
  }

  // ---------- profile editing ----------

  async function updateProfile({ displayName, bio, isPrivate, website } = {}) {
    const user = await requireUser();
    const changes = {};

    if (displayName !== undefined) {
      const name = String(displayName).trim();
      if (name.length > 80) throw new Error("Display name must be 80 characters or fewer.");
      changes.display_name = name || null;
    }
    if (bio !== undefined) {
      const text = String(bio).trim();
      if (text.length > 500) throw new Error("Bio must be 500 characters or fewer.");
      changes.bio = text || null;
    }
    if (isPrivate !== undefined) changes.is_private = Boolean(isPrivate);
    if (website !== undefined) {
      const url = String(website).trim();
      if (url && !/^https?:\/\/\S+$/i.test(url)) {
        throw new Error("Website must start with http:// or https://");
      }
      changes.website = url || null;
    }

    const { data, error } = await client
      .from("profiles").update(changes).eq("id", user.id)
      .select("id, username, display_name, bio, avatar_url, cover_url, website, is_private, created_at")
      .single();
    if (error) throw cleanError(error);
    return data;
  }

  async function postsByCreator(userId) {
    const { data, error } = await client
      .from("posts")
      .select(FEED_SELECT)
      .eq("creator_id", userId)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(60);
    if (error) throw cleanError(error);
    return (data || []).map(mapPost);
  }

  // ---------- follow ----------

  async function toggleFollow(targetId) {
    const user = await requireUser();
    requireValue(targetId, "A user ID is required.");
    if (targetId === user.id) throw new Error("You can't follow yourself.");

    const { data: existing, error: readError } = await client
      .from("follows").select("following_id")
      .eq("follower_id", user.id).eq("following_id", targetId).maybeSingle();
    if (readError) throw cleanError(readError);

    if (existing) {
      const { error } = await client.from("follows").delete()
        .eq("follower_id", user.id).eq("following_id", targetId);
      if (error) throw cleanError(error);
      return false;
    }

    const { error } = await client.from("follows")
      .insert({ follower_id: user.id, following_id: targetId });
    if (error && error.code !== "23505") throw cleanError(error);
    return true;
  }

  // ---------- comments ----------

  async function listComments(postId) {
    const { data, error } = await client
      .from("comments")
      .select("id, post_id, author_id, parent_comment_id, body, created_at, profiles:author_id ( id, username, display_name, avatar_url )")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw cleanError(error);
    return data || [];
  }

  async function addComment(postId, body, parentId = null) {
    const user = await requireUser();
    const text = String(body || "").trim();
    if (!text) throw new Error("Write something before posting.");
    if (text.length > 3000) throw new Error("Comments can be up to 3000 characters.");

    const { data, error } = await client
      .from("comments")
      .insert({ post_id: postId, author_id: user.id, body: text, parent_comment_id: parentId })
      .select("id, post_id, author_id, parent_comment_id, body, created_at, profiles:author_id ( id, username, display_name, avatar_url )")
      .single();
    if (error) {
      if (error.code === "42501") throw new Error("Comments are turned off for this post.");
      throw cleanError(error);
    }
    return data;
  }

  async function deleteComment(commentId) {
    const user = await requireUser();
    const { error } = await client.from("comments").delete()
      .eq("id", commentId).eq("author_id", user.id);
    if (error) throw cleanError(error);
    return true;
  }

  // ---------- reports ----------

  async function createReport({ postId = null, reportedUserId = null, reason, details = "" } = {}) {
    const user = await requireUser();
    const cleanReason = String(reason || "").trim();
    if (cleanReason.length < 3 || cleanReason.length > 100) {
      throw new Error("Choose a reason for your report.");
    }
    if (!postId && !reportedUserId) throw new Error("Nothing to report.");
    if (String(details).length > 3000) throw new Error("Details are too long.");

    const { error } = await client.from("reports").insert({
      reporter_id: user.id,
      post_id: postId,
      reported_user_id: reportedUserId,
      reason: cleanReason,
      details: String(details).trim() || null
    });
    if (error) throw cleanError(error);
    return true;
  }

  // ---------- collections ----------

  async function listCollections() {
    const user = await requireUser();
    const { data, error } = await client
      .from("collections")
      .select("id, title, description, is_private, created_at, collection_items ( post_id, added_at )")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw cleanError(error);

    return (data || []).map(c => ({
      ...c,
      items: (c.collection_items || [])
        .slice()
        .sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
    }));
  }

  async function createCollection({ title, description = "", isPrivate = true } = {}) {
    const user = await requireUser();
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) throw new Error("Give your collection a name.");
    if (cleanTitle.length > 120) throw new Error("Collection names can be up to 120 characters.");

    const { data, error } = await client
      .from("collections")
      .insert({
        owner_id: user.id,
        title: cleanTitle,
        description: String(description).trim().slice(0, 1000) || null,
        is_private: Boolean(isPrivate)
      })
      .select("id, title, description, is_private, created_at")
      .single();
    if (error) throw cleanError(error);
    return data;
  }

  async function deleteCollection(collectionId) {
    const user = await requireUser();
    // Remove its items first, then the collection itself.
    const { error: itemsError } = await client
      .from("collection_items").delete().eq("collection_id", collectionId);
    if (itemsError) throw cleanError(itemsError);

    const { error } = await client
      .from("collections").delete().eq("id", collectionId).eq("owner_id", user.id);
    if (error) throw cleanError(error);
    return true;
  }

  async function addToCollection(collectionId, postId) {
    await requireUser();
    const { error } = await client
      .from("collection_items").insert({ collection_id: collectionId, post_id: postId });
    if (error) {
      if (error.code === "23505") return "exists";
      throw cleanError(error);
    }
    return "added";
  }

  async function removeFromCollection(collectionId, postId) {
    await requireUser();
    const { error } = await client
      .from("collection_items").delete()
      .eq("collection_id", collectionId).eq("post_id", postId);
    if (error) throw cleanError(error);
    return true;
  }

  // ---------- notifications ----------

  async function listNotifications(limit = 40) {
    await requireUser();
    const { data, error } = await client
      .from("notifications")
      .select("id, notification_type, entity_type, entity_id, payload, read_at, created_at, profiles:actor_id ( id, username, display_name, avatar_url )")
      .neq("notification_type", "message")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(Number(limit) || 40, 1), 100));
    if (error) throw cleanError(error);
    return data || [];
  }

  async function unreadNotificationCount() {
    const { data: auth } = await client.auth.getUser();
    if (!auth?.user) return 0;
    const { count, error } = await client
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .neq("notification_type", "message")
      .is("read_at", null);
    if (error) throw cleanError(error);
    return count || 0;
  }

  async function markNotificationsRead(ids = null) {
    const user = await requireUser();
    let query = client.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", user.id)
      .is("read_at", null);
    if (ids?.length) query = query.in("id", ids);
    const { error } = await query;
    if (error) throw cleanError(error);
    return true;
  }

  // ---------- avatars ----------

  const AVATAR_BUCKET = "pixora-avatars";
  const AVATAR_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const AVATAR_INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That image could not be read.")); };
      img.src = url;
    });
  }

  // Centre-crops to a square, shrinks to 512px and re-encodes (also removes photo metadata).
  async function prepareAvatar(file) {
    const img = await loadImage(file);
    const size = 512;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error("That image could not be read.");

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
      0, 0, size, size
    );

    const toBlob = (type, quality) =>
      new Promise(resolve => canvas.toBlob(resolve, type, quality));

    let blob = await toBlob("image/webp", 0.9);
    if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.9);
    if (!blob) throw new Error("Could not prepare that image.");

    return { blob, ext: blob.type === "image/webp" ? "webp" : "jpg" };
  }

  function avatarPathFromUrl(url) {
    return url && url.startsWith(AVATAR_PREFIX) ? url.slice(AVATAR_PREFIX.length) : null;
  }

  async function removeStoredAvatar(url) {
    const path = avatarPathFromUrl(url);
    if (!path) return;
    try {
      await client.storage.from(AVATAR_BUCKET).remove([path]);
    } catch (error) {
      console.warn("PIXORA avatar cleanup:", error);
    }
  }

  async function uploadAvatar(file) {
    const user = await requireUser();

    if (!(file instanceof File)) throw new Error("Choose a photo.");
    if (!AVATAR_INPUT_TYPES.has(file.type)) {
      throw new Error("Use a JPG, PNG, WebP or GIF photo.");
    }
    if (file.size > 10 * 1024 * 1024) throw new Error("Photo must be 10 MB or smaller.");

    const previous = (await getProfile(user.id))?.avatar_url;
    const { blob, ext } = await prepareAvatar(file);
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await client.storage
      .from(AVATAR_BUCKET)
      .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
    if (uploadError) throw cleanError(uploadError);

    const { data: publicData } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);

    const { data, error } = await client
      .from("profiles").update({ avatar_url: publicData.publicUrl }).eq("id", user.id)
      .select("id, username, display_name, bio, avatar_url, cover_url, website, is_private, created_at")
      .single();

    if (error) {
      await client.storage.from(AVATAR_BUCKET).remove([path]);
      throw cleanError(error);
    }

    if (previous && previous !== publicData.publicUrl) await removeStoredAvatar(previous);
    return data;
  }

  async function removeAvatar() {
    const user = await requireUser();
    const previous = (await getProfile(user.id))?.avatar_url;

    const { data, error } = await client
      .from("profiles").update({ avatar_url: null }).eq("id", user.id)
      .select("id, username, display_name, bio, avatar_url, cover_url, website, is_private, created_at")
      .single();
    if (error) throw cleanError(error);

    await removeStoredAvatar(previous);
    return data;
  }

  // Only trust avatar addresses that point at our own avatar bucket.
  function safeAvatarUrl(url) {
    return url && url.startsWith(AVATAR_PREFIX) ? url : null;
  }

  // ---------- people search & messaging ----------

  async function searchUsers(query) {
    const text = String(query || "").trim().toLowerCase().replace(/[%_,()*\\"'.]/g, "").slice(0, 40);
    if (text.length < 2) return [];

    const { data: auth } = await client.auth.getUser();

    let request = client
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${text}%,display_name.ilike.%${text}%`)
      .limit(10);
    if (auth?.user) request = request.neq("id", auth.user.id);

    const { data, error } = await request;
    if (error) throw cleanError(error);
    return data || [];
  }

  async function listConversations() {
    await requireUser();
    const { data, error } = await client.rpc("list_my_conversations");
    if (error) throw cleanError(error);
    return data || [];
  }

  async function startConversation(userId) {
    await requireUser();
    requireValue(userId, "Choose someone to message.");
    const { data, error } = await client.rpc("start_direct_conversation", { target_user_id: userId });
    if (error) throw cleanError(error);
    return data;
  }

  async function listMessages(conversationId, limit = 100) {
    const { data, error } = await client
      .from("messages")
      .select("id, conversation_id, sender_id, body, message_type, created_at")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw cleanError(error);
    return (data || []).reverse();
  }

  async function sendMessage(conversationId, body) {
    const user = await requireUser();
    const text = String(body || "").trim();
    if (!text) throw new Error("Write a message first.");
    if (text.length > 5000) throw new Error("Messages can be up to 5000 characters.");

    const { data, error } = await client
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, body: text })
      .select("id, conversation_id, sender_id, body, message_type, created_at")
      .single();
    if (error) {
      if (error.code === "42501") throw new Error("You can't send messages in this conversation.");
      throw cleanError(error);
    }
    return data;
  }

  async function deleteMessage(messageId) {
    const user = await requireUser();
    const { error } = await client.from("messages").delete()
      .eq("id", messageId).eq("sender_id", user.id);
    if (error) throw cleanError(error);
    return true;
  }

  async function markConversationRead(conversationId) {
    const { error } = await client.rpc("mark_conversation_read", { p_conversation_id: conversationId });
    if (error) throw cleanError(error);
    return true;
  }

  // Live updates. Row level security means you only receive messages from your own chats.
  function subscribeToMessages(onChange) {
    const channel = client
      .channel("pixora-messages-" + createFileId())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, onChange)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }

  // ---------- public API ----------

  window.PIXORA = Object.freeze({
    supabase: client,
    auth: Object.freeze({
      signUp, signIn, signOut, getSession, getUser: requireUser,
      usernameAvailable, resendConfirmation, requestPasswordReset, updatePassword
    }),
    profiles: Object.freeze({
      get: getProfile, update: updateProfile,
      uploadAvatar, removeAvatar, safeAvatarUrl
    }),
    users: Object.freeze({ search: searchUsers }),
    messages: Object.freeze({
      conversations: listConversations, start: startConversation, list: listMessages,
      send: sendMessage, remove: deleteMessage, markRead: markConversationRead,
      subscribe: subscribeToMessages
    }),
    categories: Object.freeze({ list: getCategories }),
    media: Object.freeze({ upload: uploadMedia }),
    posts: Object.freeze({
      publish: publishPost, feed: getFeed, byIds: getPostsByIds, byCreator: postsByCreator,
      search: searchPosts
    }),
    tags: Object.freeze({ clean: cleanTags, suggest: suggestTags }),
    roles: Object.freeze({ isAdmin }),
    likes: Object.freeze({ toggle: toggleLike, mine: () => myIds("likes") }),
    saves: Object.freeze({ toggle: toggleSave, mine: () => myIds("saves") }),
    follows: Object.freeze({ mine: followingIds, toggle: toggleFollow }),
    comments: Object.freeze({ list: listComments, add: addComment, remove: deleteComment }),
    reports: Object.freeze({ create: createReport }),
    collections: Object.freeze({
      list: listCollections, create: createCollection, remove: deleteCollection,
      add: addToCollection, removeItem: removeFromCollection
    }),
    notifications: Object.freeze({
      list: listNotifications, unread: unreadNotificationCount, markRead: markNotificationsRead
    })
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") window.PIXORA_RECOVERY = true;
    window.dispatchEvent(new CustomEvent("pixora:auth", {
      detail: { event, session, user: session?.user || null }
    }));
  });

  console.info("PIXORA backend initialized successfully.");
})();
