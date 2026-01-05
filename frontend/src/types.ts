export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type User = {
  id: number;
  email: string;
  username: string;
  full_name?: string | null;
  is_active: boolean;
  created_at: string;
};

export type ContactMessage = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
};

export type AiStatus = {
  available: boolean;
  model_path: string;
  reason?: string;
};

export type Scan = {
  id: number;
  image_filename: string;
  image_url: string;
  result: any;
  created_at: string;
};
