package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	flexdoc "github.com/prauga/flexdoc/adapters/go"
)

func main() {
	mode := os.Getenv("FLEXDOC_BENCH_MODE")
	if mode == "" { mode = "baseline" }
	port, _ := strconv.Atoi(os.Getenv("FLEXDOC_BENCH_PORT"))
	if port == 0 { port = 5810 }
	origin := os.Getenv("FLEXDOC_BENCH_ORIGIN")
	if origin == "" { origin = fmt.Sprintf("http://127.0.0.1:%d", port) }

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	mux.HandleFunc("/target", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"runtime":"go-net-http"}`))
	})
	mux.HandleFunc("/openapi.json", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"openapi": "3.0.3",
			"info": map[string]any{"title": "FlexDoc host-impact benchmark", "version": "1.0.0"},
			"paths": map[string]any{"/target": map[string]any{"get": map[string]any{"responses": map[string]any{"200": map[string]any{"description": "ok"}}}}},
		})
	})

	if mode != "baseline" {
		config := flexdoc.Config{
			Path: "/docs",
			SpecURL: "/openapi.json",
			Title: "FlexDoc host-impact benchmark",
			TryItEnabled: true,
			TryItDefaultServer: origin,
		}
		if mode == "host" {
			executor, err := flexdoc.NewHostExecution([]string{origin})
			if err != nil { log.Fatal(err) }
			config.TryItHostExecution = true
			config.HostExecutionProtected = true
			config.HostExecution = executor
		}
		docs := flexdoc.Handler(config)
		mux.Handle("/docs", docs)
		mux.Handle("/docs/", docs)
	}

	server := &http.Server{Addr: fmt.Sprintf("127.0.0.1:%d", port), Handler: mux}
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatal(err) }
}
