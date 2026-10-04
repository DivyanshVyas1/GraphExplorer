package routes

import (
	"lemici-backend/controllers"
	"lemici-backend/hub"

	"github.com/gin-gonic/gin"
)

// SetupWSRoutes — WebSocket endpoint register karta hai
func SetupWSRoutes(router *gin.Engine, h *hub.Hub) {
	// ws://localhost:8080/ws — Frontend yahan connect karega
	router.GET("/ws", controllers.WSHandler(h))
}
