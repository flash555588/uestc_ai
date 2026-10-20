# API platform theme

`main-site-dark.css` matches the main site's `app/night-mode.css` palette.
All selectors require `html.dark`; the existing light theme is retained.
`dark-utilities.css` also replaces the embedded frontend's hardcoded dark and
gray utility colors. Generate it with `generate-dark-utilities.cjs`, passing
the directory of all deployed CSS chunks as the first argument and output path
as the second. Include lazy styles for shared DataTable, Pagination and
TablePageLayout components; the index stylesheet alone is insufficient.
It preserves alpha values, media conditions, and semantic status colors.
The local generator now removes Vue `data-v-*` attributes from generated rules,
using stable component classes and `html:root.dark` specificity instead. This
avoids coupling colors to a specific build's scope hash. Component class renames
and palette changes still require regeneration and review on upgrade.
Publish the concatenation of `main-site-dark.css` and `dark-utilities.css`.

The API platform embeds its frontend in its executable. Its nginx virtual host
loads this extension after the embedded styles, independently of API releases:

- Versioned static file under the API platform's shared branding directory.
- Exact `/brand/main-site-dark-<sha256-prefix>.css` location with immutable caching.
- HTML-only `sub_filter` inserts a stylesheet link immediately before `</head>`.
- The proxy clears upstream `Accept-Encoding` so HTML can be filtered.

On changes, create a new content-hashed file and update both the exact location
and injected link in `/etc/nginx/sites-available/uestc-api`. Preserve the existing
proxy settings. Back up the configuration, run `nginx -t`, reload nginx, and
verify `/home`, `/login`, `/dashboard`, the CSS response and `/health`.
Keep prior versioned CSS files for tabs that loaded earlier HTML.

Keep deployment backups and verification records in access-controlled,
environment-specific storage. Do not commit production snapshots or local
workspace paths.
