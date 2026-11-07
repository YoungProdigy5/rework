# PIXORA — Current PIXORA Frontend

A brand-new, independent frontend prototype for CURRENT PIXORA. This project is not the OG PIXORA repository and does not connect to its database or services.

## Included
- Responsive premium dark interface with black, crimson and reddish-pink accents
- Homepage and visual discovery masonry feed
- Category filtering and basic search
- Image preview modal
- Save/unsave interactions using browser localStorage
- Collections page concept
- Creator profile page
- Notifications page
- Messaging UI prototype with local demo conversations and local-only message sending
- PIXORA Atmosphere theme options
- Admin dashboard preview with clearly marked illustrative metrics
- Mobile sidebar and bottom navigation

## Run locally
Open `index.html` in a modern browser. For best results, use a simple local static server or the Acode preview feature.

## Publish with GitHub Pages
1. Create a **new, separate** GitHub repository for CURRENT PIXORA.
2. Upload `index.html`, `style.css`, `script.js`, and this `README.md` to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then save.
6. Wait for GitHub Pages to publish and open the generated URL.

Official guide: https://docs.github.com/en/pages/quickstart

## Important: prototype, not production
This is a frontend-only first milestone. It uses illustrative visual content and browser-local demo state. It does **not** include:
- Real accounts, authentication, or secure sessions
- Real uploads or persistent server-side collections
- Real-time or cross-device messaging
- Real admin authentication, moderation actions, or permissions
- Database, storage, APIs, or server-side validation

The admin page is a visual preview only. Do not treat its sample statistics as real. Do not collect real user data or use it as a production messaging service yet.

## Suggested next development steps
1. Test all pages on mobile, tablet, and desktop.
2. Replace sample imagery with licensed/owned content.
3. Refine visual consistency and accessibility.
4. Define backend contracts and database schema.
5. Implement authentication, permissions, storage, messaging, and moderation.
6. Connect and test each frontend workflow before production launch.
