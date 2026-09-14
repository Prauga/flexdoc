package flexdoc

import (
	"io"
	"runtime"
	"strings"
	"testing"
)

func TestPreparedMultipartBodyStreamsAndReplaysWithoutFullCopy(t *testing.T) {
	payload := make([]byte, 8*1024*1024)
	for index := range payload {
		payload[index] = byte(index)
	}
	draft := map[string]any{
		"bodyMode": "formdata",
		"formData": []any{
			map[string]any{"key": "upload", "type": "file", "enabled": true, "fileName": "payload.bin", "contentType": "application/octet-stream"},
			map[string]any{"key": "note", "type": "text", "enabled": true, "value": "hello"},
		},
	}
	files := map[int]HostExecutionFile{
		0: {Filename: "payload.bin", ContentType: "application/octet-stream", Data: payload},
	}

	runtime.GC()
	var before runtime.MemStats
	var after runtime.MemStats
	runtime.ReadMemStats(&before)
	prepared, err := prepareRequestBody(draft, map[string]any{}, files, "formdata")
	if err != nil {
		t.Fatalf("prepareRequestBody: %v", err)
	}
	runtime.ReadMemStats(&after)
	if allocated := after.TotalAlloc - before.TotalAlloc; allocated > 2*1024*1024 {
		t.Fatalf("multipart preparation allocated %d bytes for an 8 MiB upload; expected streaming preparation", allocated)
	}
	if !strings.HasPrefix(prepared.contentType, "multipart/form-data; boundary=") {
		t.Fatalf("unexpected multipart content type %q", prepared.contentType)
	}

	var first int64
	for attempt := 0; attempt < 2; attempt++ {
		reader, err := prepared.open()
		if err != nil {
			t.Fatalf("open attempt %d: %v", attempt, err)
		}
		count, err := io.Copy(io.Discard, reader)
		if closer, ok := reader.(io.Closer); ok {
			_ = closer.Close()
		}
		if err != nil {
			t.Fatalf("read attempt %d: %v", attempt, err)
		}
		if count <= int64(len(payload)) {
			t.Fatalf("multipart body length %d did not include framing", count)
		}
		if attempt == 0 {
			first = count
		} else if count != first {
			t.Fatalf("multipart replay length changed: first=%d second=%d", first, count)
		}
	}
}
