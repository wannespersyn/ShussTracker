"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { setFeedbackStatus } from "@/lib/db/feedback";
import { feedbackStatusEnum } from "@/lib/db/schema";

type Status = (typeof feedbackStatusEnum.enumValues)[number];

export async function setFeedbackStatusAction(id: string, formData: FormData) {
  await requireAdmin();
  const status = String(formData.get("status"));
  if (!(feedbackStatusEnum.enumValues as readonly string[]).includes(status)) return;
  await setFeedbackStatus(id, status as Status);
  revalidatePath("/admin");
  revalidatePath("/feedback");
}
