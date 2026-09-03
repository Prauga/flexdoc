package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	flexdoc "github.com/prauga/flexdoc/adapters/go"
)

func buildRouter() http.Handler {
	r := chi.NewRouter()
	docs := flexdoc.Handler(flexdoc.Config{Path: "/docs", SpecURL: "/openapi.json", Title: "Chi FlexDoc Example", TryItEnabled: true})
	r.Handle("/docs", docs)
	r.Handle("/docs/*", docs)
	return r
}

func main() { _ = http.ListenAndServe(":8080", buildRouter()) }
