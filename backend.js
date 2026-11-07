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

  async function signUp({ email, password, username, displayName } = {}) {
    requireValue(email, "Email address is required.");
    requireValue(password, "Password is required.");
    if (String(password).length < 8) {
      throw new Error("Password must contain at least 8 characters.");
    }

    const cleanUsername = String(username || "")
      .trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
    if (cleanUsername.length < 3) {
      throw new Error("Username must contain at least 3 characters.");
    }

    const { data, error } = await client.auth.signUp({
      email: String(email).trim().toLowerCase(),
      password,
      options: {
        data: {
          username: cleanUsername,
          display_name: String(displayName || cleanUsername).trim().slice(0, 80)
        }
      }
    });
    if (error) throw cleanError(error);
    return data;
  }

  async function signIn({ email, password } = {}) {
    requireValue(email, "Enter your email address.");
    requireValue(password, "Enter your password.");
    const { data, error } = await client.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(),
      password: String(password)
    });
    if (error) throw cleanError(error);
    return data;
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
    visibility = "public",
    allowComments = true
  } = {}) {
    const user = await requireUser();
    const selectedFiles = Array.from(files || []);

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
    likes ( count )
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

    return {
      ...post,
      media,
      categories,
      likeCount: post.likes?.[0]?.count ?? 0
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

  async function getPostsByIds(ids = []) {
    const list = [...new Set(ids)].filter(Boolean).slice(0, 100);
    if (!list.length) return [];

    const { data, error } = await client
      .from("posts")
      .select(FEED_SELECT)
      .in("id", list)
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) throw cleanError(error);
    return (data || []).map(mapPost);
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

  // ---------- public API ----------

  window.PIXORA = Object.freeze({
    supabase: client,
    auth: Object.freeze({ signUp, signIn, signOut, getSession, getUser: requireUser }),
    profiles: Object.freeze({ get: getProfile }),
    categories: Object.freeze({ list: getCategories }),
    media: Object.freeze({ upload: uploadMedia }),
    posts: Object.freeze({ publish: publishPost, feed: getFeed, byIds: getPostsByIds }),
    likes: Object.freeze({ toggle: toggleLike, mine: () => myIds("likes") }),
    saves: Object.freeze({ toggle: toggleSave, mine: () => myIds("saves") }),
    follows: Object.freeze({ mine: followingIds })
  });

  client.auth.onAuthStateChange((event, session) => {
    window.dispatchEvent(new CustomEvent("pixora:auth", {
      detail: { event, session, user: session?.user || null }
    }));
  });

  console.info("PIXORA backend initialized successfully.");
})();
