import { redirect } from "next/navigation";
import { getDevices, getDeviceCommands } from "@/lib/actions/devices";
import { canManageRecords } from "@/lib/auth/permissions";
import { DeviceRegisterForm } from "@/components/features/devices/device-form";
import {
  DeviceCommandsTable,
  DevicesTable,
} from "@/components/features/devices/devices-lists";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DevicesPage() {
  const canManage = await canManageRecords();
  if (!canManage) redirect("/dashboard");

  const [devices, commands] = await Promise.all([getDevices(), getDeviceCommands()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
        <p className="text-muted-foreground">
          Attendance terminals, cash drawers, and printers. Devices can also auto-register via API.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Register device</CardTitle>
          <CardDescription>Manual registration for salon hardware</CardDescription>
        </CardHeader>
        <CardContent>
          <DeviceRegisterForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected devices</CardTitle>
        </CardHeader>
        <CardContent>
          <DevicesTable devices={devices} canManage={canManage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cash drawer setup</CardTitle>
          <CardDescription>
            Most drawers open through the receipt printer’s kick port (RJ11), not a separate USB
            cable. Register a Printer or Cash drawer below, then run the local agent on the POS PC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Plug the cash drawer cable into the printer’s <strong>DK / drawer / kick</strong> port.
            </li>
            <li>
              Register a <strong>Printer</strong> (or Cash drawer) here and copy the API key.
            </li>
            <li>
              On the POS PC, copy{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                scripts/device-agent.env.example
              </code>{" "}
              to{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">scripts/device-agent.env</code>,
              set <code className="text-xs">DEVICE_API_KEY</code> and{" "}
              <code className="text-xs">DEVICE_PRINTER</code> (Windows printer share name).
            </li>
            <li>
              Keep{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run device:agent</code>{" "}
              running while you use POS. Cash checkout and <strong>Open drawer</strong> will kick the
              till.
            </li>
          </ol>
          <p>
            Without the agent, open-drawer commands stay <strong>PENDING</strong> in the queue below
            and the physical drawer will not move.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fingerprint attendance setup</CardTitle>
          <CardDescription>
            Same POS agent can also run thumb check-in. Backend APIs are ready now; plug the scanner
            when you have it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Register an <strong>Attendance terminal</strong> here and save the API key.
            </li>
            <li>
              On <strong>Attendance</strong>, enroll each stylist’s scanner user/slot ID as their
              thumb ID (or use <code className="text-xs">POST /api/devices/enroll-thumb</code>).
            </li>
            <li>
              <strong>USB keyboard-wedge scanners</strong> (most common): open{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                /kiosk/attendance?key=YOUR_KEY
              </code>{" "}
              on the front-desk screen and leave it focused. Place thumb → check in/out.
            </li>
            <li>
              <strong>SDK / network scanners</strong>: in{" "}
              <code className="text-xs">device-agent.env</code> set{" "}
              <code className="text-xs">ATTENDANCE_API_KEY</code> and{" "}
              <code className="text-xs">ATTENDANCE_LISTEN_PORT=8787</code>, run{" "}
              <code className="text-xs">npm run device:agent</code>, then have the scanner software
              POST{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {"{ \"thumbId\": \"42\" }"}
              </code>{" "}
              to <code className="text-xs">http://127.0.0.1:8787/scan</code>.
            </li>
          </ol>
          <p>
            Manual check-in on Attendance still works if the scanner or internet is down. You can
            run drawer + fingerprint on one PC with both keys in the same agent env file.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Device API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm font-mono">
          <p>Auto-register: POST /api/devices/register</p>
          <p>Poll commands: GET /api/devices/commands</p>
          <p>Thumb attendance: POST /api/devices/attendance (thumbId + action: toggle)</p>
          <p>Enroll thumb: POST /api/devices/enroll-thumb</p>
          <p>Recent scans: GET /api/devices/attendance/recent</p>
          <p>Drawer: POST /api/devices/drawer</p>
          <p>Print: POST /api/devices/print</p>
          <p className="pt-2 font-sans text-muted-foreground">
            Kiosk display: <code>/kiosk/attendance?key=DEVICE_API_KEY</code>
          </p>
          <p className="font-sans text-muted-foreground">
            Local agent: <code>npm run device:agent</code> (drawer + optional attendance bridge)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent commands</CardTitle>
        </CardHeader>
        <CardContent>
          <DeviceCommandsTable commands={commands} />
        </CardContent>
      </Card>
    </div>
  );
}
