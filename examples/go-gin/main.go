package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	flexdoc "github.com/prauga/flexdoc/adapters/go"
)

func buildRouter() http.Handler {
	r := gin.New()
	docs := flexdoc.Handler(flexdoc.Config{Path: "/docs", SpecURL: "/openapi.json", Title: "Gin FlexDoc Example", TryItEnabled: true})
	r.GET("/docs", gin.WrapH(docs))
	r.Any("/docs/*path", gin.WrapH(docs))
	return r
}

func main() { _ = http.ListenAndServe(":8080", buildRouter()) }
