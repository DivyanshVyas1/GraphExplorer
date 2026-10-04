package controllers

import (
	"fmt"
	"lemici-backend/config"
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	nebula "github.com/vesoft-inc/nebula-go/v3"
)

func getSession() (*nebula.Session, error) {
	username := os.Getenv("NEBULA_USER")
	password := os.Getenv("NEBULA_PASSWORD")

	if username == "" || password == "" {
		return nil, fmt.Errorf("NEBULA_USER or NEBULA_PASSWORD is not set in environment")
	}

	return config.Pool.GetSession(username, password)
}

// GetSpaces fetches the list of spaces with their node/edge counts
func GetSpaces(c *gin.Context) {
	session, err := getSession()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to GraphD session"})
		return
	}
	defer session.Release()

	// 1. Get all spaces
	resultSet, err := session.Execute("SHOW SPACES;")
	if err != nil || !resultSet.IsSucceed() {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch spaces"})
		return
	}

	var spaces []map[string]interface{}
	rowSize := resultSet.GetRowSize()

	for i := 0; i < rowSize; i++ {
		record, _ := resultSet.GetRowValuesByIndex(i)
		spaceVal, _ := record.GetValueByIndex(0)
		spaceName, _ := spaceVal.AsString()

		// Fetch stats for this space
		nodes := "0"
		edges := "0"

		useQ := fmt.Sprintf("USE `%s`;", spaceName)
		session.Execute(useQ)
		statsRes, err := session.Execute("SHOW STATS;")

		if err == nil && statsRes.IsSucceed() && statsRes.GetRowSize() > 0 {
			for j := 0; j < statsRes.GetRowSize(); j++ {
				sRecord, _ := statsRes.GetRowValuesByIndex(j)
				sTypeVal, _ := sRecord.GetValueByIndex(0)
				sNameVal, _ := sRecord.GetValueByIndex(1)
				sCountVal, _ := sRecord.GetValueByIndex(2)

				sType, _ := sTypeVal.AsString()
				sName, _ := sNameVal.AsString()
				sCount, _ := sCountVal.AsInt()

				if sType == "Space" {
					if sName == "vertices" {
						nodes = strconv.FormatInt(sCount, 10)
					} else if sName == "edges" {
						edges = strconv.FormatInt(sCount, 10)
					}
				}
			}
		}
		// Note: SUBMIT JOB STATS is triggered via GetSpaceAnalytics, not here

		spaces = append(spaces, map[string]interface{}{
			"id":       spaceName,
			"name":     spaceName,
			"nodes":    nodes,
			"edges":    edges,
			"isActive": true,
		})
	}

	c.JSON(http.StatusOK, spaces)
}

// GetSpaceAnalytics fetches detailed breakdown of tags and edges for a specific space
func GetSpaceAnalytics(c *gin.Context) {
	spaceName := c.Param("space")
	
	session, err := getSession()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Session error"})
		return
	}
	defer session.Release()

	// Switch to requested space
	useQ := fmt.Sprintf("USE `%s`;", spaceName)
	useRes, err := session.Execute(useQ)
	if err != nil || !useRes.IsSucceed() {
		c.JSON(http.StatusNotFound, gin.H{"error": "Space not found or access denied"})
		return
	}

	// Get Stats — SHOW STATS only works after SUBMIT JOB STATS has been run
	statsRes, statsErr := session.Execute("SHOW STATS;")

	if statsErr != nil || !statsRes.IsSucceed() || statsRes.GetRowSize() == 0 {
		// Stats not ready — submit the job now so next call has data
		session.Execute("SUBMIT JOB STATS;")

		// Return empty data with a note for the frontend
		c.JSON(http.StatusOK, gin.H{
			"space":      spaceName,
			"totalNodes": 0,
			"totalEdges": 0,
			"tags":       []map[string]interface{}{},
			"edgeTypes":  []map[string]interface{}{},
			"note":       "Stats job submitted. Refresh in a few seconds to see real numbers.",
		})
		return
	}

	totalNodes := int64(0)
	totalEdges := int64(0)
	tags := []map[string]interface{}{}
	edgeTypes := []map[string]interface{}{}

	for i := 0; i < statsRes.GetRowSize(); i++ {
		record, _ := statsRes.GetRowValuesByIndex(i)
		sTypeVal, _ := record.GetValueByIndex(0)
		sNameVal, _ := record.GetValueByIndex(1)
		sCountVal, _ := record.GetValueByIndex(2)
		
		sType, _ := sTypeVal.AsString()
		sName, _ := sNameVal.AsString()
		sCount, _ := sCountVal.AsInt()

		if sType == "Space" {
			if sName == "vertices" {
				totalNodes = sCount
			} else if sName == "edges" {
				totalEdges = sCount
			}
		} else if sType == "Tag" {
			tags = append(tags, map[string]interface{}{"name": sName, "count": sCount})
		} else if sType == "Edge" {
			edgeTypes = append(edgeTypes, map[string]interface{}{"name": sName, "count": sCount})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"space": spaceName,
		"totalNodes": totalNodes,
		"totalEdges": totalEdges,
		"tags": tags,
		"edgeTypes": edgeTypes,
	})
}

// GetSpaceSchema fetches full schema (tags + properties, edges + properties)
func GetSpaceSchema(c *gin.Context) {
	spaceName := c.Param("space")

	session, err := getSession()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Session error"})
		return
	}
	defer session.Release()

	useQ := fmt.Sprintf("USE `%s`;", spaceName)
	useRes, err := session.Execute(useQ)
	if err != nil || !useRes.IsSucceed() {
		c.JSON(http.StatusNotFound, gin.H{"error": "Space not found"})
		return
	}

	// Helper: fetch properties via DESCRIBE TAG/EDGE <name>
	getProps := func(descQuery string) []map[string]string {
		props := []map[string]string{}
		res, err := session.Execute(descQuery)
		if err != nil || !res.IsSucceed() {
			return props
		}
		for i := 0; i < res.GetRowSize(); i++ {
			row, _ := res.GetRowValuesByIndex(i)
			fieldVal, _ := row.GetValueByIndex(0)
			typeVal, _ := row.GetValueByIndex(1)
			fieldName, _ := fieldVal.AsString()
			fieldType, _ := typeVal.AsString()
			if fieldName != "" {
				props = append(props, map[string]string{
					"name": fieldName,
					"type": fieldType,
				})
			}
		}
		return props
	}

	// Fetch Tags with their properties
	type TagSchema struct {
		Name       string              `json:"name"`
		Properties []map[string]string `json:"properties"`
	}
	tags := []TagSchema{}

	tagsRes, err := session.Execute("SHOW TAGS;")
	if err == nil && tagsRes.IsSucceed() {
		for i := 0; i < tagsRes.GetRowSize(); i++ {
			row, _ := tagsRes.GetRowValuesByIndex(i)
			val, _ := row.GetValueByIndex(0)
			name, _ := val.AsString()
			props := getProps(fmt.Sprintf("DESCRIBE TAG `%s`;", name))
			tags = append(tags, TagSchema{Name: name, Properties: props})
		}
	}

	// Fetch Edge Types with their properties
	type EdgeSchema struct {
		Name       string              `json:"name"`
		Properties []map[string]string `json:"properties"`
	}
	edgeTypes := []EdgeSchema{}

	edgesRes, err := session.Execute("SHOW EDGES;")
	if err == nil && edgesRes.IsSucceed() {
		for i := 0; i < edgesRes.GetRowSize(); i++ {
			row, _ := edgesRes.GetRowValuesByIndex(i)
			val, _ := row.GetValueByIndex(0)
			name, _ := val.AsString()
			props := getProps(fmt.Sprintf("DESCRIBE EDGE `%s`;", name))
			edgeTypes = append(edgeTypes, EdgeSchema{Name: name, Properties: props})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"space":     spaceName,
		"tags":      tags,
		"edgeTypes": edgeTypes,
	})
}
