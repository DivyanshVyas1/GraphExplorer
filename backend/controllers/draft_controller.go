package controllers

import (
	"net/http"
	"lemici-backend/config"
	"lemici-backend/models"

	"github.com/gin-gonic/gin"
)

// CreateDraft creates a new schema draft
func CreateDraft(c *gin.Context) {
	var draft models.Draft
	if err := c.ShouldBindJSON(&draft); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := config.DB.Create(&draft).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create draft"})
		return
	}

	c.JSON(http.StatusCreated, draft)
}

// GetDrafts retrieves all drafts
func GetDrafts(c *gin.Context) {
	var drafts []models.Draft
	// Fetch ordered by updated time descending
	if err := config.DB.Order("updated_at desc").Find(&drafts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch drafts"})
		return
	}
	c.JSON(http.StatusOK, drafts)
}

// GetDraftByID retrieves a specific draft
func GetDraftByID(c *gin.Context) {
	id := c.Param("id")
	var draft models.Draft

	if err := config.DB.First(&draft, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Draft not found"})
		return
	}

	c.JSON(http.StatusOK, draft)
}

// UpdateDraft updates an existing draft
func UpdateDraft(c *gin.Context) {
	id := c.Param("id")
	var draft models.Draft

	if err := config.DB.First(&draft, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Draft not found"})
		return
	}

	var updateData models.Draft
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	draft.Name = updateData.Name
	draft.Space = updateData.Space
	draft.Nodes = updateData.Nodes
	draft.Edges = updateData.Edges

	if err := config.DB.Save(&draft).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update draft"})
		return
	}

	c.JSON(http.StatusOK, draft)
}

// DeleteDraft deletes a draft
func DeleteDraft(c *gin.Context) {
	id := c.Param("id")
	if err := config.DB.Delete(&models.Draft{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete draft"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Draft deleted successfully"})
}
