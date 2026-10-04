package config

import (
	"log"
	"os"
	"strconv"

	nebula "github.com/vesoft-inc/nebula-go/v3"
)

var Pool *nebula.ConnectionPool

// ConnectNebula initializes the connection pool to Nebula GraphD
func ConnectNebula() {
	// IP aur Port .env se lo
	host := os.Getenv("NEBULA_HOST")
	if host == "" {
		log.Fatal("❌ FATAL: NEBULA_HOST is not set in environment variables")
	}

	portStr := os.Getenv("NEBULA_PORT")
	if portStr == "" {
		log.Fatal("❌ FATAL: NEBULA_PORT is not set in environment variables")
	}

	port, err := strconv.Atoi(portStr)
	if err != nil {
		log.Fatalf("❌ FATAL: Invalid NEBULA_PORT value: %v", err)
	}

	hostAddress := nebula.HostAddress{Host: host, Port: port}

	conf := nebula.PoolConfig{
		TimeOut:         0,
		IdleTime:        0,
		MaxConnPoolSize: 10, // Max concurrent requests limit
		MinConnPoolSize: 1,
	}

	// Default Logger ke sath connection pool banana
	Pool, err = nebula.NewConnectionPool([]nebula.HostAddress{hostAddress}, conf, nebula.DefaultLogger{})
	if err != nil {
		log.Fatalf("❌ Failed to connect to Nebula Graph: %v", err)
	}

	log.Println("✅ Successfully connected to Nebula GraphD!")
}
