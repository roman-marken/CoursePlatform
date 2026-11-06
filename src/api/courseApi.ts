import { axiosInstance } from './axiosInstance';
import type { CourseDto, EnrollmentRequestDto, EnrollmentResponseDto } from '../types/course';

export async function getCourses(signal?: AbortSignal): Promise<CourseDto[]> {
  const response = await axiosInstance.get<CourseDto[]>('/courses', { signal });
  return response.data;
}

export async function getCourse(id: number, signal?: AbortSignal): Promise<CourseDto> {
  const response = await axiosInstance.get<CourseDto>(`/courses/${id}`, { signal });
  return response.data;
}

export async function enrollInCourse(request: EnrollmentRequestDto): Promise<EnrollmentResponseDto> {
  const response = await axiosInstance.post<EnrollmentResponseDto>('/enrollments', request);
  return response.data;
}
