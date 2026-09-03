export type ExpenseCategory =
  | "RENT"
  | "UTILITIES"
  | "SUPPLIES"
  | "PAYROLL"
  | "MARKETING"
  | "MAINTENANCE"
  | "OTHER";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  SUPPLIES: "Supplies",
  PAYROLL: "Payroll",
  MARKETING: "Marketing",
  MAINTENANCE: "Maintenance",
  OTHER: "Other",
};

export type StaffPaymentType = "SALARY" | "PARTIAL" | "ADVANCE" | "BONUS";

export const STAFF_PAYMENT_TYPE_LABELS: Record<StaffPaymentType, string> = {
  SALARY: "Full salary",
  PARTIAL: "Partial payment",
  ADVANCE: "Salary advance",
  BONUS: "Bonus",
};
