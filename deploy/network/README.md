# Network entry hardening

This deployment changes nginx and adds
one narrow host firewall table; no application release, upload quota or login
storage changes are part of this batch.

## Active protections

- Main site: HSTS for 180 days (without includeSubDomains/preload), frame denial,
  nosniff, Referrer-Policy, Permissions-Policy and baseline CSP. Existing inline
  hydration remains permitted; this is not a complete nonce-based XSS solution.
- API platform: HSTS added; existing nonce CSP and 600-second streaming timeout
  retained. No anonymous or paid model generation was used for verification.
- Cookie-authenticated writes with an explicit untrusted/null Origin are rejected
  at the proxy. Literal main/www/API origins are allowed. Cookie-free machine
  clients and Bearer requests still reach the backend's normal authentication.
  Missing Origin remains compatible with non-browser clients.
- Proxy overwrites X-Forwarded-For and X-Forwarded-Host; untrusted client-supplied
  IPs are not promoted to trusted source addresses. Unknown HTTPS Hosts are closed.
- Main authentication responses use private/no-store. Security headers are repeated
  inside locations with their own add_header directives for nginx 1.22 inheritance.
- nftables table `inet uestc_llmnr_guard` drops TCP/UDP 5355 on non-loopback
  interfaces. Its systemd service starts on boot. It uses ACCEPT policy otherwise,
  does not flush other tables, and leaves SSH and all other ports unchanged.

## Verification and backup

`build.py` transforms a captured pair of site configs. `validate_remote.py` checks
the full candidate syntax, does nft --check, and starts a separate loopback nginx
instance with a harmless echo upstream for 16 HTTP checks. It never reloads the
production nginx during validation. Windows had no usable local nginx/WSL, so the
isolated test used the server's installed nginx 1.22 binary.

`apply_remote.py` checks baseline hashes, saves originals, checks syntax again,
reloads nginx, enables only the narrow firewall service, then checks both domains
directly and through public HTTPS. Failure restores this batch's own changes.

Keep deployment backups and validation records in access-controlled,
environment-specific storage. Do not commit production snapshots or local
workspace paths.

Rollback should restore only the two saved site configs and this batch's snippet
files, run nginx -t, then reload nginx. Disable/stop `uestc-llmnr-guard.service` to
remove its own nft table. Never flush the entire firewall ruleset. Before restoring
a snapshot, compare current configs to avoid undoing subsequent maintenance.

## Follow-up requiring ESA configuration

Do not use `set_real_ip_from 0.0.0.0/0` or accept arbitrary X-Forwarded-For values.
Retrieve the site's actual trusted ESA origin CIDRs and verify the managed real
client header. Only then configure real-ip recovery, tighten per-client rate
limits, and restrict origin web access to approved ESA ranges. Existing main-site
limits remain in place; this batch does not introduce tighter limits by ESA POP IP.

SSH is currently key-only on port 22. Root login policy and cloud security-group
rules were not changed or claimed to be fully audited.

References:
- https://nginx.org/en/docs/http/ngx_http_realip_module.html
- https://nginx.org/en/docs/http/ngx_http_headers_module.html
- https://www.alibabacloud.com/help/en/edge-security-acceleration/esa/user-guide/origin-protection
