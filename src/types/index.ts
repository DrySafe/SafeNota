export type Role = "admin" | "operator" | "viewer";
export interface Panel {
  id: string;
  name: string;
  role: Role;
}
export interface Row {
  id: string;
  panel_id: string;
  created_at: string;
  deleted_at?: string | null;
  [key: string]: unknown;
}
export type Table =
  | "clients"
  | "services"
  | "billing_requests"
  | "contracts"
  | "projects"
  | "invoices"
  | "receivables"
  | "payments"
  | "payment_allocations"
  | "email_rules"
  | "captured_messages"
  | "audit_events"
  | "attachments"
  | "request_services"
  | "invoice_services";
export type Data = Record<Table, Row[]>;
export interface Field {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "textarea"
    | "select"
    | "email"
    | "service-list";
  required?: boolean;
  options?: string[];
  choices?: { value: string; label: string }[];
  relation?: Table;
}
