package flexdoc

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net"
	"net/http"
	"net/textproto"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	maxExecutionRequestBytes  = 32 * 1024 * 1024
	maxExecutionResponseBytes = 10 * 1024 * 1024
	defaultExecutionTimeout   = 30 * time.Second
	minExecutionTimeout       = 100 * time.Millisecond
	maxExecutionTimeout       = 120 * time.Second
	maxExecutionRedirects     = 5
)

var (
	headerNamePattern = regexp.MustCompile(`^[!#$%&'*+\-.^_` + "`" + `|~0-9A-Za-z]+$`)
	filePartPattern   = regexp.MustCompile(`^formData\[(\d+)\]$`)
	supportedMethods  = map[string]bool{"GET": true, "HEAD": true, "POST": true, "PUT": true, "PATCH": true, "DELETE": true, "OPTIONS": true}
	hopByHopHeaders   = map[string]bool{
		"connection": true, "keep-alive": true, "proxy-authenticate": true,
		"proxy-authorization": true, "te": true, "trailer": true,
		"transfer-encoding": true, "upgrade": true, "host": true,
		"content-length": true, "set-cookie": true,
	}
)

// HostExecutionFile is one browser-uploaded canonical formData[n] file part.
type HostExecutionFile struct {
	Filename    string
	ContentType string
	Data        []byte
}

// HostExecutionResult is the status and JSON body returned by native execution.
type HostExecutionResult struct {
	Status int
	Body   map[string]any
}

// HostExecution executes the existing FlexDoc API-host envelope through Go's net/http stack.
type HostExecution struct {
	allowedOrigins map[string]struct{}
	client         *http.Client
}

// NewHostExecution creates a native executor with an explicit exact HTTP(S) origin allowlist.
func NewHostExecution(allowedOrigins []string) (*HostExecution, error) {
	normalized := make(map[string]struct{})
	for _, raw := range allowedOrigins {
		if strings.TrimSpace(raw) == "" {
			continue
		}
		u, err := parseHTTPURL(raw)
		if err != nil {
			return nil, fmt.Errorf("host execution allowed origin %q: %w", raw, err)
		}
		if u.User != nil || (u.EscapedPath() != "" && u.EscapedPath() != "/") || u.RawQuery != "" || u.Fragment != "" {
			return nil, fmt.Errorf("host execution allowed origins cannot contain credentials, paths, queries, or fragments: %s", raw)
		}
		normalized[originOf(u)] = struct{}{}
	}
	if len(normalized) == 0 {
		return nil, errors.New("FlexDoc host execution requires at least one exact allowed origin")
	}

	executor := &HostExecution{allowedOrigins: normalized}
	transport := &http.Transport{
		Proxy:               nil,
		DialContext:         executor.dialContext,
		ForceAttemptHTTP2:   true,
		MaxIdleConns:        32,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
	}
	executor.client = &http.Client{
		Transport: transport,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	return executor, nil
}

// Capabilities returns host-only capabilities implemented by this first Go slice.
func (e *HostExecution) Capabilities() []string { return []string{} }

// Handle validates the execute marker and maps native execution errors to canonical JSON errors.
func (e *HostExecution) Handle(marker string, envelope map[string]any, files map[int]HostExecutionFile) HostExecutionResult {
	if marker != "1" {
		return HostExecutionResult{Status: http.StatusForbidden, Body: map[string]any{"error": "Missing X-FlexDoc-Execute header."}}
	}
	body, err := e.Execute(envelope, files)
	if err == nil {
		return HostExecutionResult{Status: http.StatusOK, Body: body}
	}
	var executionErr *hostExecutionError
	if errors.As(err, &executionErr) {
		return HostExecutionResult{Status: executionErr.status, Body: map[string]any{"error": executionErr.Error()}}
	}
	return HostExecutionResult{Status: http.StatusBadGateway, Body: map[string]any{"error": "API host execution failed."}}
}

// Execute runs one already-parsed canonical host-execution envelope.
func (e *HostExecution) Execute(envelope map[string]any, files map[int]HostExecutionFile) (map[string]any, error) {
	if envelope == nil {
		return nil, badRequest("Host execution body must be a JSON object.")
	}
	if stringValue(envelope["cookieJar"]) == "session" {
		return nil, badRequest("Session cookie jars are not implemented by the Go host executor.")
	}
	if strings.TrimSpace(stringValue(envelope["certificateId"])) != "" {
		return nil, badRequest("Client certificates are not implemented by the Go host executor.")
	}

	draft, ok := envelope["request"].(map[string]any)
	if !ok {
		return nil, badRequest("Host execution body requires a canonical request draft.")
	}
	rawURL := stringValue(draft["url"])
	if strings.TrimSpace(rawURL) == "" {
		return nil, badRequest("Host execution requires an absolute request URL.")
	}
	target, err := parseHTTPURL(rawURL)
	if err != nil {
		return nil, badRequest("Host execution requires an absolute HTTP(S) request URL.")
	}
	if target.User != nil {
		return nil, forbidden("Host execution URLs cannot contain embedded credentials.")
	}
	appendQuery(target, entries(draft["query"]))

	method := strings.ToUpper(strings.TrimSpace(stringValue(draft["method"])))
	if method == "" {
		method = http.MethodGet
	}
	if !supportedMethods[method] {
		return nil, badRequest("Unsupported host execution HTTP method: " + method)
	}

	headers, err := sanitizeHeaders(entries(draft["headers"]))
	if err != nil {
		return nil, err
	}
	if err := applyHeaderAuth(draft["auth"], headers); err != nil {
		return nil, err
	}
	mode := inferBodyMode(draft)
	prepared, err := prepareRequestBody(draft, envelope, files, mode)
	if err != nil {
		return nil, err
	}
	if mode == "formdata" {
		headers.Del("Content-Type")
	}
	if prepared.contentType != "" && headers.Get("Content-Type") == "" {
		headers.Set("Content-Type", prepared.contentType)
	}

	timeout := durationMillis(envelope["timeoutMs"], defaultExecutionTimeout)
	if timeout < minExecutionTimeout {
		timeout = minExecutionTimeout
	}
	if timeout > maxExecutionTimeout {
		timeout = maxExecutionTimeout
	}
	return e.executeWithRedirects(method, target, headers, prepared.data, timeout, draft["auth"])
}

// ServeHTTP consumes the canonical JSON/multipart execute envelope at an adapter-owned route.
func (e *HostExecution) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeExecutionJSON(w, HostExecutionResult{Status: http.StatusMethodNotAllowed, Body: map[string]any{"error": "Method not allowed."}})
		return
	}
	marker := r.Header.Get("X-FlexDoc-Execute")
	if marker != "1" {
		writeExecutionJSON(w, e.Handle(marker, map[string]any{}, nil))
		return
	}
	if r.ContentLength > maxExecutionRequestBytes {
		writeExecutionJSON(w, HostExecutionResult{Status: http.StatusBadRequest, Body: map[string]any{"error": "Host execution request exceeded the 32 MiB safety limit."}})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxExecutionRequestBytes)
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil {
		writeExecutionJSON(w, HostExecutionResult{Status: http.StatusBadRequest, Body: map[string]any{"error": "Host execution Content-Type is invalid."}})
		return
	}

	var envelope map[string]any
	files := map[int]HostExecutionFile{}
	switch strings.ToLower(mediaType) {
	case "application/json":
		data, readErr := io.ReadAll(r.Body)
		if readErr != nil {
			writeReadError(w, readErr)
			return
		}
		if !utf8.Valid(data) {
			writeExecutionJSON(w, HostExecutionResult{Status: http.StatusBadRequest, Body: map[string]any{"error": "Host execution body must be valid UTF-8 JSON object."}})
			return
		}
		if err := json.Unmarshal(data, &envelope); err != nil || envelope == nil {
			writeExecutionJSON(w, HostExecutionResult{Status: http.StatusBadRequest, Body: map[string]any{"error": "Host execution body must be valid UTF-8 JSON object."}})
			return
		}
	case "multipart/form-data":
		envelope, files, err = parseIncomingMultipart(r)
		if err != nil {
			var executionErr *hostExecutionError
			if errors.As(err, &executionErr) {
				writeExecutionJSON(w, HostExecutionResult{Status: executionErr.status, Body: map[string]any{"error": executionErr.Error()}})
			} else {
				writeExecutionJSON(w, HostExecutionResult{Status: http.StatusBadRequest, Body: map[string]any{"error": "Host execution multipart body is invalid."}})
			}
			return
		}
	default:
		writeExecutionJSON(w, HostExecutionResult{Status: http.StatusBadRequest, Body: map[string]any{"error": "Host execution requires application/json or multipart/form-data."}})
		return
	}
	writeExecutionJSON(w, e.Handle(marker, envelope, files))
}

type preparedBody struct {
	data        []byte
	contentType string
}

type hostExecutionError struct {
	status  int
	message string
}

func (e *hostExecutionError) Error() string { return e.message }
func badRequest(message string) error {
	return &hostExecutionError{status: http.StatusBadRequest, message: message}
}
func forbidden(message string) error {
	return &hostExecutionError{status: http.StatusForbidden, message: message}
}
func upstream(message string) error {
	return &hostExecutionError{status: http.StatusBadGateway, message: message}
}

func (e *HostExecution) executeWithRedirects(method string, target *url.URL, headers http.Header, body []byte, timeout time.Duration, rawAuth any) (map[string]any, error) {
	current := cloneURL(target)
	currentHeaders := headers.Clone()
	currentBody := append([]byte(nil), body...)

	for redirect := 0; redirect <= maxExecutionRedirects; redirect++ {
		requestURL := cloneURL(current)
		if err := applyQueryAuth(rawAuth, requestURL); err != nil {
			return nil, err
		}
		if err := e.assertAllowed(requestURL); err != nil {
			return nil, err
		}

		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		var reader io.Reader
		if currentBody != nil {
			reader = bytes.NewReader(currentBody)
		}
		req, err := http.NewRequestWithContext(ctx, method, requestURL.String(), reader)
		if err != nil {
			cancel()
			return nil, upstream("Host execution request failed: " + err.Error())
		}
		req.Header = currentHeaders.Clone()
		started := time.Now()
		response, err := e.client.Do(req)
		if err != nil {
			cancel()
			if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return nil, upstream(fmt.Sprintf("Host execution request timed out after %d ms.", timeout.Milliseconds()))
			}
			return nil, upstream("Host execution request failed: " + err.Error())
		}

		data, readErr := io.ReadAll(io.LimitReader(response.Body, maxExecutionResponseBytes+1))
		closeErr := response.Body.Close()
		elapsed := time.Since(started)
		deadlineErr := ctx.Err()
		cancel()
		if deadlineErr != nil || errors.Is(readErr, context.DeadlineExceeded) {
			return nil, upstream(fmt.Sprintf("Host execution request timed out after %d ms.", timeout.Milliseconds()))
		}
		if readErr != nil {
			return nil, upstream("Host execution response read failed: " + readErr.Error())
		}
		if closeErr != nil {
			return nil, upstream("Host execution response close failed: " + closeErr.Error())
		}
		if len(data) > maxExecutionResponseBytes {
			return nil, upstream("Host execution response exceeded the 10 MiB safety limit.")
		}

		if isRedirect(response.StatusCode) && response.Header.Get("Location") != "" {
			if redirect == maxExecutionRedirects {
				return nil, forbidden("Host execution exceeded the redirect safety limit.")
			}
			next, err := requestURL.Parse(response.Header.Get("Location"))
			if err != nil {
				return nil, badRequest("Host execution received an invalid redirect URL.")
			}
			if originOf(next) != originOf(requestURL) {
				return nil, forbidden("Host execution does not follow cross-origin redirects.")
			}
			if err := e.assertAllowed(next); err != nil {
				return nil, err
			}
			if response.StatusCode == http.StatusSeeOther {
				method = http.MethodGet
				currentBody = nil
				currentHeaders.Del("Content-Type")
			}
			current = next
			continue
		}

		responseHeaders := make([][]string, 0)
		for name, values := range response.Header {
			for _, value := range values {
				responseHeaders = append(responseHeaders, []string{name, value})
			}
		}
		return map[string]any{
			"status":       response.StatusCode,
			"statusText":   http.StatusText(response.StatusCode),
			"headers":      responseHeaders,
			"body":         string(data),
			"responseTime": elapsed.Milliseconds(),
		}, nil
	}
	return nil, forbidden("Host execution exceeded the redirect safety limit.")
}

func (e *HostExecution) assertAllowed(target *url.URL) error {
	if target == nil || (target.Scheme != "http" && target.Scheme != "https") || target.Hostname() == "" {
		return forbidden("Host execution only allows HTTP(S) URLs.")
	}
	if target.User != nil {
		return forbidden("Host execution URLs cannot contain embedded credentials.")
	}
	if _, ok := e.allowedOrigins[originOf(target)]; !ok {
		return forbidden("Origin " + originOf(target) + " is not allowed for host execution.")
	}
	if isMetadataHost(target.Hostname()) {
		return forbidden("Host execution blocks link-local and cloud metadata endpoints.")
	}
	return nil
}

// dialContext resolves and validates every address, then connects to a validated IP instead of resolving twice.
func (e *HostExecution) dialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}
	if isMetadataHost(host) {
		return nil, forbidden("Host execution blocks link-local and cloud metadata endpoints.")
	}

	var addresses []net.IP
	if literal := net.ParseIP(strings.Trim(host, "[]")); literal != nil {
		addresses = []net.IP{literal}
	} else {
		resolved, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, upstream("Host execution could not resolve target hostname.")
		}
		for _, item := range resolved {
			addresses = append(addresses, item.IP)
		}
	}
	if len(addresses) == 0 {
		return nil, upstream("Host execution could not resolve target hostname.")
	}
	for _, ip := range addresses {
		if isMetadataAddress(ip) {
			return nil, forbidden("Host execution blocks DNS resolutions to link-local and cloud metadata endpoints.")
		}
	}

	dialer := &net.Dialer{}
	var lastErr error
	for _, ip := range addresses {
		candidate := net.JoinHostPort(ip.String(), port)
		conn, err := dialer.DialContext(ctx, network, candidate)
		if err == nil {
			return conn, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func parseIncomingMultipart(r *http.Request) (map[string]any, map[int]HostExecutionFile, error) {
	reader, err := r.MultipartReader()
	if err != nil {
		return nil, nil, badRequest("Host execution multipart body is invalid.")
	}
	var descriptor []byte
	files := map[int]HostExecutionFile{}
	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			var maxErr *http.MaxBytesError
			if errors.As(err, &maxErr) {
				return nil, nil, badRequest("Host execution request exceeded the 32 MiB safety limit.")
			}
			return nil, nil, badRequest("Host execution multipart body is invalid.")
		}
		data, err := io.ReadAll(part)
		_ = part.Close()
		if err != nil {
			var maxErr *http.MaxBytesError
			if errors.As(err, &maxErr) {
				return nil, nil, badRequest("Host execution request exceeded the 32 MiB safety limit.")
			}
			return nil, nil, badRequest("Unable to read multipart host execution upload.")
		}
		name := part.FormName()
		if name == "descriptor" {
			if descriptor != nil {
				return nil, nil, badRequest("Host execution multipart request contains multiple descriptors.")
			}
			descriptor = data
			continue
		}
		match := filePartPattern.FindStringSubmatch(name)
		if match == nil {
			continue
		}
		index, _ := strconv.Atoi(match[1])
		if _, exists := files[index]; exists {
			return nil, nil, badRequest(fmt.Sprintf("Host execution multipart request contains duplicate formData[%d] parts.", index))
		}
		files[index] = HostExecutionFile{Filename: part.FileName(), ContentType: part.Header.Get("Content-Type"), Data: data}
	}
	if descriptor == nil {
		return nil, nil, badRequest("Host execution multipart request requires a descriptor.")
	}
	var envelope map[string]any
	if !utf8.Valid(descriptor) {
		return nil, nil, badRequest("Host execution multipart descriptor must be valid UTF-8 JSON object.")
	}
	if err := json.Unmarshal(descriptor, &envelope); err != nil || envelope == nil {
		return nil, nil, badRequest("Host execution multipart descriptor must be valid UTF-8 JSON object.")
	}
	return envelope, files, nil
}

func writeReadError(w http.ResponseWriter, err error) {
	var maxErr *http.MaxBytesError
	if errors.As(err, &maxErr) {
		writeExecutionJSON(w, HostExecutionResult{Status: http.StatusBadRequest, Body: map[string]any{"error": "Host execution request exceeded the 32 MiB safety limit."}})
		return
	}
	writeExecutionJSON(w, HostExecutionResult{Status: http.StatusBadRequest, Body: map[string]any{"error": "Unable to read host execution request body."}})
}

func writeExecutionJSON(w http.ResponseWriter, result HostExecutionResult) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(result.Status)
	_ = json.NewEncoder(w).Encode(result.Body)
}

func prepareRequestBody(draft, envelope map[string]any, files map[int]HostExecutionFile, mode string) (preparedBody, error) {
	explicitType := stringValue(draft["contentType"])
	switch mode {
	case "none":
		return preparedBody{}, nil
	case "raw":
		return preparedBody{data: []byte(stringValue(draft["body"])), contentType: explicitType}, nil
	case "json":
		if explicitType == "" {
			explicitType = "application/json"
		}
		return preparedBody{data: []byte(stringValue(draft["body"])), contentType: explicitType}, nil
	case "binary":
		encoded := stringValue(envelope["bodyBase64"])
		if encoded == "" {
			return preparedBody{}, badRequest("Binary host execution requires bodyBase64.")
		}
		data, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			return preparedBody{}, badRequest("Binary host execution bodyBase64 is invalid.")
		}
		if explicitType == "" {
			if binary, ok := draft["binary"].(map[string]any); ok {
				explicitType = stringValue(binary["contentType"])
			}
		}
		if explicitType == "" {
			explicitType = "application/octet-stream"
		}
		return preparedBody{data: data, contentType: explicitType}, nil
	case "urlencoded":
		pairs := make([]string, 0)
		for _, entry := range entries(draft["urlencoded"]) {
			if entry["enabled"] == false || strings.TrimSpace(stringValue(entry["key"])) == "" {
				continue
			}
			pairs = append(pairs, url.QueryEscape(stringValue(entry["key"]))+"="+url.QueryEscape(stringValue(entry["value"])))
		}
		if explicitType == "" {
			explicitType = "application/x-www-form-urlencoded"
		}
		return preparedBody{data: []byte(strings.Join(pairs, "&")), contentType: explicitType}, nil
	case "graphql":
		graph, ok := draft["graphql"].(map[string]any)
		if !ok {
			return preparedBody{}, badRequest("GraphQL body must be an object.")
		}
		variables := any(map[string]any{})
		if raw := strings.TrimSpace(stringValue(graph["variables"])); raw != "" {
			if err := json.Unmarshal([]byte(raw), &variables); err != nil {
				return preparedBody{}, badRequest("GraphQL variables must be valid JSON.")
			}
		}
		data, _ := json.Marshal(map[string]any{"query": stringValue(graph["query"]), "variables": variables})
		if explicitType == "" {
			explicitType = "application/json"
		}
		return preparedBody{data: data, contentType: explicitType}, nil
	case "formdata":
		var out bytes.Buffer
		writer := multipart.NewWriter(&out)
		for index, entry := range entries(draft["formData"]) {
			if entry["enabled"] == false {
				continue
			}
			key := stringValue(entry["key"])
			if strings.TrimSpace(key) == "" {
				continue
			}
			if stringValue(entry["type"]) == "file" {
				file, ok := files[index]
				if !ok {
					return preparedBody{}, badRequest(fmt.Sprintf("File field %q needs an uploaded file part.", key))
				}
				filename := file.Filename
				if filename == "" {
					filename = stringValue(entry["fileName"])
				}
				if filename == "" {
					filename = "upload.bin"
				}
				contentType := file.ContentType
				if contentType == "" {
					contentType = stringValue(entry["contentType"])
				}
				if contentType == "" {
					contentType = "application/octet-stream"
				}
				headers := textproto.MIMEHeader{}
				headers.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, quoteMultipart(key), quoteMultipart(filename)))
				headers.Set("Content-Type", contentType)
				part, err := writer.CreatePart(headers)
				if err != nil {
					return preparedBody{}, badRequest("Unable to build multipart host execution body.")
				}
				_, _ = part.Write(file.Data)
			} else {
				part, err := writer.CreateFormField(key)
				if err != nil {
					return preparedBody{}, badRequest("Unable to build multipart host execution body.")
				}
				_, _ = io.WriteString(part, stringValue(entry["value"]))
			}
		}
		if err := writer.Close(); err != nil {
			return preparedBody{}, badRequest("Unable to build multipart host execution body.")
		}
		return preparedBody{data: out.Bytes(), contentType: writer.FormDataContentType()}, nil
	default:
		return preparedBody{}, badRequest("Body mode " + mode + " is not implemented by the Go host executor.")
	}
}

func inferBodyMode(draft map[string]any) string {
	if mode := strings.TrimSpace(stringValue(draft["bodyMode"])); mode != "" {
		return mode
	}
	if draft["binary"] != nil {
		return "binary"
	}
	if draft["formData"] != nil {
		return "formdata"
	}
	if draft["urlencoded"] != nil {
		return "urlencoded"
	}
	if draft["graphql"] != nil {
		return "graphql"
	}
	if draft["body"] == nil || stringValue(draft["body"]) == "" {
		return "none"
	}
	if strings.Contains(strings.ToLower(stringValue(draft["contentType"])), "json") {
		return "json"
	}
	return "raw"
}

func sanitizeHeaders(values []map[string]any) (http.Header, error) {
	headers := http.Header{}
	for _, entry := range values {
		if entry["enabled"] == false {
			continue
		}
		name := strings.TrimSpace(stringValue(entry["key"]))
		if name == "" {
			continue
		}
		normalized := strings.ToLower(name)
		if hopByHopHeaders[normalized] || strings.HasPrefix(normalized, "proxy-") || strings.HasPrefix(normalized, "sec-") || normalized == "origin" || normalized == "referer" {
			continue
		}
		value := stringValue(entry["value"])
		if !headerNamePattern.MatchString(name) || strings.ContainsAny(value, "\r\n") {
			return nil, badRequest("Invalid host execution request header: " + name)
		}
		headers.Add(name, value)
	}
	return headers, nil
}

func applyHeaderAuth(raw any, headers http.Header) error {
	auth, ok := raw.(map[string]any)
	if !ok {
		return nil
	}
	switch stringValue(auth["type"]) {
	case "", "none", "inherit":
		return nil
	case "bearer":
		if token := stringValue(auth["token"]); token != "" {
			headers.Set("Authorization", "Bearer "+token)
		}
		return nil
	case "oauth2":
		if token := stringValue(auth["accessToken"]); token != "" {
			headers.Set("Authorization", "Bearer "+token)
		}
		return nil
	case "basic":
		credential := stringValue(auth["username"]) + ":" + stringValue(auth["password"])
		headers.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(credential)))
		return nil
	case "apiKey":
		key := strings.TrimSpace(stringValue(auth["key"]))
		if key == "" {
			return badRequest("API key authentication requires a key name.")
		}
		switch stringValueDefault(auth["in"], "header") {
		case "header":
			if !headerNamePattern.MatchString(key) {
				return badRequest("Invalid host execution request header: " + key)
			}
			headers.Set(key, stringValue(auth["value"]))
			return nil
		case "query":
			return nil
		case "cookie":
			return badRequest("Cookie authentication is not implemented by the Go host executor.")
		default:
			return badRequest("Unsupported API key location: " + stringValue(auth["in"]))
		}
	default:
		return badRequest("Authentication type " + stringValue(auth["type"]) + " is not implemented by the Go host executor.")
	}
}

func applyQueryAuth(raw any, target *url.URL) error {
	auth, ok := raw.(map[string]any)
	if !ok || stringValue(auth["type"]) != "apiKey" || stringValue(auth["in"]) != "query" {
		return nil
	}
	key := strings.TrimSpace(stringValue(auth["key"]))
	if key == "" {
		return badRequest("API key authentication requires a key name.")
	}
	appendQuery(target, []map[string]any{{"key": key, "value": stringValue(auth["value"])}})
	return nil
}

func appendQuery(target *url.URL, values []map[string]any) {
	parts := make([]string, 0)
	for _, entry := range values {
		if entry["enabled"] == false {
			continue
		}
		key := strings.TrimSpace(stringValue(entry["key"]))
		if key == "" {
			continue
		}
		parts = append(parts, url.QueryEscape(key)+"="+url.QueryEscape(stringValue(entry["value"])))
	}
	if len(parts) == 0 {
		return
	}
	if target.RawQuery == "" {
		target.RawQuery = strings.Join(parts, "&")
	} else {
		target.RawQuery += "&" + strings.Join(parts, "&")
	}
}

func parseHTTPURL(raw string) (*url.URL, error) {
	target, err := url.Parse(raw)
	if err != nil || target == nil || (target.Scheme != "http" && target.Scheme != "https") || target.Hostname() == "" {
		return nil, errors.New("must be an absolute HTTP(S) URL")
	}
	return target, nil
}

func originOf(target *url.URL) string {
	host := strings.ToLower(target.Hostname())
	if strings.Contains(host, ":") {
		host = "[" + strings.Trim(host, "[]") + "]"
	}
	port := target.Port()
	if port == "" || (target.Scheme == "http" && port == "80") || (target.Scheme == "https" && port == "443") {
		return strings.ToLower(target.Scheme) + "://" + host
	}
	return strings.ToLower(target.Scheme) + "://" + host + ":" + port
}

func isMetadataHost(host string) bool {
	value := strings.ToLower(strings.Trim(host, "[]"))
	if value == "169.254.169.254" || value == "metadata.google.internal" || value == "metadata.google" || value == "fe80::a9fe:a9fe" || strings.HasPrefix(value, "fe80:") {
		return true
	}
	if ip := net.ParseIP(value); ip != nil {
		return isMetadataAddress(ip)
	}
	return false
}

func isMetadataAddress(ip net.IP) bool {
	if ip == nil {
		return false
	}
	return ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast()
}

func isRedirect(status int) bool {
	return status == http.StatusMovedPermanently || status == http.StatusFound || status == http.StatusSeeOther || status == http.StatusTemporaryRedirect || status == http.StatusPermanentRedirect
}

func entries(raw any) []map[string]any {
	values, ok := raw.([]any)
	if !ok {
		return nil
	}
	out := make([]map[string]any, 0, len(values))
	for _, value := range values {
		if entry, ok := value.(map[string]any); ok {
			out = append(out, entry)
		}
	}
	return out
}

func stringValue(raw any) string {
	switch value := raw.(type) {
	case nil:
		return ""
	case string:
		return value
	case bool:
		return strconv.FormatBool(value)
	case json.Number:
		return value.String()
	case float64:
		return strconv.FormatFloat(value, 'f', -1, 64)
	default:
		return fmt.Sprint(value)
	}
}

func stringValueDefault(raw any, fallback string) string {
	value := stringValue(raw)
	if value == "" {
		return fallback
	}
	return value
}

func durationMillis(raw any, fallback time.Duration) time.Duration {
	switch value := raw.(type) {
	case float64:
		return time.Duration(value * float64(time.Millisecond))
	case json.Number:
		if parsed, err := value.Float64(); err == nil {
			return time.Duration(parsed * float64(time.Millisecond))
		}
	case int:
		return time.Duration(value) * time.Millisecond
	case int64:
		return time.Duration(value) * time.Millisecond
	}
	return fallback
}

func cloneURL(source *url.URL) *url.URL {
	copy := *source
	if source.User != nil {
		user := *source.User
		copy.User = &user
	}
	return &copy
}

func quoteMultipart(value string) string {
	return strings.NewReplacer("\\", "\\\\", `"`, `\"`, "\r", "", "\n", "").Replace(value)
}
