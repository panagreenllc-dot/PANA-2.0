export const CATEGORIES = [
  "AI",
  "Startup",
  "Cybersecurity",
  "Robotics",
  "Blockchain",
  "Community",
  "Other",
] as const;

export type ProjectInput = {
  project_name: string;
  category: string;
  description: string;
  website: string;
};

export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ProjectInput, string>>;
  values?: Partial<ProjectInput>;
};

export const MAX_PENDING_PER_USER = 3;

export function parseProject(formData: FormData): {
  data?: ProjectInput;
  state?: FormState;
} {
  const values: ProjectInput = {
    project_name: String(formData.get("project_name") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
  };
  const fieldErrors: FormState["fieldErrors"] = {};

  if (values.project_name.length < 2 || values.project_name.length > 80)
    fieldErrors.project_name = "Project name must be 2–80 characters.";
  if (!(CATEGORIES as readonly string[]).includes(values.category))
    fieldErrors.category = "Choose a category from the list.";
  if (values.description.length < 30 || values.description.length > 1000)
    fieldErrors.description = "Description must be 30–1000 characters.";
  if (values.website) {
    try {
      const u = new URL(values.website);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      if (values.website.length > 300) throw new Error();
    } catch {
      fieldErrors.website = "Enter a valid http(s) URL, or leave it blank.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { state: { error: "Please fix the highlighted fields.", fieldErrors, values } };
  }
  return { data: values };
}
