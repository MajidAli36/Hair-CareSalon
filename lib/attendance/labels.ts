export const ATTENDANCE_METHOD_LABELS: Record<string, string> = {
  BIOMETRIC: "Thumb scan",
  DEVICE: "Device PIN",
  MANUAL: "Manual",
  APP: "App",
};

export function attendanceMethodLabel(method: string) {
  return ATTENDANCE_METHOD_LABELS[method] ?? method;
}
