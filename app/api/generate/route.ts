type GenerateRequest = { topic?: string; platform?: string; objective?: string };

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

export function extractGeneratedText(payload: ResponsesPayload) {
  if (payload.output_text?.trim()) return payload.output_text.trim();
  return (payload.output || []).flatMap((item) => item.content || []).filter((part) => part.type === "output_text" && typeof part.text === "string").map((part) => part.text!.trim()).filter(Boolean).join("\n");
}

export function splitGeneratedPost(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  return { title: lines[0].replace(/^title:\s*/i, ""), body: lines.slice(1).join(" ").replace(/^caption:\s*/i, "") };
}

export async function POST(request: Request) {
  let input: GenerateRequest = {};
  try { input = await request.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }
  const topic = (input.topic || "quality construction materials").slice(0, 240);
  const platform = (input.platform || "Facebook and Instagram").slice(0, 80);
  const objective = (input.objective || "brand visibility").slice(0, 120);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "AI generation is not configured. Add OPENAI_API_KEY in Vercel." }, { status: 503 });

  const prompt = "You are COBS Buildmasters Ltd's marketing assistant. Create one concise " + platform + " post for a construction business in Adenta New Legon, Ghana. Topic: " + topic + ". Objective: " + objective + ". Use only these verified facts: concrete blocks, construction materials, construction services, equipment rentals and flooring products; contacts 0594599327 and 0503466178. Do not invent prices, testimonials, projects, stock or credentials. Return exactly two lines: first line a short title; second line the caption with 3-6 relevant hashtags.";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", input: prompt }) });
    const payload = await response.json().catch(() => ({})) as ResponsesPayload & { error?: { message?: string } };
    if (!response.ok) return Response.json({ error: payload.error?.message || "OpenAI rejected the generation request.", providerStatus: response.status }, { status: 502 });
    const post = splitGeneratedPost(extractGeneratedText(payload));
    if (!post) return Response.json({ error: "OpenAI returned no usable post text. No draft was created." }, { status: 502 });
    return Response.json({ ...post, source: "ai" as const });
  } catch {
    return Response.json({ error: "The AI provider could not be reached. No draft was created." }, { status: 503 });
  }
}
