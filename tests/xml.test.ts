// @vitest-environment jsdom
import { expect, it } from "vitest";
import { parseInvoice } from "../src/modules/invoices/xml";
const xml = `<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS123"><nNFSe>12</nNFSe><emit><CNPJ>00000000000001</CNPJ></emit><valores><vLiq>75.00</vLiq></valores><DPS><infDPS><dhEmi>2026-09-15T12:00:00-03:00</dhEmi><dCompet>2026-09-01</dCompet><toma><CNPJ>00000000000002</CNPJ><xNome>Cliente fictício</xNome></toma><serv><xDescServ>Pedido: 4500010497; chamado 23628-1</xDescServ></serv><valores><vServ>80.00</vServ></valores></infDPS></DPS></infNFSe></NFSe>`;
it("extrai valores distintos e referências conservando sufixo", () =>
  expect(parseInvoice(xml)).toMatchObject({
    number: "12",
    fiscal_key: "123",
    amount: 80,
    net_amount: 75,
    order_number: "4500010497",
    ticket_numbers: "23628-1",
    client_name: "Cliente fictício",
  }));
it("recusa entidades e documentos fora do padrão", () => {
  expect(() => parseInvoice("<!DOCTYPE NFSe>" + xml)).toThrow();
  expect(() => parseInvoice("<outra/>")).toThrow();
  expect(() => parseInvoice(xml.replace("80.00", "inválido"))).toThrow();
});
