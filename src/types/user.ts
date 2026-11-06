export interface UserDto {
  id: number;
  name: string;
  email: string;
  enrolledCourseIds: number[];
}

export interface LoginResponseDto {
  accessToken: string;
  expiresIn: number;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface RegisterRequestDto extends LoginRequestDto {
  name: string;
  confirmPassword: string;
}
