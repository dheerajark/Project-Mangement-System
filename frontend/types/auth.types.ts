export interface RegisterDto {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
}

export interface LoginDto {
  email: string;
  password?: string;
}

export interface AcceptInviteDto {
  token: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}
