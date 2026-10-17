# Claude Code container

Dedicated container for the official Claude Code CLI, pinned to version 2.1.300.
It starts an idle process. Installing and starting this container does not start
Claude account login or make an inference request.

## Deploy on Debian

Place these files in `~/claude-code-container`, run `sudo -v`, then `bash deploy.sh`.

The base is Microsoft's Debian 13 development-container image, pinned by digest.
The CLI is Anthropic's official Linux x64 native binary distributed through npm.
Its archive is verified against the registry's SHA-512 integrity value. Node.js
and a JavaScript package manager are not needed at runtime.

## US locale and time zone

The ISP exit `203.0.113.21` is located by IPinfo in Salt Lake City, Utah.
Compose sets `TZ=America/Denver`, `LANG=en_US.UTF-8`, `LC_ALL=en_US.UTF-8`,
and `LANGUAGE=en_US:en`. It mounts the host's Denver zoneinfo file at
`/etc/localtime` and the included `timezone` file at `/etc/timezone`.
Copy `timezone` with the other deployment files. Daylight saving time follows
the zoneinfo rules. The existing image already includes the required locale.

Applied on 2026-10-16 to `10.42.0.102`. System and process clocks agree;
Claude version and HTTPS connectivity checks pass. Changes before deployment
are backed up at `/home/deploy/claude-code-container/locale-before-us-20261016-084031/`.
Restore its Compose and Dockerfile files and recreate with the current
`-f compose.yaml -f compose.fixed-ip.yaml` options to roll back.

## Persistent files

- `data/claude`: configuration, future login credentials, and session state.
- `workspace`: project files available inside the container at `/workspace`.

The container runs as UID/GID 1000, matching the current Debian user `deploy`.
`CLAUDE_CONFIG_DIR` also keeps the separate `.claude.json` configuration within
the persistent configuration directory. No host credential directory, Docker
socket, or network port is mounted or published.

## Verify without logging in

```bash
sudo docker exec claude-code claude --version
sudo docker exec claude-code claude auth status
```

An unauthenticated status is expected until account login is explicitly started.

## Login later, after network/IP configuration

For the fixed LAN IP `10.42.0.102` and OpenWrt gateway, see
[FIXED-IP.md](FIXED-IP.md). When that network configuration is deployed, include
`-f compose.fixed-ip.yaml` last in Compose commands so recreation keeps the IP.

```bash
sudo docker exec -it -w /workspace claude-code claude
```

Use the Claude account login flow to use subscription allowances. Enable Remote
Control only after login and outbound network access are configured. Host SSH
access remains on Debian; no second SSH server is needed inside the container.

Update the pinned CLI version and archive integrity in `Dockerfile`, then rebuild
with `sudo docker compose up -d --build` when an update is wanted.
