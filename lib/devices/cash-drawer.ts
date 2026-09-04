import { findDeviceByType, queueDeviceCommand } from "@/lib/devices/helpers";

/**
 * Standard ESC/POS cash-drawer kick (Epson-compatible).
 * Most salon drawers plug into the printer’s RJ11/RJ12 kick port.
 * ESC p m t1 t2 → open drawer pin 2, pulse ~50ms / ~100ms
 */
export const CASH_DRAWER_ESC_POS = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);

export function cashDrawerEscPosBase64(): string {
  return CASH_DRAWER_ESC_POS.toString("base64");
}

export type OpenCashDrawerResult = {
  ok: true;
  deviceId: string;
  deviceRole: "DRAWER" | "PRINTER";
  commandId: string | null;
} | {
  ok: false;
  error: string;
};

/**
 * Queue a physical cash-drawer open.
 * Prefers the receipt PRINTER (drawer kick port is almost always on the printer),
 * otherwise a dedicated DRAWER device. Run `npm run device:agent` with that device’s API key.
 */
export async function queueOpenCashDrawer(
  organizationId: string,
  payload: Record<string, unknown> = {}
): Promise<OpenCashDrawerResult> {
  const printerId = await findDeviceByType(organizationId, "PRINTER");
  const drawerId = printerId ? null : await findDeviceByType(organizationId, "DRAWER");
  const deviceId = printerId ?? drawerId;

  if (!deviceId) {
    return {
      ok: false,
      error:
        "No cash drawer or receipt printer registered. Add a Printer or Cash drawer under Devices, then run the device agent on the POS PC.",
    };
  }

  const deviceRole = printerId ? "PRINTER" : "DRAWER";
  const commandId = await queueDeviceCommand(organizationId, deviceId, "OPEN_DRAWER", {
    ...payload,
    deviceRole,
    escPosBase64: cashDrawerEscPosBase64(),
    /** Hint for local agents / printer firmware */
    kick: "ESC_POS_DRAWER",
  });

  return { ok: true, deviceId, deviceRole, commandId };
}

export async function hasCashDrawerHardware(organizationId: string): Promise<boolean> {
  const drawerId = await findDeviceByType(organizationId, "DRAWER");
  if (drawerId) return true;
  const printerId = await findDeviceByType(organizationId, "PRINTER");
  return Boolean(printerId);
}
