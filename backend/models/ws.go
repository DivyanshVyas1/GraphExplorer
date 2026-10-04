package models

// ── INCOMING ──────────────────────────────────
type WSHeader struct {
	MsgID   string `json:"msgId"`
	Version string `json:"version"`
}
type WSBody struct {
	Product string      `json:"product"`
	MsgType string      `json:"msgType"`
	Content interface{} `json:"content"`
}
type WSIncoming struct {
	Header WSHeader `json:"header"`
	Body   WSBody   `json:"body"`
}
type NGQLContent struct {
	Space string `json:"space"`
	GQL   string `json:"gql"`
}
type BatchNGQLContent struct {
	Space string   `json:"space"`
	GQLs  []string `json:"gqls"`
}

// ── GRAPH DATA ────────────────────────────────
// D3.js ke liye structured vertex/edge data

type GraphNode struct {
	ID         string            `json:"id"`
	Tag        string            `json:"tag"`
	Label      string            `json:"label"`
	Properties map[string]string `json:"properties"`
}

type GraphEdge struct {
	ID         string            `json:"id"`
	Source     string            `json:"source"`
	Target     string            `json:"target"`
	Type       string            `json:"type"`
	Properties map[string]string `json:"properties"`
}

type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

// ── OUTGOING ──────────────────────────────────
type WSQueryResult struct {
	GQL     string        `json:"gql"`
	Columns []string      `json:"columns,omitempty"`
	Rows    []interface{} `json:"rows,omitempty"`
	Graph   *GraphData    `json:"graph,omitempty"` // D3 ke liye pre-parsed
	Error   string        `json:"error,omitempty"`
}

type WSResponse struct {
	Header  WSHeader        `json:"header"`
	Type    string          `json:"type"`
	Results []WSQueryResult `json:"results"`
	Message string          `json:"message,omitempty"`
}
