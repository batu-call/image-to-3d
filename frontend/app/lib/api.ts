const BASE = "/backend";

export type JobState = {
  id?: string;
  status: "running" | "done" | "error";
  progress?: number;
  modelUrl?: string;
  error?: string;
};

async function readError(res: Response) {
  try {
    const d = await res.json();
    return d.detail ?? d.error ?? d.message ?? `Hata (${res.status})`;
  } catch {
    return `Hata (${res.status})`;
  }
}

function fixUrl(url: string) {
  return url.startsWith("/") ? `${BASE}${url}` : url;
}

function normalize(d: Record<string, unknown>): JobState {
  const url = (d.model_url ?? d.modelUrl ?? d.url) as string | undefined;
  const raw = String(d.status ?? "").toLowerCase();
  const id = (d.job_id ?? d.id) as string | undefined;

  if (raw === "failed" || raw === "error" || d.error) {
    return { id, status: "error", error: String(d.error ?? "Üretim başarısız") };
  }
  if (url) {
    return { id, status: "done", progress: 100, modelUrl: fixUrl(url) };
  }
  return {
    id,
    status: "running",
    progress: typeof d.progress === "number" ? d.progress : undefined,
  };
}

export async function createImageJob(file: File, quality: string) {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("quality", quality.toLowerCase());

  const res = await fetch(`${BASE}/api/image-to-3d`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await readError(res));
  return normalize(await res.json());
}

export async function getJob(id: string) {
  const res = await fetch(`${BASE}/api/jobs/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await readError(res));
  return normalize(await res.json());
}