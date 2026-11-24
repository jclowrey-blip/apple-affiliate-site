import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasAccess } from "@/lib/pm/access";
import type { AssistantEvent } from "@/lib/pm/assistant/events";
import { ASSISTANT_MODEL, SYSTEM_PROMPT, contextBlock } from "@/lib/pm/assistant/prompt";
import { assistantTools, executeTool } from "@/lib/pm/assistant/tools";
import { todayString } from "@/lib/pm/dates";
import { listProjects } from "@/lib/pm/projects";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /pm/api/assistant
// Body: { messages: [{ role, content }], project?: slug }
// Response: newline-delimited JSON events (see AssistantEvent), so the chat
// can show what the assistant is doing while it works.

const requestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) }))
    .min(1)
    .max(60)
    .refine((m) => m[m.length - 1].role === "user", "The last message must be from the user"),
  project: z.string().max(80).optional(),
});

function describeFailure(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError || (error instanceof Error && /api[_ ]?key|authToken|authentication method/i.test(error.message))) {
    return "The assistant has no working Anthropic API key. Add ANTHROPIC_API_KEY=… to the .env file and restart the app.";
  }
  if (error instanceof Anthropic.PermissionDeniedError) return "This API key isn't allowed to use the assistant's model.";
  if (error instanceof Anthropic.RateLimitError) return "The Claude API is rate limiting requests right now. Try again in a minute.";
  if (error instanceof Anthropic.APIConnectionError) return "Couldn't reach the Claude API. Check the network connection and try again.";
  if (error instanceof Anthropic.APIError) return `The Claude API returned an error (${error.status ?? "unknown"}). Try again.`;
  return "The assistant ran into an unexpected problem. Try again.";
}

export async function POST(request: Request) {
  if (!(await hasAccess())) return new Response("Not found", { status: 404 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { messages, project } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AssistantEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let mutated = false;
      try {
        const client = new Anthropic();
        const tools = assistantTools.map((t) =>
          betaZodTool({
            name: t.name,
            description: t.description,
            inputSchema: t.schema,
            run: async (input) => {
              send({ type: "tool", label: t.label });
              const outcome = await executeTool(t.name, input);
              mutated ||= outcome.mutated;
              return outcome.content;
            },
          }),
        );

        const final = await client.beta.messages.toolRunner(
          {
            model: ASSISTANT_MODEL,
            max_tokens: 16000,
            output_config: { effort: "medium" },
            // If a safety classifier declines a request, let the API retry it
            // on its default fallback model instead of failing the turn.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system: [
              { type: "text", text: SYSTEM_PROMPT },
              { type: "text", text: contextBlock({ today: todayString(), currentProject: project, projects: await listProjects() }) },
            ],
            tools,
            messages,
            max_iterations: 16,
          },
          { signal: request.signal },
        );

        const text = final.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n\n")
          .trim();
        if (final.stop_reason === "refusal") {
          send({ type: "final", text: "I can't help with that request.", mutated });
        } else if (final.stop_reason === "tool_use") {
          send({ type: "final", text: `${text}\n\nI stopped before finishing because this took more steps than I'm allowed in one turn. Ask me to continue.`.trim(), mutated });
        } else if (final.stop_reason === "max_tokens") {
          send({ type: "final", text: `${text}\n\n(The reply was cut off because it got too long. Ask me to continue.)`.trim(), mutated });
        } else {
          send({ type: "final", text: text || "Done.", mutated });
        }
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("[pm] assistant request failed", error);
          send({ type: "error", message: describeFailure(error) + (mutated ? " Some changes were already saved before this happened; check the tracker." : "") });
        }
      } finally {
        if (mutated) revalidatePath("/pm", "layout");
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
