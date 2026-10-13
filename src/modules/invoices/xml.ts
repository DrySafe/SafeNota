import { unzipSync, strFromU8 } from "fflate";
export interface ParsedInvoice {
  title: string;
  number: string;
  fiscal_key: string;
  issuer_document: string;
  client_document: string;
  client_name: string;
  amount: number;
  net_amount: number;
  issue_date: string;
  competence: string;
  description: string;
  order_number: string;
  ticket_numbers: string;
}
export function parseInvoice(xml: string): ParsedInvoice {
  if (xml.length > 10 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error(
      "XML não permitido: tamanho excessivo ou entidades externas.",
    );
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (
    doc.getElementsByTagName("parsererror").length ||
    doc.documentElement.localName !== "NFSe" ||
    doc.documentElement.namespaceURI !== "http://www.sped.fazenda.gov.br/nfse"
  )
    throw new Error("Arquivo inválido ou fora do padrão nacional NFS-e.");
  const find = (parent: Element | Document, name: string) =>
    Array.from(parent.getElementsByTagNameNS("*", name))[0];
  const text = (parent: Element | Document | undefined, name: string) =>
    parent ? find(parent, name)?.textContent?.trim() || "" : "";
  const info = find(doc, "infNFSe");
  const dps = find(doc, "infDPS");
  const issuer = info && find(info, "emit");
  const client = dps && find(dps, "toma");
  const description = text(dps, "xDescServ");
  const number = text(info, "nNFSe");
  const key = info?.getAttribute("Id")?.replace(/^NFS/, "") || "";
  const amount = Number(text(dps, "vServ"));
  const net = Number(text(info, "vLiq"));
  const date = text(dps, "dhEmi").slice(0, 10);
  if (
    !number ||
    !key ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isFinite(net) ||
    net < 0
  )
    throw new Error("Nota sem identificação, emissão ou valores válidos.");
  const order =
    description.match(/pedido\s*(?:n[ºo°.]*)?\s*[:#-]?\s*(\d+)/i)?.[1] || "";
  const tickets = Array.from(description.matchAll(/\b\d{4,}-\d+\b/g)).map(
    (m) => m[0],
  );
  return {
    title: `NF ${number}`,
    number,
    fiscal_key: key,
    issuer_document: text(issuer, "CNPJ") || text(issuer, "CPF"),
    client_document: text(client, "CNPJ") || text(client, "CPF"),
    client_name: text(client, "xNome"),
    amount,
    net_amount: net,
    issue_date: date,
    competence: text(dps, "dCompet"),
    description,
    order_number: order,
    ticket_numbers: [...new Set(tickets)].join(", "),
  };
}
export async function readInvoiceFiles(files: File[]) {
  const output: { name: string; xml: string }[] = [];
  let total = 0;
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024)
      throw new Error("Cada arquivo deve ter até 10 MB.");
    if (/\.zip$/i.test(file.name)) {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (f) => {
          if (!/\.xml$/i.test(f.name)) return false;
          if (f.originalSize > 10 * 1024 * 1024)
            throw new Error("XML compactado acima de 10 MB.");
          total += f.originalSize;
          if (total > 30 * 1024 * 1024)
            throw new Error("Lote descompactado acima de 30 MB.");
          return true;
        },
      });
      for (const [name, bytes] of Object.entries(entries))
        output.push({ name, xml: strFromU8(bytes) });
    } else if (/\.xml$/i.test(file.name)) {
      total += file.size;
      output.push({ name: file.name, xml: await file.text() });
    } else throw new Error("Selecione XML ou ZIP.");
    if (output.length > 50 || total > 30 * 1024 * 1024)
      throw new Error("Limite de 50 XMLs e 30 MB por lote.");
  }
  if (!output.length) throw new Error("Nenhum XML encontrado.");
  return output;
}
