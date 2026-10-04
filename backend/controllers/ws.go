package controllers

import (
	"encoding/json"
	"fmt"
	"lemici-backend/hub"
	"lemici-backend/models"
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	nebula "github.com/vesoft-inc/nebula-go/v3"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func WSHandler(h *hub.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}
		client := &hub.Client{Conn: conn, Send: make(chan []byte, 256)}
		h.Register <- client
		log.Println("✅ New WebSocket client connected")
		defer func() {
			h.Unregister <- client
			conn.Close()
		}()

		for {
			_, rawMsg, err := conn.ReadMessage()
			if err != nil {
				break
			}
			var incoming models.WSIncoming
			if err := json.Unmarshal(rawMsg, &incoming); err != nil {
				sendError(client, models.WSHeader{}, "Invalid JSON format")
				continue
			}
			switch incoming.Body.MsgType {
			case "ngql":
				handleNGQL(client, incoming)
			case "batch_ngql":
				handleBatchNGQL(client, incoming)
			case "get_schema":
				handleGetSchema(client, incoming)
			default:
				sendError(client, incoming.Header, fmt.Sprintf("Unknown msgType: '%s'", incoming.Body.MsgType))
			}
		}
	}
}

func handleNGQL(client *hub.Client, incoming models.WSIncoming) {
	contentBytes, _ := json.Marshal(incoming.Body.Content)
	var content models.NGQLContent
	if err := json.Unmarshal(contentBytes, &content); err != nil || content.GQL == "" {
		sendError(client, incoming.Header, "Invalid ngql content. Required: {space, gql}")
		return
	}
	result := executeOne(content.Space, content.GQL)
	sendJSON(client, models.WSResponse{
		Header:  incoming.Header,
		Type:    "result",
		Results: []models.WSQueryResult{result},
	})
}

func handleBatchNGQL(client *hub.Client, incoming models.WSIncoming) {
	contentBytes, _ := json.Marshal(incoming.Body.Content)
	var content models.BatchNGQLContent
	if err := json.Unmarshal(contentBytes, &content); err != nil || len(content.GQLs) == 0 {
		sendError(client, incoming.Header, "Invalid batch_ngql content. Required: {space, gqls: []}")
		return
	}
	session, err := getSession()
	if err != nil {
		sendError(client, incoming.Header, fmt.Sprintf("Session error: %v", err))
		return
	}
	defer session.Release()

	if content.Space != "" {
		if _, err := session.Execute(fmt.Sprintf("USE `%s`;", content.Space)); err != nil {
			sendError(client, incoming.Header, fmt.Sprintf("Cannot switch to space '%s'", content.Space))
			return
		}
	}

	var results []models.WSQueryResult
	for _, gql := range content.GQLs {
		results = append(results, executeWithSession(session, gql))
	}
	sendJSON(client, models.WSResponse{
		Header:  incoming.Header,
		Type:    "result",
		Results: results,
	})
}

// handleGetSchema — fetches full space schema (tags+props, edges+props) via WebSocket
func handleGetSchema(client *hub.Client, incoming models.WSIncoming) {
	contentBytes, _ := json.Marshal(incoming.Body.Content)
	var content models.NGQLContent
	if err := json.Unmarshal(contentBytes, &content); err != nil || content.Space == "" {
		sendError(client, incoming.Header, "get_schema requires {space: \"spaceName\"}")
		return
	}

	type PropDef struct {
		Name string `json:"name"`
		Type string `json:"type"`
	}
	type TagDef struct {
		Name       string    `json:"name"`
		Properties []PropDef `json:"properties"`
	}
	type EdgeDef struct {
		Name       string    `json:"name"`
		Properties []PropDef `json:"properties"`
	}

	asStr := func(val *nebula.ValueWrapper) string {
		if s, err := val.AsString(); err == nil {
			return s
		}
		return val.String()
	}

	describeItems := func(session *nebula.Session, names []string, kind string) interface{} {
		if kind == "tag" {
			result := make([]TagDef, 0, len(names))
			for _, name := range names {
				var props []PropDef
				if res, err := session.Execute(fmt.Sprintf("DESCRIBE TAG `%s`;", name)); err == nil && res.IsSucceed() {
					for j := 0; j < res.GetRowSize(); j++ {
						row, _ := res.GetRowValuesByIndex(j)
						f, _ := row.GetValueByIndex(0)
						t, _ := row.GetValueByIndex(1)
						props = append(props, PropDef{Name: asStr(f), Type: asStr(t)})
					}
				}
				if props == nil {
					props = []PropDef{}
				}
				result = append(result, TagDef{Name: name, Properties: props})
			}
			return result
		}
		// edge
		result := make([]EdgeDef, 0, len(names))
		for _, name := range names {
			var props []PropDef
			if res, err := session.Execute(fmt.Sprintf("DESCRIBE EDGE `%s`;", name)); err == nil && res.IsSucceed() {
				for j := 0; j < res.GetRowSize(); j++ {
					row, _ := res.GetRowValuesByIndex(j)
					f, _ := row.GetValueByIndex(0)
					t, _ := row.GetValueByIndex(1)
					props = append(props, PropDef{Name: asStr(f), Type: asStr(t)})
				}
			}
			if props == nil {
				props = []PropDef{}
			}
			result = append(result, EdgeDef{Name: name, Properties: props})
		}
		return result
	}

	// ── Fetch tags, edges, and connectivity in parallel ──────────────────────
	type EdgeConn struct {
		SrcTag   string `json:"srcTag"`
		EdgeType string `json:"edgeType"`
		TgtTag   string `json:"tgtTag"`
	}
	var (
		tags        []TagDef
		edgeTypes   []EdgeDef
		connections []EdgeConn
		wg          sync.WaitGroup
	)

	wg.Add(3)

	// Goroutine 1: Tags
	go func() {
		defer wg.Done()
		sess, err := getSession()
		if err != nil {
			return
		}
		defer sess.Release()
		if _, err := sess.Execute(fmt.Sprintf("USE `%s`;", content.Space)); err != nil {
			return
		}
		res, err := sess.Execute("SHOW TAGS;")
		if err != nil || !res.IsSucceed() {
			return
		}
		names := make([]string, 0, res.GetRowSize())
		for i := 0; i < res.GetRowSize(); i++ {
			row, _ := res.GetRowValuesByIndex(i)
			v, _ := row.GetValueByIndex(0)
			names = append(names, asStr(v))
		}
		tags = describeItems(sess, names, "tag").([]TagDef)
	}()

	// Goroutine 2: Edge types
	go func() {
		defer wg.Done()
		sess, err := getSession()
		if err != nil {
			return
		}
		defer sess.Release()
		if _, err := sess.Execute(fmt.Sprintf("USE `%s`;", content.Space)); err != nil {
			return
		}
		res, err := sess.Execute("SHOW EDGES;")
		if err != nil || !res.IsSucceed() {
			return
		}
		names := make([]string, 0, res.GetRowSize())
		for i := 0; i < res.GetRowSize(); i++ {
			row, _ := res.GetRowValuesByIndex(i)
			v, _ := row.GetValueByIndex(0)
			names = append(names, asStr(v))
		}
		edgeTypes = describeItems(sess, names, "edge").([]EdgeDef)
	}()

	// Goroutine 3: Real edge connectivity from actual graph data
	// MATCH query tells us which tag types are connected by which edge types
	go func() {
		defer wg.Done()
		sess, err := getSession()
		if err != nil {
			return
		}
		defer sess.Release()
		if _, err := sess.Execute(fmt.Sprintf("USE `%s`;", content.Space)); err != nil {
			return
		}
		// Get distinct (srcTag, edgeType, tgtTag) triples from actual data
		res, err := sess.Execute(
			"MATCH (a)-[e]->(b) RETURN DISTINCT tags(a)[0] AS src, type(e) AS et, tags(b)[0] AS tgt LIMIT 500;",
		)
		if err != nil || !res.IsSucceed() {
			return
		}
		seen := make(map[string]bool)
		for i := 0; i < res.GetRowSize(); i++ {
			row, _ := res.GetRowValuesByIndex(i)
			srcV, _ := row.GetValueByIndex(0)
			etV, _ := row.GetValueByIndex(1)
			tgtV, _ := row.GetValueByIndex(2)
			src := asStr(srcV)
			et := asStr(etV)
			tgt := asStr(tgtV)
			if src == "" || et == "" || tgt == "" {
				continue
			}
			key := src + "|" + et + "|" + tgt
			if !seen[key] {
				seen[key] = true
				connections = append(connections, EdgeConn{SrcTag: src, EdgeType: et, TgtTag: tgt})
			}
		}
	}()

	wg.Wait()
	// ─────────────────────────────────────────────────────────────────────────

	if tags == nil {
		tags = []TagDef{}
	}
	if edgeTypes == nil {
		edgeTypes = []EdgeDef{}
	}
	if connections == nil {
		connections = []EdgeConn{}
	}

	type SchemaResult struct {
		Space       string      `json:"space"`
		Tags        []TagDef    `json:"tags"`
		EdgeTypes   []EdgeDef   `json:"edgeTypes"`
		Connections []EdgeConn  `json:"connections"`
	}
	schemaJSON, _ := json.Marshal(SchemaResult{
		Space: content.Space, Tags: tags, EdgeTypes: edgeTypes, Connections: connections,
	})
	sendJSON(client, map[string]interface{}{
		"header":  incoming.Header,
		"type":    "schema",
		"payload": json.RawMessage(schemaJSON),
	})
}


func executeOne(space, gql string) models.WSQueryResult {
	session, err := getSession()
	if err != nil {
		return models.WSQueryResult{GQL: gql, Error: err.Error()}
	}
	defer session.Release()
	if space != "" {
		if _, err := session.Execute(fmt.Sprintf("USE `%s`;", space)); err != nil {
			return models.WSQueryResult{GQL: gql, Error: fmt.Sprintf("Space switch failed: %v", err)}
		}
	}
	return executeWithSession(session, gql)
}

func executeWithSession(session *nebula.Session, gql string) models.WSQueryResult {
	rs, err := session.Execute(gql)
	if err != nil {
		return models.WSQueryResult{GQL: gql, Error: err.Error()}
	}
	if !rs.IsSucceed() {
		return models.WSQueryResult{GQL: gql, Error: rs.GetErrorMsg()}
	}

	columns := rs.GetColNames()
	rows, graphNodes, graphEdges := parseResultSet(rs)

	return models.WSQueryResult{
		GQL:     gql,
		Columns: columns,
		Rows:    rows,
		Graph: &models.GraphData{
			Nodes: graphNodes,
			Edges: graphEdges,
		},
	}
}

// parseResultSet — Nebula result ko rows + graph nodes/edges mein convert karta hai
func parseResultSet(rs *nebula.ResultSet) ([]interface{}, []models.GraphNode, []models.GraphEdge) {
	var rows []interface{}
	// Dedup maps taaki same node/edge baar baar na aaye
	nodeMap := make(map[string]models.GraphNode)
	edgeMap := make(map[string]models.GraphEdge)

	for i := 0; i < rs.GetRowSize(); i++ {
		record, err := rs.GetRowValuesByIndex(i)
		if err != nil {
			continue
		}
		var row []interface{}
		for j := 0; j < len(rs.GetColNames()); j++ {
			val, err := record.GetValueByIndex(j)
			if err != nil {
				row = append(row, nil)
				continue
			}

			// Vertex detect karo
			if val.IsVertex() {
				node, err := val.AsNode()
				if err == nil {
					gn := extractGraphNode(node)
					nodeMap[gn.ID] = gn
					row = append(row, map[string]interface{}{
						"__type": "vertex", "id": gn.ID, "tag": gn.Tag,
					})
					continue
				}
			}

			// Edge detect karo
			if val.IsEdge() {
				rel, err := val.AsRelationship()
				if err == nil {
					ge := extractGraphEdge(rel)
					edgeMap[ge.ID] = ge
					row = append(row, map[string]interface{}{
						"__type": "edge", "src": ge.Source, "dst": ge.Target, "type": ge.Type,
					})
					continue
				}
			}

			// Baaki values string ke roop mein
			row = append(row, val.String())
		}
		rows = append(rows, row)
	}

	// Maps ko slices mein convert karo
	var nodes []models.GraphNode
	for _, n := range nodeMap {
		nodes = append(nodes, n)
	}
	var edges []models.GraphEdge
	for _, e := range edgeMap {
		edges = append(edges, e)
	}
	return rows, nodes, edges
}

// extractID — ValueWrapper se string ya int ID nikalta hai
func extractID(val nebula.ValueWrapper) string {
	if val.IsString() {
		s, _ := val.AsString()
		return s
	} else if val.IsInt() {
		i, _ := val.AsInt()
		return fmt.Sprintf("%d", i)
	}
	return val.String()
}

// extractGraphNode — nebula Node → GraphNode struct
func extractGraphNode(node *nebula.Node) models.GraphNode {
	id := extractID(node.GetID())
	tags := node.GetTags()
	tag := ""
	if len(tags) > 0 {
		tag = tags[0]
	}
	props := make(map[string]string)
	for _, t := range tags {
		propsMap, err := node.Properties(t)
		if err == nil {
			for k, v := range propsMap {
				props[k] = v.String()
			}
		}
	}
	label := id
	if name, ok := props["name"]; ok {
		label = name
	}
	return models.GraphNode{ID: id, Tag: tag, Label: label, Properties: props}
}

// extractGraphEdge — nebula Relationship → GraphEdge struct
func extractGraphEdge(rel *nebula.Relationship) models.GraphEdge {
	src := extractID(rel.GetSrcVertexID())
	dst := extractID(rel.GetDstVertexID())
	edgeType := rel.GetEdgeName()
	props := make(map[string]string)
	for k, v := range rel.Properties() {
		props[k] = v.String()
	}
	return models.GraphEdge{
		ID:         fmt.Sprintf("%s->%s@%s", src, dst, edgeType),
		Source:     src,
		Target:     dst,
		Type:       edgeType,
		Properties: props,
	}
}

func sendError(client *hub.Client, header models.WSHeader, message string) {
	sendJSON(client, models.WSResponse{
		Header: header, Type: "error", Message: message,
		Results: []models.WSQueryResult{},
	})
}

func sendJSON(client *hub.Client, v interface{}) {
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	client.SafeWrite(websocket.TextMessage, data)
}
