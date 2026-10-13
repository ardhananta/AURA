export interface User {
  uid: string;
  email: string;
  name: string;
  usia?: number;
  tinggi_badan?: number;
  berat_badan?: number;
  waktu_di_jalan?: number;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  usia: number;
  tinggi_badan: number;
  berat_badan: number;
  waktu_di_jalan: number;
}

export interface UpdateProfilePayload {
  name?: string;
  usia?: number;
  tinggi_badan?: number;
  berat_badan?: number;
  waktu_di_jalan?: number;
}

export function isProfileComplete(user: User | null | undefined): boolean {
  if (!user) return false;
  return (
    typeof user.usia === 'number' &&
    user.usia >= 1 &&
    user.usia <= 150 &&
    typeof user.tinggi_badan === 'number' &&
    user.tinggi_badan >= 1 &&
    user.tinggi_badan <= 300 &&
    typeof user.berat_badan === 'number' &&
    user.berat_badan >= 1 &&
    user.berat_badan <= 500 &&
    typeof user.waktu_di_jalan === 'number' &&
    user.waktu_di_jalan >= 0 &&
    user.waktu_di_jalan <= 24
  );
}

export interface AuthTokens {
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponseData {
  user: User;
  tokens: AuthTokens;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
