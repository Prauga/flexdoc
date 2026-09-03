package main

import (
	"github.com/gofiber/fiber/v3"
	flexdoc "github.com/prauga/flexdoc/adapters/go"
)

func buildApp() *fiber.App {
	app := fiber.New()
	docs := flexdoc.Handler(flexdoc.Config{Path: "/docs", SpecURL: "/openapi.json", Title: "Fiber FlexDoc Example", TryItEnabled: true})
	// Fiber v3 directly adapts standard net/http handlers.
	app.Get("/docs", docs)
	app.Get("/docs/*", docs)
	return app
}

func main() { _ = buildApp().Listen(":8080") }
