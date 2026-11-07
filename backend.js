
/* CURRENT PIXORA BACKEND
   Supabase authentication, uploads, publishing,
   public feed, likes and saves.
*/

(() => {
  "use strict";

  const SUPABASE_URL =
    "https://nvixxssenrgbviewimix.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_PmVE-SElQpR-MbldI-2aWg_i9BE6dXD";

  const PUBLIC_BUCKET = "pixora-public-media";
  const MAX_FILE_BYTES = 50 * 1024 * 1024;

  const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm"
  ]);

  if (!window.supabase?.createClient) {
    console.error(
      "PIXORA: Supabase library was not loaded."
    );
    return;
  }

  const client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  function cleanError(error) {
    return new Error(
      error?.message || "Something went wrong."
    );
  }

  async function requireUser() {
    const { data, error } = await client.auth.getUser();

    if (error) throw cleanError(error);

    if (!data?.user) {
      throw new Error(
        "Please sign in before doing that."
      );
    }

    return data.user;
  }

  function safeFileName(name) {
    return String(name || "upload")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-90) || "upload";
  }

  // AUTHENTICATION

  async function signUp({
    email,
    password,
    username,
    displayName
  } = {}) {
    if (!email || !password) {
      throw new Error(
        "Email and password are required."
      );
    }

    if (String(password).length < 8) {
      throw new Error(
        "Password must contain at least 8 characters."
      );
    }

    const cleanUsername = String(username || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 30);

    if (cleanUsername.length < 3) {
      throw new Error(
        "Username must contain at least 3 characters."
      );
    }

    const { data, error } = await client.auth.signUp({
      email: String(email).trim(),
      password,
      options: {
        data: {
          username: cleanUsername,
          display_name: String(
            displayName || cleanUsername
          ).trim().slice(0, 80)
        }
      }
    });

    if (error) throw cleanError(error);

    return data;
  }

  async function signIn({ email, password } = {}) {
    const { data, error } =
      await client.auth.signInWithPassword({
        email: String(email || "").trim(),
        password: password || ""
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
    const { data, error } =
      await client.auth.getSession();

    if (error) throw cleanError(error);

    return data.session;
  }

  // USER PROFILES

  async function getProfile(userId) {
    const id = userId || (await requireUser()).id;

    const { data, error } = await client
      .from("profiles")
      .select(`
        id,
        username,
        display_name,
        bio,
        avatar_url,
        cover_url,
        website,
        is_private,
        created_at
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) throw cleanError(error);

    return data;
  }

  // CATEGORIES

  async function getCategories() {
    const { data, error } = await client
      .from("categories")
      .select("id, name, slug")
      .order("name");

    if (error) throw cleanError(error);

    return data || [];
  }

  // MEDIA UPLOAD

  async function uploadMedia(file, options = {}) {
    const user = await requireUser();

    if (!(file instanceof File)) {
      throw new Error(
        "Choose an image or video file."
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error(
        "Unsupported format. Use JPG, PNG, WebP, GIF, MP4 or WebM."
      );
    }

    if (
      file.size <= 0 ||
      file.size > MAX_FILE_BYTES
    ) {
      throw new Error(
        "File must be between 1 byte and 50 MB."
      );
    }

    if (
      options.visibility &&
      options.visibility !== "public"
    ) {
      throw new Error(
        "Private and followers-only uploads are not enabled yet."
      );
    }

    const mediaType = file.type.startsWith("video/")
      ? "video"
      : "image";

    const objectPath =
      `${user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

    const { error: uploadError } = await client.storage
      .from(PUBLIC_BUCKET)
      .upload(objectPath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) {
      throw cleanError(uploadError);
    }

    const { data: asset, error: assetError } =
      await client
        .from("media_assets")
        .insert({
          owner_id: user.id,
          media_type: mediaType,
          storage_bucket: PUBLIC_BUCKET,
          storage_path: objectPath,
          mime_type: file.type,
          file_size_bytes: file.size,
          processing_status: "ready",
          alt_text: String(
            options.altText || ""
          ).trim().slice(0, 500) || null
        })
        .select(`
          id,
          media_type,
          storage_bucket,
          storage_path,
          mime_type,
          file_size_bytes,
          processing_status
        `)
        .single();

    if (assetError) {
      await client.storage
        .from(PUBLIC_BUCKET)
        .remove([objectPath]);

      throw cleanError(assetError);
    }

    const { data: publicData } =
      client.storage
        .from(PUBLIC_BUCKET)
        .getPublicUrl(objectPath);

    return {
      ...asset,
      publicUrl: publicData.publicUrl
    };
  }

  // PUBLISH POSTS

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

    if (!selectedFiles.length) {
      throw new Error(
        "Select at least one image or video."
      );
    }

    if (selectedFiles.length > 10) {
      throw new Error(
        "A post can contain up to 10 media files."
      );
    }

    if (String(caption).length > 5000) {
      throw new Error("Caption is too long.");
    }

    if (visibility !== "public") {
      throw new Error(
        "Only public publishing is currently enabled."
      );
    }

    const assets = [];
    let postId = null;

    try {
      for (const file of selectedFiles) {
        assets.push(
          await uploadMedia(file, {
            visibility,
            altText: caption
          })
        );
      }

      const postType = assets.length > 1
        ? "carousel"
        : assets[0].media_type;

      const { data: post, error: postError } =
        await client
          .from("posts")
          .insert({
            creator_id: user.id,
            caption: String(caption).trim() || null,
            post_type: postType,
            visibility: "public",
            status: "published",
            allow_comments: Boolean(allowComments),
            published_at: new Date().toISOString()
          })
          .select(`
            id,
            creator_id,
            caption,
            post_type,
            visibility,
            status,
            published_at,
            created_at
          `)
          .single();

      if (postError) {
        throw cleanError(postError);
      }

      postId = post.id;

      const links = assets.map((asset, index) => ({
        post_id: post.id,
        media_asset_id: asset.id,
        display_order: index,
        is_cover: index === 0
      }));

      const { error: linkError } =
        await client
          .from("post_media")
          .insert(links);

      if (linkError) {
        throw cleanError(linkError);
      }

      const ids = [
        ...new Set(
          [categoryId, ...categoryIds].filter(Boolean)
        )
      ];

      if (ids.length) {
        const { error: categoryError } =
          await client
            .from("post_categories")
            .insert(
              ids.map(id => ({
                post_id: post.id,
                category_id: id
              }))
            );

        if (categoryError) {
          throw cleanError(categoryError);
        }
      }

      return {
        ...post,
        media: assets
      };

    } catch (error) {
      if (postId) {
        await client
          .from("posts")
          .delete()
          .eq("id", postId);
      }

      for (const asset of assets) {
        await client.storage
          .from(asset.storage_bucket)
          .remove([asset.storage_path]);

        await client
          .from("media_assets")
          .delete()
          .eq("id", asset.id);
      }

      throw error;
    }
  }

  // PUBLIC FEED

  async function getFeed({
    limit = 24,
    before = null
  } = {}) {
    const safeLimit = Math.min(
      Math.max(Number(limit) || 24, 1),
      50
    );

    let query = client
      .from("posts")
      .select(`
        id,
        creator_id,
        caption,
        post_type,
        visibility,
        published_at,
        created_at,
        profiles:creator_id (
          id,
          username,
          display_name,
          avatar_url
        ),
        post_media (
          id,
          display_order,
          is_cover,
          media_assets (
            id,
            media_type,
            storage_bucket,
            storage_path,
            mime_type,
            alt_text
          )
        ),
        post_categories (
          categories (
            id,
            name,
            slug
          )
        )
      `)
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", {
        ascending: false
      })
      .limit(safeLimit);

    if (before) {
      query = query.lt("published_at", before);
    }

    const { data, error } = await query;

    if (error) throw cleanError(error);

    return (data || []).map(post => ({
      ...post,

      media: (post.post_media || [])
        .slice()
        .sort(
          (a, b) => a.display_order - b.display_order
        )
        .map(link => {
          const asset = link.media_assets;

          if (!asset) return null;

          const { data: urlData } =
            client.storage
              .from(asset.storage_bucket)
              .getPublicUrl(asset.storage_path);

          return {
            ...asset,
            publicUrl: urlData.publicUrl
          };
        })
        .filter(Boolean),

      categories: (post.post_categories || [])
        .map(row => row.categories)
        .filter(Boolean)
    }));
  }

  // LIKES

  async function toggleLike(postId) {
    const user = await requireUser();

    const { data: existing, error: readError } =
      await client
        .from("likes")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (readError) throw cleanError(readError);

    if (existing) {
      const { error } = await client
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);

      if (error) throw cleanError(error);

      return false;
    }

    const { error } = await client
      .from("likes")
      .insert({
        post_id: postId,
        user_id: user.id
      });

    if (error) throw cleanError(error);

    return true;
  }

  // SAVES

  async function toggleSave(postId) {
    const user = await requireUser();

    const { data: existing, error: readError } =
      await client
        .from("saves")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (readError) throw cleanError(readError);

    if (existing) {
      const { error } = await client
        .from("saves")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);

      if (error) throw cleanError(error);

      return false;
    }

    const { error } = await client
      .from("saves")
      .insert({
        post_id: postId,
        user_id: user.id
      });

    if (error) throw cleanError(error);

    return true;
  }

  // PUBLIC PIXORA API

  window.PIXORA = Object.freeze({
    supabase: client,

    auth: Object.freeze({
      signUp,
      signIn,
      signOut,
      getSession,
      getUser: requireUser
    }),

    profiles: Object.freeze({
      get: getProfile
    }),

    categories: Object.freeze({
      list: getCategories
    }),

    media: Object.freeze({
      upload: uploadMedia
    }),

    posts: Object.freeze({
      publish: publishPost,
      feed: getFeed
    }),

    likes: Object.freeze({
      toggle: toggleLike
    }),

    saves: Object.freeze({
      toggle: toggleSave
    })
  });

  client.auth.onAuthStateChange((event, session) => {
    window.dispatchEvent(
      new CustomEvent("pixora:auth", {
        detail: {
          event,
          session,
          user: session?.user || null
        }
      })
    );
  });

  console.info(
    "PIXORA backend connected successfully."
  );

})();
