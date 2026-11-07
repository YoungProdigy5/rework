
# PIXORA — Backend Setup Guide

This guide explains how to connect the CURRENT PIXORA frontend to its Supabase backend.

## 1. Project Information

- Project: CURRENT PIXORA
- Repository: https://github.com/YoungProdigy5/rework
- Live website: https://youngprodigy5.github.io/rework/
- Backend: Supabase
- Supabase project ID: nvixxssenrgbviewimix
- Supabase region: London (eu-west-2)

IMPORTANT:
CURRENT PIXORA uses its own Supabase project. Do not connect it to the OG PIXORA backend.

## 2. Files Required

Your repository should contain:

- index.html
- style.css
- script.js
- backend.js
- SETUP.md

## 3. Connect Supabase to the Website

Open index.html.

Add these scripts immediately before the closing `</body>` tag:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="backend.js"></script>
<script src="script.js"></script>
```

If script.js is already included elsewhere, remove the duplicate script reference.

The Supabase library must load before backend.js.

## 4. Supabase Configuration

The backend.js file contains the project's:

- Supabase project URL
- Supabase publishable key
- Public media bucket
- Upload size and MIME type restrictions

The publishable key is intended for browser use. Never place a Supabase service-role key or secret key in frontend files.

## 5. Authentication URL Configuration

In Supabase:

1. Open Authentication.
2. Open URL Configuration.
3. Set the Site URL to:

https://youngprodigy5.github.io/rework/

4. Add the website URL to the allowed redirect URLs if required.

## 6. Current Backend Features

The backend foundation includes:

- User registration
- User login and logout
- User profiles
- Categories
- Image and video uploads
- Post publishing
- Public post feeds
- Likes
- Saved posts
- Notifications
- Social relationships
- Messaging database foundation
- Collections database foundation
- Moderation database foundation

Not every feature is connected to the frontend yet.

## 7. Media Upload Rules

Current public media bucket:

pixora-public-media

Maximum file size: 50 MB

Supported formats:

- JPEG
- PNG
- WEBP
- GIF
- MP4
- WEBM

Do not assume video transcoding, thumbnail generation or adaptive streaming is configured.

## 8. Important Security Rules

- Never expose secret or service-role keys.
- Keep Row Level Security enabled.
- Users must only modify their own content.
- Do not trust client-side role information.
- Admin permissions must be verified securely on the backend.
- Test access policies before production launch.

## 9. Testing Checklist

After connecting the files, test:

- [ ] Website loads without JavaScript errors.
- [ ] New user registration works.
- [ ] Login works.
- [ ] Logout works.
- [ ] User profile loads.
- [ ] Categories load.
- [ ] Image upload works.
- [ ] Video upload works.
- [ ] Publishing works.
- [ ] Public feed loads.
- [ ] Likes work.
- [ ] Saves work.
- [ ] Data remains available after refreshing.
- [ ] Another user cannot modify someone else's content.

## 10. Current Development Status

The database foundation and initial JavaScript backend client have been created.

The frontend still requires integration with the backend functions.

Messaging, notifications, moderation, creator features, private media access and advanced video processing require further implementation and testing.

PIXORA is not production-ready until these integrations and security tests are completed.
