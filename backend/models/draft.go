package models

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// Draft represents a Schema Draft saved by the user
type Draft struct {
	ID        uint            `gorm:"primaryKey" json:"id"`
	Name      string          `gorm:"type:varchar(255);not null" json:"name"`
	Space     string          `gorm:"type:varchar(255)" json:"space"` // Optional: which space it belongs to
	Nodes     json.RawMessage `gorm:"type:jsonb;default:'[]'" json:"nodes"`
	Edges     json.RawMessage `gorm:"type:jsonb;default:'[]'" json:"edges"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
