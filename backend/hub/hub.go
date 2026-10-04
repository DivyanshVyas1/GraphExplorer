package hub

import (
	"sync"

	"github.com/gorilla/websocket"
)

// Client — Ek connected user ka representation
// Har baar koi user WebSocket se connect karta hai, ek Client object banta hai
type Client struct {
	Conn *websocket.Conn // User ka WebSocket connection
	Send chan []byte     // Is channel mein data daalo, client ko chala jayega
	mu   sync.Mutex     // Concurrent writes se bachne ke liye lock
}

// SafeWrite — Thread-safe tarika WebSocket pe likhne ka
// Agar do goroutines ek saath likhne ki koshish karein toh panic hoga, ye isse rokta hai
func (c *Client) SafeWrite(messageType int, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.Conn.WriteMessage(messageType, data)
}

// Hub — Sabhi connected clients ka manager
// Jab koi connect ya disconnect kare, Hub usse track karta hai
type Hub struct {
	clients    map[*Client]bool // Sabhi active connections
	Register   chan *Client     // Naya client aaya
	Unregister chan *Client     // Client chala gaya
	mu         sync.RWMutex    // Concurrent map access ke liye
}

// NewHub — Ek naya Hub banata hai
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

// Run — Hub ka main loop, background mein chalta rehta hai
// Connect/disconnect events ko handle karta hai
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}
			h.mu.Unlock()
		}
	}
}
