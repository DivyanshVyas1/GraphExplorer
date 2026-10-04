package routes

import (
	"lemici-backend/controllers"

	"github.com/gin-gonic/gin"
)

func SetupDraftRoutes(r *gin.Engine) {
	draftsGroup := r.Group("/api/drafts")
	{
		draftsGroup.POST("/", controllers.CreateDraft)
		draftsGroup.GET("/", controllers.GetDrafts)
		draftsGroup.GET("/:id", controllers.GetDraftByID)
		draftsGroup.PUT("/:id", controllers.UpdateDraft)
		draftsGroup.DELETE("/:id", controllers.DeleteDraft)
	}
}
