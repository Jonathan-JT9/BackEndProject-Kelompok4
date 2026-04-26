package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type StudentProfile struct {
	NIM                string   `json:"nim"`
	FirstName          string   `json:"first_name"`
	LastName           string   `json:"last_name"`
	Email              string   `json:"email"`
	Faculty            string   `json:"faculty"`
	GPA                *float64 `json:"gpa"`
	Height             *int     `json:"height"`
	OrganizationalRole string   `json:"organizational_role"`
	PhotoURL           string   `json:"photo_url"`
}

type SemesterGrade struct {
	ID        int64   `json:"id"`
	Semester  int     `json:"semester"`
	Course    string  `json:"course"`
	Score     float64 `json:"score"`
	Credits   int     `json:"credits"`
	GradeNote string  `json:"grade_note"`
}

type GradeSummary struct {
	TotalSemesters int     `json:"total_semesters"`
	TotalCourses   int     `json:"total_courses"`
	TotalCredits   int     `json:"total_credits"`
	AverageScore   float64 `json:"average_score"`
	FinalGPA       float64 `json:"final_gpa"`
}

func NewDBFromEnv() (*sql.DB, error) {
	cfg := mysql.Config{
		User:                 os.Getenv("DB_USER"),
		Passwd:               os.Getenv("DB_PASSWORD"),
		Net:                  "tcp",
		Addr:                 os.Getenv("DB_HOST") + ":" + os.Getenv("DB_PORT"),
		DBName:               os.Getenv("DB_NAME"),
		AllowNativePasswords: true,
		ParseTime:            true,
	}
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	if err := ensureAcademicTables(db); err != nil {
		return nil, err
	}
	return db, nil
}

func ensureAcademicTables(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS student_semester_grades (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			student_nim VARCHAR(50) NOT NULL,
			semester INT NOT NULL,
			course_name VARCHAR(150) NOT NULL,
			score DECIMAL(5,2) NOT NULL,
			credits INT NOT NULL,
			grade_note VARCHAR(3) NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	return err
}

func Login(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload struct {
			Username string `json:"username" binding:"required"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var loginID int64
		var hashedPassword string
		// PERBAIKAN: Menggunakan tabel 'student_accounts' sesuai Workbench
		err := db.QueryRow("SELECT id, password FROM student_accounts WHERE username = ? LIMIT 1", payload.Username).Scan(&loginID, &hashedPassword)
		if err != nil {
			log.Printf("Login Query Error: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "NIM atau Password salah"})
			return
		}

		if hashedPassword != payload.Password {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "NIM atau Password salah"})
			return
		}

		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			secret = "secret"
		}

		claims := jwt.MapClaims{
			"login_id": loginID,
			"exp":      time.Now().Add(24 * time.Hour).Unix(),
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, _ := token.SignedString([]byte(secret))

		c.JSON(http.StatusOK, gin.H{"message": "login successful", "token": tokenString})
	}
}

func GetStudentProfile(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		loginID, _ := c.Get("login_id")

		profile := StudentProfile{}
		// PERBAIKAN: Join tabel 'student_accounts' dan 'students' sesuai Workbench
		query := `
			SELECT s.nim, s.first_name, s.last_name, s.email, s.faculty, s.gpa, s.height, s.photo_url, s.is_bem_member
			FROM student_accounts sa
			JOIN students s ON s.nim = sa.username
			WHERE sa.id = ? LIMIT 1`

		var isBEM bool
		err := db.QueryRow(query, loginID).Scan(
			&profile.NIM, &profile.FirstName, &profile.LastName, &profile.Email,
			&profile.Faculty, &profile.GPA, &profile.Height, &profile.PhotoURL, &isBEM,
		)

		if err != nil {
			log.Printf("Profile Query Error: %v", err)
			c.JSON(http.StatusNotFound, gin.H{"error": "Data mahasiswa tidak ditemukan"})
			return
		}

		profile.OrganizationalRole = "Mahasiswa FILKOM"
		if isBEM {
			profile.OrganizationalRole = "President of BEM FILKOM 2024/2025"
		}

		c.JSON(http.StatusOK, gin.H{"data": profile})
	}
}
func UpdateStudentPhoto(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		loginID, _ := c.Get("login_id")
		file, err := c.FormFile("photo")
		if err != nil {
			c.JSON(400, gin.H{"error": "File foto diperlukan"})
			return
		}

		filename := fmt.Sprintf("%v_%d%s", loginID, time.Now().Unix(), filepath.Ext(file.Filename))
		path := filepath.Join("uploads", filename)

		if err := c.SaveUploadedFile(file, path); err != nil {
			c.JSON(500, gin.H{"error": "Gagal menyimpan file"})
			return
		}

		_, err = db.Exec("UPDATE students JOIN student_accounts sa ON sa.username = students.nim SET photo_url = ? WHERE sa.id = ?", "/"+path, loginID)
		if err != nil {
			c.JSON(500, gin.H{"error": "Gagal update database"})
			return
		}

		c.JSON(200, gin.H{"message": "Foto berhasil diperbarui", "url": "/" + path})
	}
}

func ChangePassword(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		loginID, _ := c.Get("login_id")
		var input struct {
			OldPassword string `json:"old_password" binding:"required"`
			NewPassword string `json:"new_password" binding:"required,min=6"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Input tidak valid"})
			return
		}

		var currentHash string
		err := db.QueryRow("SELECT password FROM student_accounts WHERE id = ?", loginID).Scan(&currentHash)
		if err != nil {
			c.JSON(500, gin.H{"error": "User tidak ditemukan"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(input.OldPassword)); err != nil {
			c.JSON(401, gin.H{"error": "Password lama salah"})
			return
		}

		newHash, _ := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
		db.Exec("UPDATE student_accounts SET password = ? WHERE id = ?", string(newHash), loginID)

		c.JSON(200, gin.H{"message": "Password berhasil diganti"})
	}
}

func SaveSemesterGrade(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		loginID, _ := c.Get("login_id")
		var payload struct {
			Semester int     `json:"semester" binding:"required,min=1,max=14"`
			Course   string  `json:"course" binding:"required"`
			Score    float64 `json:"score" binding:"required,min=0,max=100"`
			Credits  int     `json:"credits" binding:"required,min=1,max=6"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var nim string
		err := db.QueryRow("SELECT username FROM student_accounts WHERE id = ?", loginID).Scan(&nim)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menemukan akun mahasiswa"})
			return
		}

		note := scoreToNote(payload.Score)
		_, err = db.Exec(`
			INSERT INTO student_semester_grades (student_nim, semester, course_name, score, credits, grade_note)
			VALUES (?, ?, ?, ?, ?, ?)
		`, nim, payload.Semester, payload.Course, payload.Score, payload.Credits, note)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan nilai: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Nilai berhasil disimpan"})
	}
}

func GetSemesterGrades(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		loginID, _ := c.Get("login_id")

		var nim string
		err := db.QueryRow("SELECT username FROM student_accounts WHERE id = ?", loginID).Scan(&nim)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menemukan akun mahasiswa"})
			return
		}

		rows, err := db.Query(`
			SELECT id, semester, course_name, score, credits, grade_note
			FROM student_semester_grades
			WHERE student_nim = ?
			ORDER BY semester ASC, id ASC
		`, nim)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil nilai: " + err.Error()})
			return
		}
		defer rows.Close()

		grades := make([]SemesterGrade, 0)
		for rows.Next() {
			var g SemesterGrade
			if err := rows.Scan(&g.ID, &g.Semester, &g.Course, &g.Score, &g.Credits, &g.GradeNote); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses nilai"})
				return
			}
			grades = append(grades, g)
		}

		summary := buildGradeSummary(grades)
		c.JSON(http.StatusOK, gin.H{
			"grades":   grades,
			"summary":  summary,
			"semester": summary.TotalSemesters,
		})
	}
}

func buildGradeSummary(grades []SemesterGrade) GradeSummary {
	if len(grades) == 0 {
		return GradeSummary{}
	}

	totalScore := 0.0
	totalCredits := 0
	totalWeightedGPA := 0.0
	semesterSet := map[int]struct{}{}

	for _, g := range grades {
		totalScore += g.Score
		totalCredits += g.Credits
		totalWeightedGPA += scoreToGPA(g.Score) * float64(g.Credits)
		semesterSet[g.Semester] = struct{}{}
	}

	semesters := make([]int, 0, len(semesterSet))
	for sem := range semesterSet {
		semesters = append(semesters, sem)
	}
	sort.Ints(semesters)

	finalGPA := 0.0
	if totalCredits > 0 {
		finalGPA = totalWeightedGPA / float64(totalCredits)
	}

	return GradeSummary{
		TotalSemesters: len(semesters),
		TotalCourses:   len(grades),
		TotalCredits:   totalCredits,
		AverageScore:   totalScore / float64(len(grades)),
		FinalGPA:       finalGPA,
	}
}

func scoreToGPA(score float64) float64 {
	switch {
	case score >= 85:
		return 4.0
	case score >= 80:
		return 3.7
	case score >= 75:
		return 3.3
	case score >= 70:
		return 3.0
	case score >= 65:
		return 2.7
	case score >= 60:
		return 2.3
	case score >= 55:
		return 2.0
	case score >= 45:
		return 1.0
	default:
		return 0
	}
}

func scoreToNote(score float64) string {
	switch {
	case score >= 85:
		return "A"
	case score >= 80:
		return "A-"
	case score >= 75:
		return "B+"
	case score >= 70:
		return "B"
	case score >= 65:
		return "B-"
	case score >= 60:
		return "C+"
	case score >= 55:
		return "C"
	case score >= 45:
		return "D"
	default:
		return "E"
	}
}
