package main

import (
	"log"
	"lemici-backend/config"
	"lemici-backend/hub"
	"lemici-backend/middleware"
	"lemici-backend/models"
	"lemici-backend/routes"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 1. .env file se credentials load karo
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ No .env file found, using default credentials")
	}

	// 2. Nebula GraphD se connection pool banao
	config.ConnectNebula()

	// 2.5 PostgreSQL se connect karo aur models migrate karo
	config.ConnectPostgres()
	if err := config.DB.AutoMigrate(&models.Draft{}); err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// 3. WebSocket Hub banao aur background mein start karo
	// Hub sabhi connected clients ko track karta hai
	wsHub := hub.NewHub()
	go wsHub.Run() // Goroutine mein chalao taaki main thread block na ho

	// 4. Gin router setup karo
	r := gin.Default()

	// 5. CORS middleware lagao (sabhi routes pe)
	r.Use(middleware.CORSMiddleware())

	// 6. REST API routes
	routes.SetupSpaceRoutes(r)
	routes.SetupDraftRoutes(r)

	// 7. WebSocket route (ws://localhost:8080/ws)
	routes.SetupWSRoutes(r, wsHub)

	log.Println("🚀 Server starting on :8080")
	r.Run(":8080")
}