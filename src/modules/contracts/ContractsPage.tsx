import { useState } from "react";
import { EntityPage } from "../../components/EntityPage";
import { useStore, message } from "../../app/Store";
export function ContractsPage() {
  const s = useStore();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <EntityPage
      table="contracts"
      title="Contratos mensais"
      subtitle="Uma cobrança por competência, com histórico de recebimento."
      extra={
        <div className="notice">
          As mensalidades seguem o dia de vencimento do contrato.{" "}
          {s.role !== "viewer" && (
            <button
              className="link"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await s.generateInstallments();
                  setNotice(
                    "Competências deste mês atualizadas, sem duplicatas.",
                  );
                } catch (e) {
                  setNotice(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Gerando…" : "Gerar competências deste mês"}
            </button>
          )}
          {notice && <p role="status">{notice}</p>}
        </div>
      }
      fields={[
        { key: "title", label: "Contrato", required: true },
        {
          key: "client_id",
          label: "Cliente",
          relation: "clients",
          required: true,
        },
        {
          key: "amount",
          label: "Valor mensal",
          type: "number",
          required: true,
        },
        {
          key: "due_day",
          label: "Dia de vencimento (1 a 31)",
          type: "number",
          required: true,
        },
        { key: "start_date", label: "Início", type: "date", required: true },
        { key: "end_date", label: "Término", type: "date" },
        {
          key: "status",
          label: "Situação",
          options: ["Ativo", "Suspenso", "Encerrado"],
        },
        { key: "notes", label: "Observações", type: "textarea" },
      ]}
    />
  );
}
