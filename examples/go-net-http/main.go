package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	flexdoc "github.com/prauga/flexdoc/adapters/go"
)

//go:embed showcase-openapi.json
var showcaseSpec []byte

type pet struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Status string   `json:"status"`
	Age    int      `json:"age"`
	Tags   []string `json:"tags"`
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func main() {
	docs := flexdoc.Handler(flexdoc.Config{
		Path:         "/docs",
		SpecURL:      "/openapi.json",
		Title:        "FlexDoc Go showcase",
		TryItEnabled: true,
	})

	mux := http.NewServeMux()
	mux.Handle("/docs", docs)
	mux.Handle("/docs/", docs)
	mux.HandleFunc("/openapi.json", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(showcaseSpec)
	})
	mux.HandleFunc("/pets", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			w.Header().Set("X-Next-Cursor", "cursor-2")
			writeJSON(w, http.StatusOK, []pet{{ID: "pet-1", Name: "Miso", Status: "available", Age: 3, Tags: []string{"friendly", "adoptable"}}})
		case http.MethodPost:
			var input pet
			if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"code": "invalid_request", "message": err.Error()})
				return
			}
			input.ID = "pet-new"
			if input.Status == "" {
				input.Status = "available"
			}
			writeJSON(w, http.StatusCreated, input)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/pets/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/pets/")
		result := pet{ID: id, Name: "Miso", Status: "available", Age: 3, Tags: []string{"friendly"}}
		if r.Method == http.MethodPatch {
			var patch map[string]any
			_ = json.NewDecoder(r.Body).Decode(&patch)
			if status, ok := patch["status"].(string); ok {
				result.Status = status
			}
		}
		writeJSON(w, http.StatusOK, result)
	})
	mux.HandleFunc("/search", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"terms": []string{"small", "friendly"}, "count": 1})
	})
	mux.HandleFunc("/sessions", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"token": "local-session"})
	})
	mux.HandleFunc("/uploads", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusCreated, map[string]string{"id": "upload-local", "url": "http://localhost:3000/uploads/upload-local"})
	})

	fmt.Println("API:  http://localhost:3000/pets")
	fmt.Println("Docs: http://localhost:3000/docs")
	fmt.Println("Try localhost, the configured canary server, or any custom endpoint from Try It/API Client.")
	log.Fatal(http.ListenAndServe(":3000", mux))
}
