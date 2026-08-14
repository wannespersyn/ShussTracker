import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BottomNav } from "@/components/layout/BottomNav";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/onboarding");

  return (
    <div className="flex-1 flex flex-col">
      {children}
      <BottomNav />
    </div>
  );
}
