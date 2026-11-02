package main

import (
	"fmt"
	"os"
)

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	}
	for _, h := range Scan(root) {
		fmt.Println(h)
	}
}
