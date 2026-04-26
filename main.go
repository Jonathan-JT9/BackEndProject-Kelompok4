package main

import (
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"student-profile-backend/handlers"
	"student-profile-backend/middleware"
)

func main() {
	// 1. Load environment variables dari file .env
	_ = godotenv.Load()

	// 2. Inisialisasi koneksi database MySQL
	db, err := handlers.NewDBFromEnv()
	if err != nil {
		log.Fatalf("failed to initialize database: %v", err)
	}
	defer db.Close()

	router := gin.Default()

	// 3. Konfigurasi CORS agar Frontend (Vite) bisa mengakses API
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// 4. Public Routes (Bisa diakses tanpa login/token)
	api := router.Group("/")
	{
		// Endpoint Login untuk mendapatkan JWT Token
		api.POST("/login", handlers.Login(db))

		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok"})
		})
	}

	// 5. Static Route untuk melayani file foto yang diunggah
	router.Static("/uploads", "./uploads")

	// 6. Private Routes (Wajib membawa JWT Token di Header)
	student := router.Group("/student")
	student.Use(middleware.AuthRequired())
	{
		student.GET("/profile", handlers.GetStudentProfile(db))
		student.POST("/update-photo", handlers.UpdateStudentPhoto(db))
		student.POST("/change-password", handlers.ChangePassword(db))
		student.POST("/grades", handlers.SaveSemesterGrade(db))
		student.GET("/grades", handlers.GetSemesterGrades(db))
	}

	// 7. Konfigurasi Port Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("server running at http://localhost:%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}
