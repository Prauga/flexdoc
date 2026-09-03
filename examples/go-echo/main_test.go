package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFlexDocRoutes(t *testing.T) {
	app := buildApp()

	docs := httptest.NewRecorder()
	app.ServeHTTP(docs, httptest.NewRequest("GET", "/docs", nil))
	if docs.Code != 200 || !strings.Contains(docs.Body.String(), "Echo FlexDoc Example") {
		t.Fatalf("docs route failed: status=%d", docs.Code)
	}
	if docs.Header().Get("Cache-Control") != "no-cache" {
		t.Fatalf("unexpected docs cache header: %q", docs.Header().Get("Cache-Control"))
	}

	asset := httptest.NewRecorder()
	app.ServeHTTP(asset, httptest.NewRequest("GET", "/docs/__flexdoc/renderer.js", nil))
	if asset.Code != 200 || !strings.Contains(asset.Header().Get("Cache-Control"), "immutable") {
		t.Fatalf("renderer route failed: status=%d cache=%q", asset.Code, asset.Header().Get("Cache-Control"))
	}
}
