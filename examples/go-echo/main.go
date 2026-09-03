package main

import (
	"github.com/labstack/echo/v5"
	flexdoc "github.com/prauga/flexdoc/adapters/go"
)

func buildApp() *echo.Echo {
	e := echo.New()
	docs := echo.WrapHandler(flexdoc.Handler(flexdoc.Config{Path: "/docs", SpecURL: "/openapi.json", Title: "Echo FlexDoc Example", TryItEnabled: true}))
	e.Any("/docs", docs)
	e.Any("/docs/*", docs)
	return e
}

func main() { _ = buildApp().Start(":8080") }
