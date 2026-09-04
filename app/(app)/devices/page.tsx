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
