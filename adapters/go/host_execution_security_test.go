package flexdoc

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func securityExecutor(t *testing.T, origin string) *HostExecution {
	t.Helper()
	executor, err := NewHostExecution([]string{origin})
	if err != nil {
		t.Fatalf("NewHostExecution: %v", err)
	}
	return executor
}

func response(status int) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader("")),
	}
}

func TestHostExecutionPreservesWrappedDialPolicyErrors(t *testing.T) {
	executor := securityExecutor(t, "http://api.example.test")
	executor.client = &http.Client{Transport: roundTripperFunc(func(_ *http.Request) (*http.Response, error) {
		return nil, forbidden("Host execution blocks DNS resolutions to link-local and cloud metadata endpoints.")
	})}

	result := executor.Handle("1", map[string]any{
		"request": map[string]any{"method": "GET", "url": "http://api.example.test/resource"},
	}, nil)

	if result.Status != http.StatusForbidden {
		t.Fatalf("status = %d, want 403; body=%v", result.Status, result.Body)
	}
	if !strings.Contains(stringValue(result.Body["error"]), "metadata") {
		t.Fatalf("error = %v, want metadata policy error", result.Body["error"])
	}
}

func TestHostExecutionRejectsUnsafeAPIKeyHeaderBeforeTransport(t *testing.T) {
	executor := securityExecutor(t, "http://api.example.test")
	called := false
	executor.client = &http.Client{Transport: roundTripperFunc(func(_ *http.Request) (*http.Response, error) {
		called = true
		return response(http.StatusNoContent), nil
	})}

	result := executor.Handle("1", map[string]any{
		"request": map[string]any{
			"method": "GET",
			"url":    "http://api.example.test/resource",
			"auth": map[string]any{
				"type": "apiKey", "in": "header", "key": "Host", "value": "evil.example",
			},
		},
	}, nil)

	if result.Status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%v", result.Status, result.Body)
	}
	if called {
		t.Fatal("transport was called for unsafe auth header")
	}
}

func TestHostExecutionRejectsCRLFAPIKeyValueBeforeTransport(t *testing.T) {
	executor := securityExecutor(t, "http://api.example.test")
	called := false
	executor.client = &http.Client{Transport: roundTripperFunc(func(_ *http.Request) (*http.Response, error) {
		called = true
		return response(http.StatusNoContent), nil
	})}

	result := executor.Handle("1", map[string]any{
		"request": map[string]any{
			"method": "GET",
			"url":    "http://api.example.test/resource",
			"auth": map[string]any{
				"type": "apiKey", "in": "header", "key": "X-Api-Key", "value": "secret\r\nX-Evil: yes",
			},
		},
	}, nil)

	if result.Status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%v", result.Status, result.Body)
	}
	if called {
		t.Fatal("transport was called for CRLF auth header")
	}
}

func TestHostExecutionRejectsMultipartContentTypeInjection(t *testing.T) {
	executor := securityExecutor(t, "http://api.example.test")
	executor.client = &http.Client{Transport: roundTripperFunc(func(_ *http.Request) (*http.Response, error) {
		return nil, errors.New("transport must not be reached")
	})}

	result := executor.Handle("1", map[string]any{
		"request": map[string]any{
			"method":   "POST",
			"url":      "http://api.example.test/upload",
			"bodyMode": "formdata",
			"formData": []any{
				map[string]any{"key": "upload", "type": "file", "enabled": true, "fileName": "payload.txt"},
			},
		},
	}, map[int]HostExecutionFile{
		0: {Filename: "payload.txt", ContentType: "text/plain\r\nX-Evil: yes", Data: []byte("payload")},
	})

	if result.Status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%v", result.Status, result.Body)
	}
}

func TestHostExecutionBlocksIPv4MappedMetadataIPv6(t *testing.T) {
	target := "http://[::ffff:169.254.169.254]/latest/meta-data"
	executor := securityExecutor(t, "http://[::ffff:169.254.169.254]")

	result := executor.Handle("1", map[string]any{
		"request": map[string]any{"method": "GET", "url": target},
	}, nil)

	if result.Status != http.StatusForbidden {
		t.Fatalf("status = %d, want 403; body=%v", result.Status, result.Body)
	}
}
