/**
 * Local POS hardware agent — cash drawer / printer + fingerprint attendance bridge.
 *
 * Cash drawer (ESC/POS kick via receipt printer):
 *   DEVICE_API_KEY + DEVICE_PRINTER (or DEVICE_OUTPUT)
 *
 * Fingerprint attendance (same agent, optional second key):
 *   ATTENDANCE_API_KEY — Devices → Attendance terminal API key
 *   ATTENDANCE_LISTEN_PORT=8787 — local HTTP bridge for scanner SDKs
 *   Scanner (or vendor middleware) POSTs:
 *     POST http://127.0.0.1:8787/scan  { "thumbId": "42" }
 *   Agent forwards to Salon: POST /api/devices/attendance { thumbId, action: "toggle" }
 *
 * USB “keyboard wedge” scanners: prefer the kiosk page instead —
 *   /kiosk/attendance?key=ATTENDANCE_API_KEY
 *
 * Run: npm run device:agent
 */

import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  closeSync,
  writeSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "device-agent.env");

/** Default Epson-compatible drawer kick: ESC p 0 25 250 */
const DEFAULT_KICK = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
const SCAN_DEBOUNCE_MS = 2500;

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(ENV_PATH);

const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const API_KEY = process.env.DEVICE_API_KEY || "";
const ATTENDANCE_API_KEY = process.env.ATTENDANCE_API_KEY || "";
const PRINTER = process.env.DEVICE_PRINTER || "";
const OUTPUT = process.env.DEVICE_OUTPUT || "";
const POLL_MS = Math.max(500, Number(process.env.POLL_MS || 1500));
const ATTENDANCE_LISTEN_PORT = Number(process.env.ATTENDANCE_LISTEN_PORT || 0);
const ATTENDANCE_LISTEN_HOST = process.env.ATTENDANCE_LISTEN_HOST || "127.0.0.1";

const drawerEnabled = Boolean(API_KEY && (PRINTER || OUTPUT));
const attendanceEnabled = Boolean(ATTENDANCE_API_KEY);

if (!drawerEnabled && !attendanceEnabled) {
  console.error(`
Configure at least one role in ${ENV_PATH}:

Cash drawer / printer:
  APP_URL=http://localhost:3000
  DEVICE_API_KEY=printer-or-drawer-key
  DEVICE_PRINTER=\\\\localhost\\YourPrinterShareName

Fingerprint attendance (same agent):
  ATTENDANCE_API_KEY=attendance-terminal-key
  ATTENDANCE_LISTEN_PORT=8787

Keyboard-wedge USB scanners can skip the listen port and use:
  ${APP_URL}/kiosk/attendance?key=ATTENDANCE_API_KEY
`);
  process.exit(1);
}

if (API_KEY && !PRINTER && !OUTPUT) {
  console.warn(
    "[agent] DEVICE_API_KEY set but no DEVICE_PRINTER/DEVICE_OUTPUT — drawer/print polling disabled"
  );
}

function headers(apiKey = API_KEY) {
  return {
    "Content-Type": "application/json",
    "x-device-key": apiKey,
  };
}

async function fetchCommands() {
  const res = await fetch(`${APP_URL}/api/devices/commands`, { headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Poll failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.commands ?? [];
}

async function ackCommand(commandId, status, errorMessage) {
  const res = await fetch(`${APP_URL}/api/devices/commands`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ commandId, status, errorMessage }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ack failed (${res.status}): ${text}`);
  }
}

function kickBytesFromPayload(payload) {
  if (payload?.escPosBase64 && typeof payload.escPosBase64 === "string") {
    try {
      return Buffer.from(payload.escPosBase64, "base64");
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_KICK;
}

function writeRawToOutput(bytes) {
  const path = OUTPUT;
  const fd = openSync(path, "w");
  try {
    writeSync(fd, bytes);
  } finally {
    closeSync(fd);
  }
}

function writeRawToWindowsPrinter(bytes) {
  const tmpDir = join(__dirname, ".device-agent-tmp");
  mkdirSync(tmpDir, { recursive: true });
  const file = join(tmpDir, `kick-${Date.now()}.bin`);
  writeFileSync(file, bytes);

  const result = spawnSync("cmd.exe", ["/c", "copy", "/b", file, PRINTER], {
    encoding: "utf8",
    windowsHide: true,
  });

  try {
    unlinkSync(file);
  } catch {
    /* ignore */
  }

  if (result.status !== 0) {
    const err = [result.stderr, result.stdout, result.error?.message].filter(Boolean).join(" ").trim();
    throw new Error(err || `copy /b failed with code ${result.status}`);
  }
}

function sendKick(bytes) {
  if (OUTPUT) {
    writeRawToOutput(bytes);
    return { via: OUTPUT };
  }
  writeRawToWindowsPrinter(bytes);
  return { via: PRINTER };
}

async function handleCommand(cmd) {
  const { id, command, payload } = cmd;
  console.log(`[agent] ${command} (${id})`);

  try {
    if (command === "OPEN_DRAWER") {
      if (!drawerEnabled) {
        await ackCommand(id, "FAILED", "Drawer output not configured on agent");
        return;
      }
      const bytes = kickBytesFromPayload(payload);
      const dest = sendKick(bytes);
      console.log(`[agent] drawer kick sent → ${dest.via} (${bytes.length} bytes)`);
      await ackCommand(id, "COMPLETED");
      return;
    }

    if (command === "CLOSE_DRAWER") {
      await ackCommand(id, "COMPLETED");
      return;
    }

    if (command === "PRINT_RECEIPT" || command === "PRINT_TOKEN") {
      if (payload?.escPosBase64 && drawerEnabled) {
        const bytes = Buffer.from(payload.escPosBase64, "base64");
        sendKick(bytes);
        console.log(`[agent] raw print forwarded (${bytes.length} bytes)`);
      } else {
        console.log(`[agent] ${command} acknowledged (no raw payload — use browser print)`);
      }
      await ackCommand(id, "COMPLETED");
      return;
    }

    await ackCommand(id, "FAILED", `Unsupported command: ${command}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[agent] failed: ${message}`);
    try {
      await ackCommand(id, "FAILED", message);
    } catch (ackErr) {
      console.error(`[agent] ack error:`, ackErr);
    }
  }
}

async function tick() {
  if (!drawerEnabled) return;
  try {
    const commands = await fetchCommands();
    for (const cmd of commands) {
      await handleCommand(cmd);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[agent] poll error: ${message}`);
  }
}

let lastAttendanceScan = { thumbId: "", at: 0 };

async function postAttendanceScan(thumbId, action = "toggle") {
  const id = String(thumbId ?? "").trim();
  if (!id) throw new Error("thumbId required");

  const now = Date.now();
  if (lastAttendanceScan.thumbId === id && now - lastAttendanceScan.at < SCAN_DEBOUNCE_MS) {
    return { ok: true, deduped: true };
  }
  lastAttendanceScan = { thumbId: id, at: now };

  const res = await fetch(`${APP_URL}/api/devices/attendance`, {
    method: "POST",
    headers: headers(ATTENDANCE_API_KEY),
    body: JSON.stringify({ thumbId: id, action }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Attendance failed (${res.status})`);
  }
  return body;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function startAttendanceBridge() {
  if (!attendanceEnabled || !ATTENDANCE_LISTEN_PORT) {
    if (attendanceEnabled) {
      console.log(
        `[agent] attendance key set — use kiosk ${APP_URL}/kiosk/attendance?key=… or set ATTENDANCE_LISTEN_PORT for SDK bridge`
      );
    }
    return;
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${ATTENDANCE_LISTEN_HOST}`);

    // CORS for local vendor tools only
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "salon-attendance-bridge" }));
      return;
    }

    if (req.method === "POST" && (url.pathname === "/scan" || url.pathname === "/attendance")) {
      try {
        const body = await readJsonBody(req);
        const thumbId = body.thumbId ?? body.thumb_id ?? body.userId ?? body.user_id ?? body.id;
        const action = body.action === "check_in" || body.action === "check_out" ? body.action : "toggle";
        const result = await postAttendanceScan(thumbId, action);
        console.log(
          result.deduped
            ? `[agent] attendance deduped thumbId=${thumbId}`
            : `[agent] attendance ${result.action ?? "ok"} → ${result.staffName ?? thumbId}`
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[agent] attendance scan error: ${message}`);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found. POST /scan { thumbId }" }));
  });

  server.listen(ATTENDANCE_LISTEN_PORT, ATTENDANCE_LISTEN_HOST, () => {
    console.log(
      `[agent] attendance bridge http://${ATTENDANCE_LISTEN_HOST}:${ATTENDANCE_LISTEN_PORT}/scan`
    );
  });
}

console.log(`[agent] Salon device agent`);
console.log(`[agent] APP_URL=${APP_URL}`);
if (drawerEnabled) {
  console.log(`[agent] drawer/print output=${OUTPUT || PRINTER}`);
  console.log(`[agent] polling commands every ${POLL_MS}ms`);
}
if (attendanceEnabled) {
  console.log(`[agent] fingerprint attendance enabled`);
}
console.log(`[agent] Ctrl+C to stop`);

startAttendanceBridge();

if (drawerEnabled) {
  await tick();
  setInterval(() => {
    void tick();
  }, POLL_MS);
}
