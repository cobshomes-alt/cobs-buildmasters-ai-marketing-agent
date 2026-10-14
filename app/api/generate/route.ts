type GenerateRequest = { topic?: string; platform?: string; objective?: string };

function starterPost(topic: string) {
  const subject = topic || "quality construction materials";
  return {
    title: "Build with confidence — COBS Buildmasters",
    body: "Planning your next project in Adenta New Legon? COBS Buildmasters provides dependable " + subject + ", concrete blocks, fast floors and construction support. Call 0594599327 or 0503466178 to discuss your needs. #COBSBuildmasters #ConstructionGhana #AdentaNewLegon",
    source: "starter" as const,
  };
}

export async function POST(request: Request) {
  let input: GenerateRequest = {};
  try { input = await request.json(); } catch {}
  const topic = (input.topic || "quality construction materials").slice(0, 240);
  const platform = (input.platform || "Facebook and Instagram").slice(0, 80);
  const objective = (input.objective || "brand visibility").slice(0, 120);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ ...starterPost(topic), message: "Starter draft created. Add OPENAI_API_KEY in Vercel to enable AI generation." });
  }

  const prompt = "You are COBS Buildmasters Ltd's marketing assistant. Create one concise " + platform + " post for a construction business in Adenta New Legon, Ghana. Topic: " + topic + ". Objective: " + objective + ". Use only these verified facts: concrete blocks, construction materials, construction services, equipment rentals and flooring products; contacts 0594599327 and 0503466178. Do not invent prices, testimonials, projects, stock or credentials. Return exactly two lines: first line a short title; second line the caption with 3-6 relevant hashtags.";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", input: prompt }),
    });
    if (!response.ok) throw new Error("OpenAI request failed");
    const result = await response.json() as { output_text?: string };
    const lines = (result.output_text || "").split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) throw new Error("No generated content returned");
    return Response.json({ title: lines[0].replace(/^title:\s*/i, ""), body: lines.slice(1).join(" ").replace(/^caption:\s*/i, ""), source: "ai" });
  } catch {
    return Response.json({ ...starterPost(topic), message: "AI generation is temporarily unavailable, so a starter draft was created instead." });
  }
}
