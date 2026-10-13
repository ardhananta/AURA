export interface User {
  uid: string;
  email: string;
  name: string;
  lastLoginAt?: string;
  createdAt?: string;
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
