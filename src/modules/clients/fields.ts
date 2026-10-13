import type { Field } from "../../types";
export const clientFields: Field[] = [
  { key: "name", label: "Nome / razão social", required: true },
  { key: "document", label: "CPF ou CNPJ" },
  { key: "email", label: "E-mail", type: "email" },
  { key: "phone", label: "Telefone" },
  { key: "description", label: "Observações", type: "textarea" },
];
