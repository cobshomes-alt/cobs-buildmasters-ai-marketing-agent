type ResponsesPayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};
export function extractGeneratedText(payload: ResponsesPayload) {
  if (payload.output_text?.trim()) return payload.output_text.trim();
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter(
      (part) => part.type === "output_text" && typeof part.text === "string",
    )
    .map((part) => part.text!.trim())
    .filter(Boolean)
    .join("\n");
}
export function splitGeneratedPost(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const title = lines[0].replace(/^title:\s*/i, "");
  const body = lines
    .slice(1)
    .join("\n")
    .replace(/^caption:\s*/i, "");
  return title && body ? { title, body } : null;
}
