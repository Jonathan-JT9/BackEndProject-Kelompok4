import { useEffect, useMemo, useState } from "react";
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
  type ScheduleItem = {
    id: number;
    day: string;
    time: string;
    course: string;
    room: string;
    lecturer: string;
  };

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
  const [showReport, setShowReport] = useState(false);
  const [showCourseTotal, setShowCourseTotal] = useState(false);
  const [courseQuery, setCourseQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState<number | "all">("all");
  const [sortBy, setSortBy] = useState<"semester-asc" | "semester-desc" | "score-desc" | "score-asc">(
    "semester-asc",
  );
  const [activeMenu, setActiveMenu] = useState<"profile" | "create-schedule" | "view-schedule">("profile");
  const [scheduleDay, setScheduleDay] = useState("Senin");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleCourse, setScheduleCourse] = useState("");
  const [scheduleRoom, setScheduleRoom] = useState("");
  const [scheduleLecturer, setScheduleLecturer] = useState("");
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("student_schedules");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ScheduleItem[];
      setSchedules(parsed);
    } catch (err) {
      console.error(err);
      localStorage.removeItem("student_schedules");
    }
  }, []);

  const persistSchedules = (items: ScheduleItem[]) => {
    setSchedules(items);
    localStorage.setItem("student_schedules", JSON.stringify(items));
  };

  const loadProfile = async () => {
    setError("");
    setStatus("");
    try {
      const data = await getStudentProfile(token);
      setProfile(data);
      await loadGrades();
      setShowReport(false);
      setShowCourseTotal(false);
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
      setShowReport(true);
      setShowCourseTotal(true);
      setStatus("Nilai semester berhasil disimpan.");
    } catch (err) {
      console.error(err);
      setError("Gagal menyimpan nilai semester.");
    }
  };

  const availableSemesters = useMemo(() => {
    return [...new Set(grades.map((g) => g.semester))].sort((a, b) => a - b);
  }, [grades]);

  const filteredGrades = useMemo(() => {
    const query = courseQuery.trim().toLowerCase();
    let next = grades.filter((g) => {
      const matchesCourse = !query || g.course.toLowerCase().includes(query);
      const matchesSemester = semesterFilter === "all" || g.semester === semesterFilter;
      return matchesCourse && matchesSemester;
    });

    if (sortBy === "semester-asc") next = [...next].sort((a, b) => a.semester - b.semester);
    if (sortBy === "semester-desc") next = [...next].sort((a, b) => b.semester - a.semester);
    if (sortBy === "score-desc") next = [...next].sort((a, b) => b.score - a.score);
    if (sortBy === "score-asc") next = [...next].sort((a, b) => a.score - b.score);
    return next;
  }, [grades, courseQuery, semesterFilter, sortBy]);

  const topGrade = filteredGrades.length > 0 ? filteredGrades.reduce((best, item) => (item.score > best.score ? item : best)) : null;
  const lowGrade = filteredGrades.length > 0 ? filteredGrades.reduce((worst, item) => (item.score < worst.score ? item : worst)) : null;

  const exportReportCsv = () => {
    if (filteredGrades.length === 0) {
      setStatus("Tidak ada data raport untuk diexport.");
      return;
    }

    const rows = [
      ["Semester", "Mata Kuliah", "Nilai", "SKS", "Grade"],
      ...filteredGrades.map((g) => [String(g.semester), g.course, String(g.score), String(g.credits), g.grade_note]),
    ];

    const csvContent = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "raport-mahasiswa.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus("Raport berhasil diexport ke CSV.");
  };

  const onCreateSchedule = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!scheduleTime || !scheduleCourse || !scheduleRoom || !scheduleLecturer) {
      setError("Lengkapi semua field jadwal terlebih dahulu.");
      return;
    }

    const newItem: ScheduleItem = {
      id: Date.now(),
      day: scheduleDay,
      time: scheduleTime,
      course: scheduleCourse,
      room: scheduleRoom,
      lecturer: scheduleLecturer,
    };

    const next = [...schedules, newItem];
    persistSchedules(next);
    setScheduleTime("");
    setScheduleCourse("");
    setScheduleRoom("");
    setScheduleLecturer("");
    setStatus("Jadwal berhasil dibuat.");
    setActiveMenu("view-schedule");
  };

  const onDeleteSchedule = (id: number) => {
    const next = schedules.filter((item) => item.id !== id);
    persistSchedules(next);
    setStatus("Jadwal berhasil dihapus.");
  };

  const sortedSchedules = useMemo(() => {
    const dayOrder: Record<string, number> = {
      Senin: 1,
      Selasa: 2,
      Rabu: 3,
      Kamis: 4,
      Jumat: 5,
      Sabtu: 6,
    };
    return [...schedules].sort((a, b) => {
      const dayDiff = (dayOrder[a.day] ?? 99) - (dayOrder[b.day] ?? 99);
      if (dayDiff !== 0) return dayDiff;
      return a.time.localeCompare(b.time);
    });
  }, [schedules]);
  const isAuthenticated = token.trim().length > 0 && profile !== null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100">
      <div className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-amber-300/35 blur-3xl floating-blob" />
      <div className="pointer-events-none absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-blue-300/25 blur-3xl floating-blob-delayed" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-purple-300/20 blur-3xl floating-blob" />
      <nav className="bg-unklab-navy px-6 py-4 text-white shadow-md">
        <div className="mx-auto grid max-w-5xl gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-unklab-gold">FILKOM Student Profile</h1>
            <span className="rounded-full bg-unklab-gold px-4 py-1 text-sm font-semibold text-unklab-navy">
              FILKOM
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveMenu("profile")}
              className={`rounded px-4 py-2 text-sm font-semibold ${
                activeMenu === "profile" ? "bg-unklab-gold text-unklab-navy" : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveMenu("create-schedule")}
              className={`rounded px-4 py-2 text-sm font-semibold ${
                activeMenu === "create-schedule" ? "bg-unklab-gold text-unklab-navy" : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              Buat Jadwal
            </button>
            <button
              type="button"
              onClick={() => setActiveMenu("view-schedule")}
              className={`rounded px-4 py-2 text-sm font-semibold ${
                activeMenu === "view-schedule" ? "bg-unklab-gold text-unklab-navy" : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              Lihat Jadwal
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto grid max-w-5xl gap-6 p-6">
        {activeMenu === "profile" && (
        <section className="animate-fade-in rounded-xl bg-white p-5 shadow">
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
              className="fancy-button rounded bg-unklab-navy px-4 py-2 font-semibold text-white hover:bg-blue-900"
            >
              Load Profile
            </button>
          </div>
        </section>
        )}

        {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}
        {status && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">{status}</div>
        )}

        {activeMenu === "profile" && profile && (
          <>
            <section className="animate-fade-in grid gap-4 rounded-xl bg-white p-6 shadow md:grid-cols-[140px_1fr]">
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

            <section className="animate-fade-in rounded-xl bg-white p-6 shadow">
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
                <button className="fancy-button rounded bg-unklab-navy px-4 py-2 font-semibold text-white hover:bg-blue-900">
                  Change Password
                </button>
              </form>
            </section>

            <section className="animate-fade-in rounded-xl bg-white p-6 shadow">
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
                  <button className="fancy-button w-full rounded bg-unklab-gold px-4 py-2 font-semibold text-unklab-navy hover:bg-yellow-400">
                    Simpan Nilai
                  </button>
                </div>
              </form>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowReport((prev) => !prev)}
                  className="fancy-button rounded bg-unklab-navy px-4 py-2 font-semibold text-white hover:bg-blue-900"
                >
                  {showReport ? "Sembunyikan Raport" : "Tampilkan Raport"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCourseTotal((prev) => !prev)}
                  className="fancy-button rounded bg-unklab-gold px-4 py-2 font-semibold text-unklab-navy hover:bg-yellow-400"
                >
                  {showCourseTotal ? "Sembunyikan Total Mata Kuliah" : "Tampilkan Total Mata Kuliah"}
                </button>
              </div>

              {showCourseTotal && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-slate-700">
                    Total semua mata kuliah yang sudah diinput:{" "}
                    <span className="font-bold text-unklab-navy">
                      {summary?.total_courses ?? grades.length} mata kuliah
                    </span>
                  </p>
                </div>
              )}

              {showReport && (
                <>
                  <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                    <input
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Cari mata kuliah..."
                      value={courseQuery}
                      onChange={(e) => setCourseQuery(e.target.value)}
                    />
                    <select
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      value={semesterFilter}
                      onChange={(e) =>
                        setSemesterFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                      }
                    >
                      <option value="all">Semua Semester</option>
                      {availableSemesters.map((s) => (
                        <option key={s} value={s}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    >
                      <option value="semester-asc">Urut Semester (Naik)</option>
                      <option value="semester-desc">Urut Semester (Turun)</option>
                      <option value="score-desc">Nilai Tertinggi Dulu</option>
                      <option value="score-asc">Nilai Terendah Dulu</option>
                    </select>
                    <button
                      type="button"
                      onClick={exportReportCsv}
                      className="fancy-button rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Export Raport CSV
                    </button>
                  </div>

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

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <ProfileField label="Data Ditampilkan" value={String(filteredGrades.length)} />
                    <ProfileField
                      label="Nilai Tertinggi"
                      value={topGrade ? `${topGrade.course} (${topGrade.score})` : "-"}
                    />
                    <ProfileField
                      label="Nilai Terendah"
                      value={lowGrade ? `${lowGrade.course} (${lowGrade.score})` : "-"}
                    />
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
                        {filteredGrades.length === 0 ? (
                          <tr>
                            <td className="px-3 py-3 text-slate-500" colSpan={5}>
                              Tidak ada data nilai yang cocok dengan filter.
                            </td>
                          </tr>
                        ) : (
                          filteredGrades.map((g) => (
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
                </>
              )}
            </section>
          </>
        )}

        {activeMenu === "create-schedule" && (
          <section className="animate-fade-in rounded-xl bg-white p-6 shadow">
            <h2 className="mb-1 text-lg font-bold text-unklab-navy">Buat Jadwal Kuliah</h2>
            {!isAuthenticated ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                Untuk membuat jadwal, silakan login dulu menggunakan JWT token di menu Profile lalu klik Load Profile.
              </div>
            ) : (
              <>
            <p className="mb-4 text-sm text-slate-600">
              Isi jadwal per mata kuliah. Setelah disimpan, jadwal bisa dilihat di menu Lihat Jadwal.
            </p>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreateSchedule}>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Hari</label>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={scheduleDay}
                  onChange={(e) => setScheduleDay(e.target.value)}
                >
                  <option>Senin</option>
                  <option>Selasa</option>
                  <option>Rabu</option>
                  <option>Kamis</option>
                  <option>Jumat</option>
                  <option>Sabtu</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Jam</label>
                <input
                  type="time"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Mata Kuliah
                </label>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  placeholder="Contoh: Basis Data"
                  value={scheduleCourse}
                  onChange={(e) => setScheduleCourse(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Ruangan</label>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  placeholder="Contoh: Lab 2"
                  value={scheduleRoom}
                  onChange={(e) => setScheduleRoom(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Dosen Pengampu
                </label>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  placeholder="Contoh: Dr. Maria"
                  value={scheduleLecturer}
                  onChange={(e) => setScheduleLecturer(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <button className="fancy-button rounded bg-unklab-gold px-4 py-2 font-semibold text-unklab-navy hover:bg-yellow-400">
                  Simpan Jadwal
                </button>
              </div>
            </form>
              </>
            )}
          </section>
        )}

        {activeMenu === "view-schedule" && (
          <section className="animate-fade-in rounded-xl bg-white p-6 shadow">
            <h2 className="mb-1 text-lg font-bold text-unklab-navy">Lihat Jadwal Mahasiswa</h2>
            {!isAuthenticated ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                Untuk melihat jadwal, silakan login dulu menggunakan JWT token di menu Profile lalu klik Load Profile.
              </div>
            ) : (
              <>
            <p className="mb-4 text-sm text-slate-600">Jadwal ditampilkan berdasarkan hari dan jam.</p>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full bg-white text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Hari</th>
                    <th className="px-3 py-2 text-left">Jam</th>
                    <th className="px-3 py-2 text-left">Mata Kuliah</th>
                    <th className="px-3 py-2 text-left">Ruangan</th>
                    <th className="px-3 py-2 text-left">Dosen</th>
                    <th className="px-3 py-2 text-left">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSchedules.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-500" colSpan={6}>
                        Belum ada jadwal. Silakan buat jadwal dulu di menu Buat Jadwal.
                      </td>
                    </tr>
                  ) : (
                    sortedSchedules.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{item.day}</td>
                        <td className="px-3 py-2">{item.time}</td>
                        <td className="px-3 py-2">{item.course}</td>
                        <td className="px-3 py-2">{item.room}</td>
                        <td className="px-3 py-2">{item.lecturer}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => onDeleteSchedule(item.id)}
                            className="rounded bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-card rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
