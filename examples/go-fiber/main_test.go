package main

import (
	"io"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFlexDocRoutes(t *testing.T) {
	app := buildApp()

	docs, err := app.Test(httptest.NewRequest("GET", "/docs", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer docs.Body.Close()
	docsBody, err := io.ReadAll(docs.Body)
	if err != nil {
		t.Fatal(err)
	}
	if docs.StatusCode != 200 || !strings.Contains(string(docsBody), "Fiber FlexDoc Example") {
		t.Fatalf("docs route failed: status=%d", docs.StatusCode)
	}
	if docs.Header.Get("Cache-Control") != "no-cache" {
		t.Fatalf("unexpected docs cache header: %q", docs.Header.Get("Cache-Control"))
	}

	asset, err := app.Test(httptest.NewRequest("GET", "/docs/__flexdoc/renderer.js", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer asset.Body.Close()
	if asset.StatusCode != 200 || !strings.Contains(asset.Header.Get("Cache-Control"), "immutable") {
		t.Fatalf("renderer route failed: status=%d cache=%q", asset.StatusCode, asset.Header.Get("Cache-Control"))
	}
}
