import axios from "axios";

const API_BASE = "http://localhost:8080";

export const apiClient = axios.create({
  baseURL: API_BASE,
});

export type StudentProfile = {
  nim: string;
  first_name: string;
  last_name: string;
  email: string;
  faculty: string;
  gpa?: number;
  height?: number;
  organizational_role: string;
  photo_url: string;
};

export type SemesterGrade = {
  id: number;
  semester: number;
  course: string;
  score: number;
  credits: number;
  grade_note: string;
};

export type GradeSummary = {
  total_semesters: number;
  total_courses: number;
  total_credits: number;
  average_score: number;
  final_gpa: number;
};

export async function getStudentProfile(token: string) {
  const response = await apiClient.get<{ data: StudentProfile }>("/student/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.data;
}

export async function uploadStudentPhoto(token: string, file: File) {
  const formData = new FormData();
  formData.append("photo", file);

  return apiClient.post("/student/update-photo", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
}

export async function changePassword(token: string, oldPassword: string, newPassword: string) {
  return apiClient.post(
    "/student/change-password",
    { old_password: oldPassword, new_password: newPassword },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function saveSemesterGrade(
  token: string,
  payload: { semester: number; course: string; score: number; credits: number },
) {
  return apiClient.post("/student/grades", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getSemesterGrades(token: string) {
  const response = await apiClient.get<{ grades: SemesterGrade[]; summary: GradeSummary }>("/student/grades", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}
