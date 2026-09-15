package flexdoc

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandlerRejectsMetadataTargetAtHTTPBoundary(t *testing.T) {
	executor, err := NewHostExecution([]string{"http://169.254.169.254"})
	if err != nil {
		t.Fatalf("NewHostExecution: %v", err)
	}

	handler := Handler(Config{
		Path:               "/docs",
		TryItHostExecution: true,
		HostExecution:      executor,
	})
	request := httptest.NewRequest(
		http.MethodPost,
		"http://docs.example.test/docs/__flexdoc/execute",
		strings.NewReader(`{"request":{"method":"GET","url":"http://169.254.169.254/latest/meta-data/"}}`),
	)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-FlexDoc-Execute", "1")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403; body=%s", response.Code, response.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v; body=%s", err, response.Body.String())
	}
	if got := stringValue(body["error"]); got != "Host execution blocks link-local and cloud metadata endpoints." {
		t.Fatalf("error = %q, want metadata rejection", got)
	}
}
