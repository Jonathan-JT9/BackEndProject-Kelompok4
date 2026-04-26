import { useState } from "react";
import type { FormEvent } from "react";
import {
  changePassword,
  getSemesterGrades,
  getStudentProfile,
  saveSemesterGrade,
  uploadStudentPhoto,
  type GradeSummary,
  type SemesterGrade,
  type StudentProfile,
} from "./api";

export function App() {
  const [token, setToken] = useState("");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [semester, setSemester] = useState(1);
  const [course, setCourse] = useState("");
  const [score, setScore] = useState<number>(0);
  const [credits, setCredits] = useState<number>(3);
  const [grades, setGrades] = useState<SemesterGrade[]>([]);
  const [summary, setSummary] = useState<GradeSummary | null>(null);

  const loadProfile = async () => {
    setError("");
    setStatus("");
    try {
      const data = await getStudentProfile(token);
      setProfile(data);
      await loadGrades();
      setStatus("Profile loaded.");
    } catch (err) {
      console.error(err);
      setError("Gagal mengambil profile. Pastikan token JWT valid.");
    }
  };

  const loadGrades = async () => {
    try {
      const result = await getSemesterGrades(token);
      setGrades(result.grades);
      setSummary(result.summary);
    } catch (err) {
      console.error(err);
      setGrades([]);
      setSummary(null);
    }
  };

  const onPhotoUpload = async (event: FormEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    setError("");
    setStatus("");
    try {
      await uploadStudentPhoto(token, file);
      await loadProfile();
      setStatus("Foto profile berhasil diupdate.");
    } catch (err) {
      console.error(err);
      setError("Gagal upload foto.");
    }
  };

  const onChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("");
    try {
      await changePassword(token, oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setStatus("Password berhasil diubah.");
    } catch (err) {
      console.error(err);
      setError("Gagal mengubah password.");
    }
  };

  const onSaveGrade = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("");
    try {
      await saveSemesterGrade(token, { semester, course, score, credits });
      setCourse("");
      setScore(0);
      setCredits(3);
      await loadGrades();
      setStatus("Nilai semester berhasil disimpan.");
    } catch (err) {
      console.error(err);
      setError("Gagal menyimpan nilai semester.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-unklab-navy px-6 py-4 text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-bold text-unklab-gold">Unklab Student Profile</h1>
          <span className="rounded-full bg-unklab-gold px-4 py-1 text-sm font-semibold text-unklab-navy">
            FILKOM
          </span>
        </div>
      </nav>

      <main className="mx-auto grid max-w-5xl gap-6 p-6">
        <section className="rounded-xl bg-white p-5 shadow">
          <label className="mb-2 block text-sm font-semibold text-slate-700">JWT Token</label>
          <div className="flex gap-2">
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token dari login_account auth"
            />
            <button
              onClick={loadProfile}
              className="rounded bg-unklab-navy px-4 py-2 font-semibold text-white hover:bg-blue-900"
            >
              Load Profile
            </button>
          </div>
        </section>

        {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}
        {status && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">{status}</div>
        )}

        {profile && (
          <>
            <section className="grid gap-4 rounded-xl bg-white p-6 shadow md:grid-cols-[140px_1fr]">
              <div>
                <img
                  src={profile.photo_url ? `http://localhost:8080${profile.photo_url}` : "https://placehold.co/140x140"}
                  alt="Student profile"
                  className="h-36 w-36 rounded-full border-4 border-unklab-gold object-cover"
                />
                <label className="mt-3 inline-block cursor-pointer rounded bg-unklab-gold px-3 py-2 text-sm font-semibold text-unklab-navy">
                  Update Photo
                  <input type="file" className="hidden" accept="image/*" onInput={onPhotoUpload} />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileField label="Nama" value={`${profile.first_name} ${profile.last_name}`} />
                <ProfileField label="NIM" value={profile.nim} />
                <ProfileField label="Fakultas" value={profile.faculty || "FILKOM"} />
                <ProfileField label="GPA" value={String(profile.gpa ?? "-")} />
                <ProfileField label="Tinggi Badan" value={profile.height ? `${profile.height} cm` : "-"} />
                <ProfileField label="Email" value={profile.email} />
                <div className="sm:col-span-2">
                  <ProfileField label="Organizational Role (BEM FILKOM)" value={profile.organizational_role} />
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-bold text-unklab-navy">Change Password</h2>
              <form className="grid gap-3 sm:grid-cols-3" onSubmit={onChangePassword}>
                <input
                  type="password"
                  placeholder="Old password"
                  className="rounded border border-slate-300 px-3 py-2"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="New password"
                  className="rounded border border-slate-300 px-3 py-2"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button className="rounded bg-unklab-navy px-4 py-2 font-semibold text-white hover:bg-blue-900">
                  Change Password
                </button>
              </form>
            </section>

            <section className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-1 text-lg font-bold text-unklab-navy">Input Nilai Semester</h2>
              <p className="mb-4 text-sm text-slate-600">
                Isi 1 mata kuliah per sekali simpan. Contoh: Semester 1, Pemrograman Dasar, Nilai 88, SKS 3.
              </p>
              <form className="grid gap-3 md:grid-cols-5" onSubmit={onSaveGrade}>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Semester Ke-
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    placeholder="1 - 14"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Mata Kuliah
                  </label>
                  <input
                    placeholder="Contoh: Algoritma"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Nilai Angka
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0 - 100"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Jumlah SKS
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    placeholder="1 - 6"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={credits}
                    onChange={(e) => setCredits(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-end">
                  <button className="w-full rounded bg-unklab-gold px-4 py-2 font-semibold text-unklab-navy hover:bg-yellow-400">
                    Simpan Nilai
                  </button>
                </div>
              </form>

              <div className="mt-5 grid gap-3 md:grid-cols-5">
                <ProfileField label="Total Semester" value={String(summary?.total_semesters ?? 0)} />
                <ProfileField label="Total Mata Kuliah" value={String(summary?.total_courses ?? 0)} />
                <ProfileField label="Total SKS" value={String(summary?.total_credits ?? 0)} />
                <ProfileField
                  label="Rata-rata Nilai"
                  value={summary ? summary.average_score.toFixed(2) : "0.00"}
                />
                <ProfileField label="IPK Akhir" value={summary ? summary.final_gpa.toFixed(2) : "0.00"} />
              </div>

              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full bg-white text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Semester</th>
                      <th className="px-3 py-2 text-left">Mata Kuliah</th>
                      <th className="px-3 py-2 text-left">Nilai</th>
                      <th className="px-3 py-2 text-left">SKS</th>
                      <th className="px-3 py-2 text-left">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-slate-500" colSpan={5}>
                          Belum ada data nilai.
                        </td>
                      </tr>
                    ) : (
                      grades.map((g) => (
                        <tr key={g.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{g.semester}</td>
                          <td className="px-3 py-2">{g.course}</td>
                          <td className="px-3 py-2">{g.score}</td>
                          <td className="px-3 py-2">{g.credits}</td>
                          <td className="px-3 py-2 font-semibold text-unklab-navy">{g.grade_note}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
