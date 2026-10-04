package models

// Space struct (TypeScript interface jaisa)
type Space struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Nodes      string `json:"nodes"`
	Edges      string `json:"edges"`
	LastSynced string `json:"lastSynced"`
	Updates    string `json:"updates"`
	IsActive   bool   `json:"isActive"`
}