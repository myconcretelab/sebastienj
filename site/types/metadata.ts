export type AttributeValue =
  | { type: "text"; value: string }
  | { type: "textarea"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "date"; value: string }
  | { type: "number"; value: number }
  | { type: "link"; value: { url: string; label?: string } }
  | { type: "image"; value: string }
  | { type: "select"; value: string }
  | { type: "color"; value: string };

export type AttributeRecord = Record<string, AttributeValue>;

export type AttributeType = {
  id: string;
  label: string;
  input:
    | "text"
    | "textarea"
    | "checkbox"
    | "date"
    | "number"
    | "link"
    | "image"
    | "select"
    | "color";
  options?: string[];
  description?: string;
};
