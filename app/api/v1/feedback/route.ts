/**
 * /api/v1/feedback
 *
 * GET  → the public ideas board, most-voted first, with the viewer's votes.
 * POST → `{ type: "bug" | "idea" | "other", text, groupId? }` sends feedback
 *        (an idea gets the sender's own vote). Returns 201.
 */
import { api, badRequest, oneOf, readJson, str } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { getIdeas, submitFeedback, type FeedbackType } from "@/lib/db/feedback";
import { requireGroupMember } from "@/lib/db/authz";

const TYPES: FeedbackType[] = ["bug", "idea", "other"];

export const GET = api(async (req) => ({ ideas: await getIdeas(await requireApiUser(req)) }));

export const POST = api(async (req) => {
  const userId = await requireApiUser(req);
  const body = await readJson(req);
  const type = oneOf(body, "type", TYPES);
  const text = str(body, "text", 1000);
  if (text.length < 3) throw badRequest("Feedback is too short");
  // Only link a crew the sender is actually in.
  const groupId =
    typeof body.groupId === "string"
      ? await requireGroupMember(userId, body.groupId).then(
          () => body.groupId as string,
          () => null,
        )
      : null;
  await submitFeedback({ userId, type, text, groupId });
  return new Response(null, { status: 201 });
});
