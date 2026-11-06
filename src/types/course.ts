export interface CourseDto {
  id: number;
  title: string;
  description: string;
  category: string;
  level: string;
  durationHours: number;
  lessonsCount: number;
  teacher: string;
}

export interface EnrollmentRequestDto {
  courseId: number;
}

export interface EnrollmentResponseDto {
  id: string;
  courseId: number;
  userId: number;
  enrolledAt: string;
}
