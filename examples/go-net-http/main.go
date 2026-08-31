package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	flexdoc "github.com/prauga/flexdoc/adapters/go"
)

func main() {
	spec := map[string]any{
		"openapi": "3.1.0",
		"info": map[string]any{
			"title":   "FlexDoc Go example",
			"version": "1.0.0",
		},
		"servers": []map[string]any{{"url": "http://localhost:8080"}},
		"paths": map[string]any{
			"/hello": map[string]any{
				"get": map[string]any{
					"summary": "Say hello",
					"responses": map[string]any{
						"200": map[string]any{
							"description": "Greeting",
							"content": map[string]any{
								"application/json": map[string]any{
									"schema": map[string]any{
										"type": "object",
										"properties": map[string]any{
											"message": map[string]any{"type": "string"},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	docs := flexdoc.Handler(flexdoc.Config{
		Path:         "/docs",
		SpecURL:      "/openapi.json",
		Title:        "FlexDoc Go example",
		TryItEnabled: true,
	})

	http.Handle("/docs", docs)
	http.Handle("/docs/", docs)
	http.HandleFunc("/openapi.json", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(spec)
	})
	http.HandleFunc("/hello", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "Hello from Go!"})
	})

	fmt.Println("API:  http://localhost:8080/hello")
	fmt.Println("Docs: http://localhost:8080/docs")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
