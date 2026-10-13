import { RE2JS } from "re2js";
export function extractEmail(
  text: string,
  kind: string,
  patterns: Record<string, string> = {},
) {
  const capture = (key: string, fallback: RegExp) => {
    const p = patterns[key];
    if (
      p &&
      (/\)[+*{]|\||\\[1-9]|\(\?/.test(p.replace(/ /g, "")) ||
        p.includes(".*") ||
        p.includes(".+"))
    )
      throw new Error(
        "Use padrões simples, sem repetição de grupos, referências ou curingas ilimitados.",
      );
    if (p && p.length > 200)
      throw new Error("Expressão de extração muito longa.");
    try {
      if (p) {
        const match = RE2JS.compile(p, RE2JS.CASE_INSENSITIVE).matcher(
          text.slice(0, 10000),
        );
        return match.find() ? match.group(1)?.trim() || "" : "";
      }
      return text.slice(0, 10000).match(fallback)?.[1]?.trim() || "";
    } catch {
      throw new Error(`Padrão inválido: ${key}`);
    }
  };
  const amountText = capture(
    "amount",
    /(?:valor total[^\n:]*|valor)\s*:?\s*R\$\s*([\d.,]+)/i,
  );
  return {
    title:
      kind === "request"
        ? "Pedido recebido por e-mail"
        : "Chamado recebido por e-mail",
    order_number: capture(
      "order_number",
      /(?:número do pedido|pedido)\s*:?\s*\*{0,2}(\d+)/i,
    ),
    ticket_number: capture(
      "ticket_number",
      /(?:chamado(?: de número)?|chamado)\s*:?\s*\*{0,2}(\d+-\d+)/i,
    ),
    ticket_numbers: [
      ...new Set(Array.from(text.matchAll(/\b\d{4,}-\d+\b/g)).map((m) => m[0])),
    ].join(", "),
    reference: capture("reference", /\b((?:INC|SUP)[-\d]+)\b/i),
    amount: amountText
      ? Number(amountText.replace(/\./g, "").replace(",", "."))
      : 0,
    notes: text.slice(0, 10000),
  };
}
