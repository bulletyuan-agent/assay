package main

import (
	"flag"
	"log"

	"github.com/example-tools/gocodegen/internal/codegen"
)

func main() {
	spec := flag.String("spec", "openapi.yaml", "OpenAPI document")
	out := flag.String("out", "./gen", "output directory")
	flag.Parse()
	if err := codegen.Generate(*spec, *out); err != nil {
		log.Fatal(err)
	}
}
