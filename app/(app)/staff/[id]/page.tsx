import { notFound } from "next/navigation";
import { getStaffMonthlyDetail } from "@/lib/actions/reports";
import { StaffMonthlyDetailView } from "@/components/features/staff/staff-monthly-detail";
import { getLocalDateString } from "@/lib/dates/local";
import { canManageRecords } from "@/lib/auth/permissions";

type StaffDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
};

export default async function StaffDetailPage({
  params,
  searchParams,
}: StaffDetailPageProps) {
  const { id } = await params;
  const { month } = await searchParams;
  const yearMonth =
    month && /^\d{4}-\d{2}$/.test(month) ? month : getLocalDateString().slice(0, 7);

  const [data, canManage] = await Promise.all([
    getStaffMonthlyDetail(id, yearMonth),
    canManageRecords(),
  ]);
  if (!data) notFound();

  return <StaffMonthlyDetailView data={data} canManage={canManage} />;
}
