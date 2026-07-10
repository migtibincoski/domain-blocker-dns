# Domain Blocker DNS

A simple DNS server for blocking domains by exact match or wildcard patterns (e.g., `*.example.com`). It forwards allowed queries to upstream DNS servers, hot-reloads settings when `settings.json` changes, and optionally redirects blocked HTTP/HTTPS requests to a configurable URL.

## Features

- Blocks exact domains and wildcard subdomains.
- Uses upstream DNS servers from `settings.json`.
- Hot reloads `settings.json` via file watcher.
- Optional HTTP/HTTPS redirect for blocked pages via `redirectUrl`.
- Works over UDP and TCP on port 53.

## Requirements

- Node.js >= 18
- Privileges to bind to ports 53, 80, and 443 (Linux/macOS may require `sudo`)

## Install

```bash
pnpm install
```

## Configuration

Edit `src/settings.json`:

```json
{
  "dns": [
    "1.1.1.1",
    "8.8.8.8"
  ],
  "blockedDomains": [
    "example.com",
    "test.com",
    "*.blocked.com"
  ],
  "redirectUrl": ""
}
```

- `dns`: upstream DNS servers used when a domain is not blocked.
- `blockedDomains`: list of domains or wildcards to block.
  - Exact: `example.com` blocks only `example.com`.
  - Wildcard: `*.blocked.com` blocks `blocked.com` and any subdomain such as `foo.blocked.com`.
- `redirectUrl` (optional): if set, the HTTP/HTTPS block page redirects (302) to this URL instead of serving the static `block.html`.

## Usage

Start both DNS and HTTP servers:

```bash
pnpm start
```

Run tests:

```bash
pnpm test
```

Build TypeScript:

```bash
pnpm build
```

## How it works

- DNS server listens on UDP/TCP port 53.
- For each query, it checks `blockedDomains`. If blocked, it replies with the local IPv4 address (A record) or `::1` (AAAA record).
- If not blocked, it forwards the query to upstream DNS servers in order and returns the first successful result.
- `settings.json` is watched and reloaded automatically; no restart required.
- HTTP server listens on port 80 and HTTPS on port 443.
  - If `redirectUrl` is configured, any request returns a 302 redirect to that URL.
  - Otherwise, it serves `src/block.html`.

## Tests

- `src/dns.test.ts`: unit tests for `isBlocked` logic, including exact and wildcard blocking and case insensitivity.
- `src/http.test.ts`: unit tests for HTTP redirect behavior when `redirectUrl` is set or empty.

## Notes

- Port 53 typically requires elevated privileges; on Linux run with `sudo` or set capabilities.
- Wildcard patterns only apply to subdomains under a base domain. Exact entries do not block subdomains.
- `redirectUrl` must be a valid URL and should point to a non-blocked destination.