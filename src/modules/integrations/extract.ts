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
    /(?:valor total[^\n:]*|valor)\s*:?\s*\*{0,2}R\$\s*([\d.,]+)/i,
  );
  const ticketSection =
    text.match(
      /chamados referentes[^\n]*\n([\s\S]*?)(?:dados do tomador|envio da nota|observa[çc][õo]es importantes|$)/i,
    )?.[1] || text;
  const ticketText = ticketSection
    .replace(
      /^[^\S\r\n]*\*{0,2}(?:telefone|tel\.?|celular|whatsapp|fone|contato telef[oô]nico|endere[çc]o|cpf|cnpj|rg|cep|e-?mail)\b[^\r\n]*(?:\r?\n|$)/gim,
      "",
    )
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "")
    .replace(/\bCEP\s*[:–-]?\s*\d{5}-?\d{3}\b/gi, "");
  const deadline = capture(
    "send_deadline",
    /(?:prazo limite[^\n]*?é|prazo limite[^\n:]*:|prazo de envio[^\n:]*:)\s*\*{0,2}(\d{2}\/\d{2}\/\d{4})/i,
  );
  const parts = deadline.split("/");
  const deadlineIso =
    parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : "";
  const deadlineDate = new Date(deadlineIso + "T12:00:00Z");
  const sendDeadline =
    deadlineIso &&
    !Number.isNaN(deadlineDate.getTime()) &&
    deadlineDate.toISOString().slice(0, 10) === deadlineIso
      ? deadlineIso
      : null;
  const description = capture(
    "description",
    /descri[çc][ãa]o:\s*\*{0,2}([^\n]+)/i,
  )
    .replace(/\*{1,2}$/g, "")
    .trim();
  const receivedStatus = capture(
    "received_status",
    /status do atendimento:\s*\*{0,2}([^\n]+)/i,
  )
    .replace(/\*{1,2}$/g, "")
    .trim();
  const ticketNumber = capture(
    "ticket_number",
    /(?:chamado(?: de n[uú]mero)?)\s*:?\s*\*{0,2}(\d+-\d+)/i,
  );
  const ticketMatches = Array.from(ticketText.matchAll(/\b\d{4,}-\d+\b/g));
  const tickets = [...new Set(ticketMatches.map((match) => match[0]))];
  const ticketItems = tickets.map((ticket) => {
    const match = ticketMatches.find((candidate) => candidate[0] === ticket)!;
    const start = match.index! + ticket.length;
    const following = ticketText.slice(start);
    const nextTicket = following.search(/\b\d{4,}-\d+\b/);
    const row = nextTicket < 0 ? following : following.slice(0, nextTicket);
    return {
      ticket_number: ticket,
      reference: row.match(/\b((?:INC|SUP)[-\d]+)\b/i)?.[1] || "",
    };
  });
  return {
    title:
      kind === "request"
        ? "Requisição recebida por e-mail"
        : description ||
          (ticketNumber
            ? `Chamado ${ticketNumber}`
            : "Chamado recebido por e-mail"),
    order_number: capture(
      "order_number",
      /(?:número do pedido|pedido)\s*:?\s*\*{0,2}(\d+)/i,
    ),
    ticket_number: ticketNumber,
    // A transfer has one authoritative ticket, read from its explicitly labelled field.
    ticket_numbers: kind === "service" ? ticketNumber : tickets.join(", "),
    reference:
      kind === "request" && !patterns.reference
        ? ticketItems.map((item) => item.reference || "—").join(", ")
        : capture("reference", /\b((?:INC|SUP)[-\d]+)\b/i),
    ticket_items: kind === "request" ? ticketItems : [],
    amount: amountText
      ? Number(amountText.replace(/\./g, "").replace(",", "."))
      : 0,
    send_deadline: sendDeadline,
    description,
    received_status: receivedStatus,
    notes: text.slice(0, 10000),
  };
}
