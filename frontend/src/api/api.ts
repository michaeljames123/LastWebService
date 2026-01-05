import type { AiStatus, ContactMessage, Scan, TokenResponse, User } from "../types";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  options: (RequestInit & { token?: string | null }) = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  const text = await res.text();
  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data ? (data as any).detail : data;

    const msg = Array.isArray(detail)
      ? JSON.stringify(detail)
      : String(detail ?? res.statusText);

    throw new Error(msg);
  }

  return data as T;
}

export type RegisterInput = {
  email: string;
  username: string;
  full_name?: string;
  password: string;
};

export function registerUser(input: RegisterInput): Promise<User> {
  return request<User>("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function loginUser(identifier: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.set("username", identifier);
  body.set("password", password);

  return request<TokenResponse>("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

export function getMe(token: string): Promise<User> {
  return request<User>("/api/users/me", { token });
}

export type ContactInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export function submitContact(input: ContactInput): Promise<ContactMessage> {
  return request<ContactMessage>("/api/contact/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function getAiStatus(): Promise<AiStatus> {
  return request<AiStatus>("/api/ai/status");
}

export function listScans(token: string): Promise<Scan[]> {
  return request<Scan[]>("/api/scans/", { token });
}

export function createScan(token: string, file: File): Promise<Scan> {
  const form = new FormData();
  form.append("file", file);

  return request<Scan>("/api/scans/", {
    method: "POST",
    body: form,
    token,
  });
}

export function estimateField(token: string, file: File): Promise<any> {
  const form = new FormData();
  form.append("file", file);

  return request<any>("/api/estimate-field/", {
    method: "POST",
    body: form,
    token,
  });
}
