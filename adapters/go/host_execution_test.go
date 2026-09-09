package flexdoc

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func mustHostExecution(t *testing.T, origins ...string) *HostExecution {
	t.Helper()
	executor, err := NewHostExecution(origins)
	if err != nil {
		t.Fatalf("NewHostExecution: %v", err)
	}
	return executor
}

func canonicalEnvelope(method, target string) map[string]any {
	return map[string]any{
		"request": map[string]any{
			"method": method,
			"url":    target,
		},
	}
}

func executionError(t *testing.T, result HostExecutionResult) string {
	t.Helper()
	value, _ := result.Body["error"].(string)
	return value
}

func TestNewHostExecutionRequiresExactOrigin(t *testing.T) {
	for _, origins := range [][]string{
		nil,
		{""},
		{"https://api.example.test/path"},
		{"https://user@example.test"},
		{"https://api.example.test?x=1"},
	} {
		if _, err := NewHostExecution(origins); err == nil {
			t.Fatalf("NewHostExecution(%q) unexpectedly succeeded", origins)
		}
	}
}

func TestGoHandlerAdvertisesAndOwnsExecuteRouteOnlyWithRealExecutor(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "ok")
	}))
	defer target.Close()

	without := HandlerWithAssets(Config{
		Path: "/docs", SpecURL: "/openapi.json", TryItEnabled: true, TryItHostExecution: true,
	}, testAssets())
	page := httptest.NewRecorder()
	without.ServeHTTP(page, httptest.NewRequest(http.MethodGet, "/docs", nil))
	options := optionsFromHTML(t, page.Body.String())
	host := options["tryIt"].(map[string]any)["hostExecution"].(map[string]any)
	if host["available"] != false {
		t.Fatalf("hostExecution.available = %#v, want false", host["available"])
	}
	notFound := httptest.NewRecorder()
	without.ServeHTTP(notFound, httptest.NewRequest(http.MethodPost, "/docs/__flexdoc/execute", nil))
	if notFound.Code != http.StatusNotFound {
		t.Fatalf("disabled execute route status = %d, want 404", notFound.Code)
	}

	with := HandlerWithAssets(Config{
		Path: "/docs", SpecURL: "/openapi.json", TryItEnabled: true, TryItHostExecution: true,
		HostExecution: mustHostExecution(t, target.URL),
	}, testAssets())
	page = httptest.NewRecorder()
	with.ServeHTTP(page, httptest.NewRequest(http.MethodGet, "/docs", nil))
	options = optionsFromHTML(t, page.Body.String())
	host = options["tryIt"].(map[string]any)["hostExecution"].(map[string]any)
	if host["available"] != true {
		t.Fatalf("hostExecution.available = %#v, want true", host["available"])
	}
	if capabilities, ok := host["capabilities"].([]any); !ok || len(capabilities) != 0 {
		t.Fatalf("hostExecution.capabilities = %#v, want []", host["capabilities"])
	}

	payload, _ := json.Marshal(canonicalEnvelope(http.MethodGet, target.URL))
	req := httptest.NewRequest(http.MethodPost, "/docs/__flexdoc/execute", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-FlexDoc-Execute", "1")
	rec := httptest.NewRecorder()
	with.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("execute status = %d body=%s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("Cache-Control = %q", rec.Header().Get("Cache-Control"))
	}
}

func TestGoExecuteRequiresMarkerBeforeParsingBody(t *testing.T) {
	h := mustHostExecution(t, "https://api.example.test")
	req := httptest.NewRequest(http.MethodPost, "/docs/__flexdoc/execute", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "Missing X-FlexDoc-Execute header") {
		t.Fatalf("unexpected error: %s", rec.Body.String())
	}
}

func TestGoExecutorPreservesEncodedURLAndStripsUnsafeHeaders(t *testing.T) {
	var requestURI, originHeader, customHeader string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestURI = r.RequestURI
		originHeader = r.Header.Get("Origin")
		customHeader = r.Header.Get("X-Test")
		_, _ = io.WriteString(w, "ok")
	}))
	defer target.Close()

	envelope := canonicalEnvelope(http.MethodGet, target.URL+"/encoded%2Fpart?existing=a%2Fb")
	draft := envelope["request"].(map[string]any)
	draft["query"] = []any{map[string]any{"key": "next", "value": "c d"}}
	draft["headers"] = []any{
		map[string]any{"key": "Origin", "value": "https://attacker.example"},
		map[string]any{"key": "X-Test", "value": "kept"},
	}
	result := mustHostExecution(t, target.URL).Handle("1", envelope, nil)
	if result.Status != http.StatusOK {
		t.Fatalf("status = %d error=%s", result.Status, executionError(t, result))
	}
	if strings.Contains(requestURI, "%252F") || !strings.Contains(requestURI, "/encoded%2Fpart") || !strings.Contains(requestURI, "existing=a%2Fb") {
		t.Fatalf("encoded request URI changed: %q", requestURI)
	}
	if !strings.Contains(requestURI, "next=c+d") {
		t.Fatalf("canonical query missing: %q", requestURI)
	}
	if originHeader != "" {
		t.Fatalf("unsafe Origin forwarded: %q", originHeader)
	}
	if customHeader != "kept" {
		t.Fatalf("X-Test = %q", customHeader)
	}
}

func TestGoExecutorReappliesQueryAPIKeyAcrossSameOriginRedirect(t *testing.T) {
	var firstQuery, secondQuery string
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/start":
			firstQuery = r.URL.RawQuery
			w.Header().Set("Location", "/finish")
			w.WriteHeader(http.StatusFound)
		case "/finish":
			secondQuery = r.URL.RawQuery
			_, _ = io.WriteString(w, "done")
		default:
			http.NotFound(w, r)
		}
	}))
	defer target.Close()

	envelope := canonicalEnvelope(http.MethodGet, target.URL+"/start")
	envelope["request"].(map[string]any)["auth"] = map[string]any{
		"type": "apiKey", "in": "query", "key": "token", "value": "secret",
	}
	result := mustHostExecution(t, target.URL).Handle("1", envelope, nil)
	if result.Status != http.StatusOK {
		t.Fatalf("status = %d error=%s", result.Status, executionError(t, result))
	}
	if firstQuery != "token=secret" || secondQuery != "token=secret" {
		t.Fatalf("query auth first=%q second=%q", firstQuery, secondQuery)
	}
}

func TestGoExecutorRejectsCrossOriginRedirectEvenWhenBothOriginsAllowed(t *testing.T) {
	second := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "should-not-run")
	}))
	defer second.Close()
	first := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Location", second.URL+"/next")
		w.WriteHeader(http.StatusFound)
	}))
	defer first.Close()

	result := mustHostExecution(t, first.URL, second.URL).Handle("1", canonicalEnvelope(http.MethodGet, first.URL), nil)
	if result.Status != http.StatusForbidden || !strings.Contains(executionError(t, result), "cross-origin") {
		t.Fatalf("status=%d error=%q", result.Status, executionError(t, result))
	}
}

func TestGoExecutorBlocksMetadataDestination(t *testing.T) {
	h := mustHostExecution(t, "http://169.254.169.254")
	result := h.Handle("1", canonicalEnvelope(http.MethodGet, "http://169.254.169.254/latest/meta-data"), nil)
	if result.Status != http.StatusForbidden || !strings.Contains(executionError(t, result), "metadata") {
		t.Fatalf("status=%d error=%q", result.Status, executionError(t, result))
	}
}

func TestGoExecutorSupportsCanonicalIncomingAndOutgoingMultipart(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		file, header, err := r.FormFile("upload")
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		defer file.Close()
		data, _ := io.ReadAll(file)
		_, _ = fmt.Fprintf(w, "%s|%s|%s", r.FormValue("note"), header.Filename, string(data))
	}))
	defer target.Close()

	executor := mustHostExecution(t, target.URL)
	var incoming bytes.Buffer
	writer := multipart.NewWriter(&incoming)
	descriptor := fmt.Sprintf(`{"request":{"method":"POST","url":%q,"bodyMode":"formdata","formData":[{"key":"note","type":"text","value":"hello"},{"key":"upload","type":"file","fileName":"payload.txt"}]}}`, target.URL)
	part, _ := writer.CreateFormField("descriptor")
	_, _ = io.WriteString(part, descriptor)
	file, _ := writer.CreateFormFile("formData[1]", "payload.txt")
	_, _ = io.WriteString(file, "file-body")
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/docs/__flexdoc/execute", &incoming)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-FlexDoc-Execute", "1")
	rec := httptest.NewRecorder()
	executor.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "hello|payload.txt|file-body") {
		t.Fatalf("unexpected response: %s", rec.Body.String())
	}
}

func TestGoExecutorEnforcesFullResponseDeadline(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		time.Sleep(250 * time.Millisecond)
		_, _ = io.WriteString(w, "late")
	}))
	defer target.Close()

	envelope := canonicalEnvelope(http.MethodGet, target.URL)
	envelope["timeoutMs"] = 100
	result := mustHostExecution(t, target.URL).Handle("1", envelope, nil)
	if result.Status != http.StatusBadGateway || !strings.Contains(executionError(t, result), "timed out") {
		t.Fatalf("status=%d error=%q", result.Status, executionError(t, result))
	}
}

func TestGoExecutorBoundsResponseBody(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(bytes.Repeat([]byte("x"), maxExecutionResponseBytes+1))
	}))
	defer target.Close()

	result := mustHostExecution(t, target.URL).Handle("1", canonicalEnvelope(http.MethodGet, target.URL), nil)
	if result.Status != http.StatusBadGateway || !strings.Contains(executionError(t, result), "10 MiB") {
		t.Fatalf("status=%d error=%q", result.Status, executionError(t, result))
	}
}

func TestGoExecuteRejectsMalformedUTF8JSON(t *testing.T) {
	h := mustHostExecution(t, "https://api.example.test")
	body := []byte{'{', '"', 'r', 'e', 'q', 'u', 'e', 's', 't', '"', ':', '{', '"', 'u', 'r', 'l', '"', ':', '"', 0xff, '"', '}', '}'}
	req := httptest.NewRequest(http.MethodPost, "/docs/__flexdoc/execute", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-FlexDoc-Execute", "1")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "UTF-8") {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGoExecuteReportsMultipartBodyLimitCanonically(t *testing.T) {
	h := mustHostExecution(t, "https://api.example.test")
	var incoming bytes.Buffer
	writer := multipart.NewWriter(&incoming)
	part, _ := writer.CreateFormField("descriptor")
	_, _ = io.WriteString(part, `{"request":{"method":"POST","url":"https://api.example.test","bodyMode":"formdata","formData":[]}}`)
	large, _ := writer.CreateFormFile("formData[0]", "large.bin")
	_, _ = large.Write(bytes.Repeat([]byte("x"), maxExecutionRequestBytes))
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/docs/__flexdoc/execute", &incoming)
	req.ContentLength = -1 // exercise the streaming bound rather than the declared-length fast path
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-FlexDoc-Execute", "1")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "32 MiB safety limit") {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGoExecutorRejectsUnsupportedHostOnlyAuth(t *testing.T) {
	envelope := canonicalEnvelope(http.MethodGet, "https://api.example.test")
	envelope["request"].(map[string]any)["auth"] = map[string]any{"type": "digest", "username": "a", "password": "b"}
	result := mustHostExecution(t, "https://api.example.test").Handle("1", envelope, nil)
	if result.Status != http.StatusBadRequest || !strings.Contains(executionError(t, result), "not implemented") {
		t.Fatalf("status=%d error=%q", result.Status, executionError(t, result))
	}
}
