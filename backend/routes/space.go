package routes

import (
	"lemici-backend/controllers"

	"github.com/gin-gonic/gin"
)

// SetupRoutes handles all space related endpoints
func SetupSpaceRoutes(router *gin.Engine) {
	spaceGroup := router.Group("/api/spaces")
	{
		spaceGroup.GET("/", controllers.GetSpaces)
		spaceGroup.GET("", controllers.GetSpaces) // No trailing slash version
		spaceGroup.GET("/:space/analytics", controllers.GetSpaceAnalytics)
		spaceGroup.GET("/:space/schema", controllers.GetSpaceSchema)
	}
}