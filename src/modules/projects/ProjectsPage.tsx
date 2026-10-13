import { useState } from "react";
import { useStore, message } from "../../app/Store";
import { EntityPage } from "../../components/EntityPage";
export function ProjectsPage() {
  const s = useStore();
  const [notice, setNotice] = useState("");
  return (
    <EntityPage
      table="projects"
      title="Projetos"
      subtitle="Cliente, etapas e prazo em uma visão simples."
      extra={
        <>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {s
            .current("projects")
            .filter((p) => p.stages)
            .map((p) => (
              <section className="surface" key={p.id}>
                <h2>{String(p.title)} · Etapas</h2>
                {String(p.stages)
                  .split("\n")
                  .filter(Boolean)
                  .map((stage, i) => (
                    <label className="stage-check" key={i}>
                      <input
                        type="checkbox"
                        disabled={s.role === "viewer"}
                        checked={Boolean(
                          ((p.stage_states as Record<string, boolean>) || {})[
                            String(i)
                          ],
                        )}
                        onChange={async (e) => {
                          try {
                            await s.save(
                              "projects",
                              {
                                stage_states: {
                                  ...((p.stage_states as Record<
                                    string,
                                    boolean
                                  >) || {}),
                                  [String(i)]: e.target.checked,
                                },
                              },
                              p.id,
                            );
                          } catch (e) {
                            setNotice(message(e));
                          }
                        }}
                      />
                      {stage}
                    </label>
                  ))}
              </section>
            ))}
        </>
      }
      fields={[
        { key: "title", label: "Nome do projeto", required: true },
        {
          key: "client_id",
          label: "Cliente",
          relation: "clients",
          required: true,
        },
        { key: "description", label: "Descrição", type: "textarea" },
        { key: "due_date", label: "Prazo", type: "date" },
        { key: "stages", label: "Etapas (uma por linha)", type: "textarea" },
        {
          key: "status",
          label: "Situação",
          options: ["Planejamento", "Em andamento", "Concluído", "Cancelado"],
        },
      ]}
    />
  );
}
