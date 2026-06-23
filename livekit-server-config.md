# LiveKit Self-Hosted Server — Quality Fixes (BUG 4)

The laggy/blurry video affects **all** participants equally, which points at the
sender→SFU path and server media config, not a single viewer. Below are the
root-cause issues found in the documented production config (in
`calling-architecture.md`) and the corrected values.

## Issues found in the current `livekit.yaml`

| Problem | Current value | Why it hurts | Fix |
|---|---|---|---|
| **UDP media port range far too small** | `port_range_start: 7882` / `port_range_end: 7900` → only 19 ports | Every published track consumes ports; with simulcast (3 layers × 2 participants) the range is exhausted, forcing media onto TCP/TURN relay → latency + quality collapse. It also does **not** match the firewall, which opens `50000:60000/udp`. | Use a wide range that matches the firewall, **or** single-port mux (below). |
| **No `use_external_ip`** | only a hardcoded `node_ip: "13.233.109.2"` | On AWS the instance only knows its private IP. If the Elastic IP ever changes, or if STUN-based discovery is needed, candidates are advertised with the wrong address → ICE fails and clients silently relay (or hang on "Connecting"). | Set `rtc.use_external_ip: true`. Keep `node_ip` only if it is a *static* Elastic IP. |
| **TURN disabled** | `turn.enabled: false` | Cellular users behind CGNAT, corporate firewalls, and restrictive networks cannot get relay fallback → "connecting forever" / heavy packet loss. WhatsApp works everywhere because it uses TURN aggressively. | Enable TURN with valid TLS cert. |

## Current `/etc/livekit/livekit.yaml` (APPLIED)

```yaml
port: 7880
bind_addresses:
  - "0.0.0.0"
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
turn:
  enabled: true
  domain: "livekit.92lrcorps.xyz"
  tls_port: 5349
  cert_file: "/etc/letsencrypt/live/livekit.92lrcorps.xyz/fullchain.pem"
  key_file: "/etc/letsencrypt/live/livekit.92lrcorps.xyz/privkey.pem"
keys:
  APIaew4267Rs2iJ: "dOCKxeiAMsGhBs7GQnVgdnD9OI61eYckgKa3MVxmhmk"
logging:
  level: "info"
  sample: true
```

> **Note:** `cert_file`/`key_file` under `turn:` are informational. The actual TLS cert
> is loaded via `--turn-cert` / `--turn-key` flags in the systemd service file
> (`/etc/systemd/system/livekit.service`).

## Firewall (UFW) — CURRENT STATE

```bash
7880/tcp    ALLOW    Anywhere       # LiveKit HTTP/WS signaling
7881/tcp    ALLOW    Anywhere       # LiveKit WebRTC TCP fallback
50000:60000/udp  ALLOW  Anywhere    # WebRTC media transport
5349/tcp    ALLOW    Anywhere       # TURN over TLS
```

> Cloudflare: `livekit.92lrcorps.xyz` is **DNS-only (grey cloud)** pointing to
> `15.207.108.95`. All traffic goes direct to the VPS — no Cloudflare proxy.

## TLS Cert

- **Provider:** Let's Encrypt (browser-trusted)
- **Domain:** `livekit.92lrcorps.xyz`
- **Paths:**
  - `/etc/letsencrypt/live/livekit.92lrcorps.xyz/fullchain.pem`
  - `/etc/letsencrypt/live/livekit.92lrcorps.xyz/privkey.pem`
- **Auto-renewal:** Active via `certbot.timer` (twice daily)
- **Post-renewal hook:** `/etc/letsencrypt/renewal-hooks/deploy/restart-livekit.sh`
  → automatically restarts LiveKit after cert renewal

## Client/server version compatibility

- Client `livekit-client@^2.19.2`, server SDK `livekit-server-sdk@^2.15.5` — both
  on the v2 protocol, **compatible**. LiveKit server binary is v1.13.1.

## Deployment (systemd service)

LiveKit runs as a systemd service, not Docker.

```bash
# Service file: /etc/systemd/system/livekit.service
# Config: /etc/livekit/livekit.yaml

# Restart after config changes:
sudo systemctl restart livekit.service

# Check status:
sudo systemctl status livekit.service

# View logs:
sudo journalctl -u livekit.service -f
```

## How to verify TURN is working

1. **TLS handshake check:**
   ```bash
   echo | openssl s_client -connect 127.0.0.1:5349 -servername livekit.92lrcorps.xyz 2>&1 | grep -E "subject|Verify return"
   ```
   Expected: `subject=CN = livekit.92lrcorps.xyz` and `Verify return code: 0 (ok)`

2. **Check logs for TURN startup:**
   ```bash
   sudo journalctl -u livekit.service | grep "Starting TURN"
   ```
   Expected: `Starting TURN server {"turn.portTLS": 5349, ...}`

3. **WebRTC internals during a call** (`chrome://webrtc-internals`):
   - Look for `relay` candidates in ICE stats — confirms TURN relay is being used
   - On cellular/restricted networks, you should see `typ relay` candidates

4. **Network quality test:**
   - Place a call from a mobile device on cellular data (4G/5G)
   - Check `ConnectionQuality` indicator in the call UI shows `excellent` or `good`
   - If it shows `poor` consistently, check for packet loss in WebRTC internals
