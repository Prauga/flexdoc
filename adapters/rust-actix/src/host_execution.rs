use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use futures_util::StreamExt;
use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE},
    Method, Url,
};
use serde_json::{json, Map, Value};
use std::{
    collections::{HashMap, HashSet},
    fmt,
    net::{IpAddr, SocketAddr},
    str::FromStr,
    sync::Arc,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::net::lookup_host;

pub const MAX_EXECUTION_REQUEST_BYTES: usize = 32 * 1024 * 1024;
pub const MAX_EXECUTION_RESPONSE_BYTES: usize = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MIN_TIMEOUT_MS: u64 = 100;
const MAX_TIMEOUT_MS: u64 = 120_000;
const MAX_REDIRECTS: usize = 5;

/// One browser-uploaded canonical `formData[n]` file part.
#[derive(Clone, Debug)]
pub struct HostExecutionFile {
    pub filename: String,
    pub content_type: String,
    pub data: Vec<u8>,
}

/// Native execution result translated by the framework transport.
#[derive(Clone, Debug)]
pub struct HostExecutionResult {
    pub status: u16,
    pub body: Value,
}

/// Framework-neutral Rust implementation of FlexDoc's existing API-host envelope.
#[derive(Clone)]
pub struct HostExecution {
    allowed_origins: Arc<HashSet<String>>,
}

impl fmt::Debug for HostExecution {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("HostExecution")
            .field("allowed_origins", &self.allowed_origins)
            .finish_non_exhaustive()
    }
}

#[derive(Debug)]
struct ExecutionError {
    status: u16,
    message: String,
}

impl ExecutionError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: 400,
            message: message.into(),
        }
    }
    fn forbidden(message: impl Into<String>) -> Self {
        Self {
            status: 403,
            message: message.into(),
        }
    }
    fn upstream(message: impl Into<String>) -> Self {
        Self {
            status: 502,
            message: message.into(),
        }
    }
}

#[derive(Clone, Debug)]
struct PreparedBody {
    data: Vec<u8>,
    content_type: Option<String>,
}

impl HostExecution {
    /// Create a native executor with a non-empty exact HTTP(S) origin allowlist.
    pub fn new<I, S>(allowed_origins: I) -> Result<Self, String>
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        let mut normalized = HashSet::new();
        for raw in allowed_origins {
            let raw = raw.as_ref().trim();
            if raw.is_empty() {
                continue;
            }
            let url = parse_http_url(raw).map_err(|_| {
                format!("host execution allowed origin {raw:?} must be an absolute HTTP(S) origin")
            })?;
            if !url.username().is_empty()
                || url.password().is_some()
                || (url.path() != "/" && !url.path().is_empty())
                || url.query().is_some()
                || url.fragment().is_some()
            {
                return Err(format!("host execution allowed origins cannot contain credentials, paths, queries, or fragments: {raw}"));
            }
            normalized.insert(origin_of(&url));
        }
        if normalized.is_empty() {
            return Err("FlexDoc host execution requires at least one exact allowed origin".into());
        }
        Ok(Self {
            allowed_origins: Arc::new(normalized),
        })
    }

    /// Host-only capabilities implemented by this first Rust slice.
    pub fn capabilities(&self) -> &'static [&'static str] {
        &[]
    }

    /// Validate the marker and map execution errors into the canonical JSON error shape.
    pub async fn handle(
        &self,
        marker: Option<&str>,
        envelope: Value,
        files: HashMap<usize, HostExecutionFile>,
    ) -> HostExecutionResult {
        if marker != Some("1") {
            return HostExecutionResult {
                status: 403,
                body: json!({"error":"Missing X-FlexDoc-Execute header."}),
            };
        }
        match self.execute(envelope, files).await {
            Ok(body) => HostExecutionResult { status: 200, body },
            Err(error) => HostExecutionResult {
                status: error.status,
                body: json!({"error":error.message}),
            },
        }
    }

    async fn execute(
        &self,
        envelope: Value,
        files: HashMap<usize, HostExecutionFile>,
    ) -> Result<Value, ExecutionError> {
        let root = envelope.as_object().ok_or_else(|| {
            ExecutionError::bad_request("Host execution body must be a JSON object.")
        })?;
        if root.get("cookieJar").and_then(Value::as_str) == Some("session") {
            return Err(ExecutionError::bad_request(
                "Session cookie jars are not implemented by the Rust host executor.",
            ));
        }
        if root
            .get("certificateId")
            .and_then(Value::as_str)
            .is_some_and(|value| !value.trim().is_empty())
        {
            return Err(ExecutionError::bad_request(
                "Client certificates are not implemented by the Rust host executor.",
            ));
        }
        let draft = root
            .get("request")
            .and_then(Value::as_object)
            .ok_or_else(|| {
                ExecutionError::bad_request(
                    "Host execution body requires a canonical request draft.",
                )
            })?;
        let raw_url = string_value(draft.get("url"));
        if raw_url.trim().is_empty() {
            return Err(ExecutionError::bad_request(
                "Host execution requires an absolute request URL.",
            ));
        }
        let mut target = parse_http_url(&raw_url).map_err(|_| {
            ExecutionError::bad_request("Host execution requires an absolute HTTP(S) request URL.")
        })?;
        if !target.username().is_empty() || target.password().is_some() {
            return Err(ExecutionError::forbidden(
                "Host execution URLs cannot contain embedded credentials.",
            ));
        }
        append_query(&mut target, entries(draft.get("query")));

        let method_name = match string_value(draft.get("method"))
            .trim()
            .to_ascii_uppercase()
        {
            value if value.is_empty() => "GET".to_string(),
            value => value,
        };
        let method = Method::from_bytes(method_name.as_bytes()).map_err(|_| {
            ExecutionError::bad_request(format!(
                "Unsupported host execution HTTP method: {method_name}"
            ))
        })?;
        if !matches!(
            method.as_str(),
            "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS"
        ) {
            return Err(ExecutionError::bad_request(format!(
                "Unsupported host execution HTTP method: {method_name}"
            )));
        }

        let mut headers = sanitize_headers(entries(draft.get("headers")))?;
        apply_header_auth(draft.get("auth"), &mut headers)?;
        let mode = infer_body_mode(draft);
        let prepared = prepare_body(draft, root, &files, &mode)?;
        if mode == "formdata" {
            headers.remove(CONTENT_TYPE);
        }
        if let Some(content_type) = &prepared.content_type {
            if !headers.contains_key(CONTENT_TYPE) {
                let value = HeaderValue::from_str(content_type).map_err(|_| {
                    ExecutionError::bad_request("Host execution Content-Type is invalid.")
                })?;
                headers.insert(CONTENT_TYPE, value);
            }
        }

        let timeout_ms = root
            .get("timeoutMs")
            .and_then(Value::as_u64)
            .unwrap_or(DEFAULT_TIMEOUT_MS)
            .clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
        self.execute_with_redirects(
            method,
            target,
            headers,
            prepared.data,
            Duration::from_millis(timeout_ms),
            draft.get("auth"),
        )
        .await
    }

    async fn execute_with_redirects(
        &self,
        mut method: Method,
        mut current: Url,
        mut headers: HeaderMap,
        mut body: Vec<u8>,
        timeout: Duration,
        raw_auth: Option<&Value>,
    ) -> Result<Value, ExecutionError> {
        let operation = async {
            for redirect in 0..=MAX_REDIRECTS {
                let mut request_url = current.clone();
                apply_query_auth(raw_auth, &mut request_url)?;
                let validated_addresses = self.assert_allowed(&request_url).await?;

                let started = Instant::now();
                let host = request_url.host_str().unwrap_or_default();
                let mut client_builder = reqwest::Client::builder()
                    .redirect(reqwest::redirect::Policy::none())
                    .no_proxy();
                if host.parse::<IpAddr>().is_err() {
                    client_builder = client_builder.resolve_to_addrs(host, &validated_addresses);
                }
                let client = client_builder.build().map_err(|error| {
                    ExecutionError::upstream(format!(
                        "Host execution request client failed: {error}"
                    ))
                })?;
                let mut request = client
                    .request(method.clone(), request_url.clone())
                    .headers(headers.clone());
                if !body.is_empty() || !matches!(method, Method::GET | Method::HEAD) {
                    request = request.body(body.clone());
                }
                let response = request.send().await.map_err(|error| {
                    ExecutionError::upstream(format!("Host execution request failed: {error}"))
                })?;
                let status = response.status();
                let response_headers = response.headers().clone();

                if status.is_redirection() {
                    if let Some(location) = response_headers.get(reqwest::header::LOCATION) {
                        if redirect == MAX_REDIRECTS {
                            return Err(ExecutionError::forbidden(
                                "Host execution exceeded the redirect safety limit.",
                            ));
                        }
                        let location = location.to_str().map_err(|_| {
                            ExecutionError::bad_request(
                                "Host execution received an invalid redirect URL.",
                            )
                        })?;
                        let next = request_url.join(location).map_err(|_| {
                            ExecutionError::bad_request(
                                "Host execution received an invalid redirect URL.",
                            )
                        })?;
                        if origin_of(&next) != origin_of(&request_url) {
                            return Err(ExecutionError::forbidden(
                                "Host execution does not follow cross-origin redirects.",
                            ));
                        }
                        self.assert_allowed(&next).await?;
                        if status.as_u16() == 303 {
                            method = Method::GET;
                            body.clear();
                            headers.remove(CONTENT_TYPE);
                        }
                        current = next;
                        continue;
                    }
                }

                let mut data = Vec::new();
                let mut stream = response.bytes_stream();
                while let Some(chunk) = stream.next().await {
                    let chunk = chunk.map_err(|error| {
                        ExecutionError::upstream(format!(
                            "Host execution response read failed: {error}"
                        ))
                    })?;
                    if data.len().saturating_add(chunk.len()) > MAX_EXECUTION_RESPONSE_BYTES {
                        return Err(ExecutionError::upstream(
                            "Host execution response exceeded the 10 MiB safety limit.",
                        ));
                    }
                    data.extend_from_slice(&chunk);
                }
                let response_headers = response_headers
                    .iter()
                    .map(|(name, value)| json!([name.as_str(), value.to_str().unwrap_or_default()]))
                    .collect::<Vec<_>>();
                return Ok(json!({
                    "status": status.as_u16(),
                    "statusText": status.canonical_reason().unwrap_or(""),
                    "headers": response_headers,
                    "body": String::from_utf8_lossy(&data),
                    "responseTime": started.elapsed().as_millis() as u64,
                }));
            }
            Err(ExecutionError::forbidden(
                "Host execution exceeded the redirect safety limit.",
            ))
        };

        tokio::time::timeout(timeout, operation)
            .await
            .map_err(|_| {
                ExecutionError::upstream(format!(
                    "Host execution request timed out after {} ms.",
                    timeout.as_millis()
                ))
            })?
    }

    async fn assert_allowed(&self, target: &Url) -> Result<Vec<SocketAddr>, ExecutionError> {
        if !matches!(target.scheme(), "http" | "https") || target.host_str().is_none() {
            return Err(ExecutionError::forbidden(
                "Host execution only allows HTTP(S) URLs.",
            ));
        }
        if !target.username().is_empty() || target.password().is_some() {
            return Err(ExecutionError::forbidden(
                "Host execution URLs cannot contain embedded credentials.",
            ));
        }
        let origin = origin_of(target);
        if !self.allowed_origins.contains(&origin) {
            return Err(ExecutionError::forbidden(format!(
                "Origin {origin} is not allowed for host execution."
            )));
        }
        let host = target.host_str().unwrap_or_default();
        if is_metadata_host(host) {
            return Err(ExecutionError::forbidden(
                "Host execution blocks link-local and cloud metadata endpoints.",
            ));
        }
        let port = target
            .port_or_known_default()
            .unwrap_or(if target.scheme() == "https" { 443 } else { 80 });
        if let Ok(ip) = host.parse::<IpAddr>() {
            if is_metadata_address(ip) {
                return Err(ExecutionError::forbidden(
                    "Host execution blocks link-local and cloud metadata endpoints.",
                ));
            }
            return Ok(vec![SocketAddr::new(ip, port)]);
        }
        let resolved = lookup_host((host, port)).await.map_err(|_| {
            ExecutionError::upstream("Host execution could not resolve target hostname.")
        })?;
        let mut addresses = Vec::new();
        for address in resolved {
            if is_metadata_address(address.ip()) {
                return Err(ExecutionError::forbidden("Host execution blocks DNS resolutions to link-local and cloud metadata endpoints."));
            }
            addresses.push(address);
        }
        if addresses.is_empty() {
            return Err(ExecutionError::upstream(
                "Host execution could not resolve target hostname.",
            ));
        }
        Ok(addresses)
    }
}

fn prepare_body(
    draft: &Map<String, Value>,
    envelope: &Map<String, Value>,
    files: &HashMap<usize, HostExecutionFile>,
    mode: &str,
) -> Result<PreparedBody, ExecutionError> {
    let explicit_type = string_value(draft.get("contentType"));
    match mode {
        "none" => Ok(PreparedBody {
            data: vec![],
            content_type: None,
        }),
        "raw" => Ok(PreparedBody {
            data: string_value(draft.get("body")).into_bytes(),
            content_type: non_empty(explicit_type),
        }),
        "json" => Ok(PreparedBody {
            data: string_value(draft.get("body")).into_bytes(),
            content_type: Some(if explicit_type.is_empty() {
                "application/json".into()
            } else {
                explicit_type
            }),
        }),
        "binary" => {
            let encoded = string_value(envelope.get("bodyBase64"));
            if encoded.is_empty() {
                return Err(ExecutionError::bad_request(
                    "Binary host execution requires bodyBase64.",
                ));
            }
            let data = BASE64.decode(encoded).map_err(|_| {
                ExecutionError::bad_request("Binary host execution bodyBase64 is invalid.")
            })?;
            let nested = draft
                .get("binary")
                .and_then(Value::as_object)
                .and_then(|value| value.get("contentType"));
            let content_type = if !explicit_type.is_empty() {
                explicit_type
            } else {
                let nested = string_value(nested);
                if nested.is_empty() {
                    "application/octet-stream".into()
                } else {
                    nested
                }
            };
            Ok(PreparedBody {
                data,
                content_type: Some(content_type),
            })
        }
        "urlencoded" => {
            let mut serializer = url::form_urlencoded::Serializer::new(String::new());
            for entry in entries(draft.get("urlencoded")) {
                if !entry_enabled(entry) {
                    continue;
                }
                let key = string_value(entry.get("key"));
                if key.trim().is_empty() {
                    continue;
                }
                serializer.append_pair(&key, &string_value(entry.get("value")));
            }
            Ok(PreparedBody {
                data: serializer.finish().into_bytes(),
                content_type: Some(if explicit_type.is_empty() {
                    "application/x-www-form-urlencoded".into()
                } else {
                    explicit_type
                }),
            })
        }
        "graphql" => {
            let graph = draft
                .get("graphql")
                .and_then(Value::as_object)
                .ok_or_else(|| ExecutionError::bad_request("GraphQL body must be an object."))?;
            let variables_text = string_value(graph.get("variables"));
            let variables = if variables_text.trim().is_empty() {
                json!({})
            } else {
                serde_json::from_str::<Value>(&variables_text).map_err(|_| {
                    ExecutionError::bad_request("GraphQL variables must be valid JSON.")
                })?
            };
            let data = serde_json::to_vec(
                &json!({"query":string_value(graph.get("query")),"variables":variables}),
            )
            .unwrap_or_default();
            Ok(PreparedBody {
                data,
                content_type: Some(if explicit_type.is_empty() {
                    "application/json".into()
                } else {
                    explicit_type
                }),
            })
        }
        "formdata" => build_multipart(draft, files),
        other => Err(ExecutionError::bad_request(format!(
            "Body mode {other} is not implemented by the Rust host executor."
        ))),
    }
}

fn build_multipart(
    draft: &Map<String, Value>,
    files: &HashMap<usize, HostExecutionFile>,
) -> Result<PreparedBody, ExecutionError> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let boundary = format!("----flexdoc-rust-{nonce:x}");
    let mut out = Vec::new();
    for (index, entry) in entries(draft.get("formData")).enumerate() {
        if !entry_enabled(entry) {
            continue;
        }
        let key = string_value(entry.get("key"));
        if key.trim().is_empty() {
            continue;
        }
        out.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
        if string_value(entry.get("type")) == "file" {
            let file = files.get(&index).ok_or_else(|| {
                ExecutionError::bad_request(format!(
                    "File field {key:?} needs an uploaded file part."
                ))
            })?;
            let filename = if file.filename.is_empty() {
                let fallback = string_value(entry.get("fileName"));
                if fallback.is_empty() {
                    "upload.bin".into()
                } else {
                    fallback
                }
            } else {
                file.filename.clone()
            };
            let content_type = if file.content_type.is_empty() {
                let fallback = string_value(entry.get("contentType"));
                if fallback.is_empty() {
                    "application/octet-stream".into()
                } else {
                    fallback
                }
            } else {
                file.content_type.clone()
            };
            out.extend_from_slice(format!("Content-Disposition: form-data; name=\"{}\"; filename=\"{}\"\r\nContent-Type: {}\r\n\r\n", quote_multipart(&key), quote_multipart(&filename), content_type).as_bytes());
            out.extend_from_slice(&file.data);
            out.extend_from_slice(b"\r\n");
        } else {
            out.extend_from_slice(
                format!(
                    "Content-Disposition: form-data; name=\"{}\"\r\n\r\n{}\r\n",
                    quote_multipart(&key),
                    string_value(entry.get("value"))
                )
                .as_bytes(),
            );
        }
    }
    out.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
    Ok(PreparedBody {
        data: out,
        content_type: Some(format!("multipart/form-data; boundary={boundary}")),
    })
}

fn infer_body_mode(draft: &Map<String, Value>) -> String {
    let explicit = string_value(draft.get("bodyMode"));
    if !explicit.trim().is_empty() {
        return explicit;
    }
    if draft.get("binary").is_some() {
        return "binary".into();
    }
    if draft.get("formData").is_some() {
        return "formdata".into();
    }
    if draft.get("urlencoded").is_some() {
        return "urlencoded".into();
    }
    if draft.get("graphql").is_some() {
        return "graphql".into();
    }
    let body = string_value(draft.get("body"));
    if body.is_empty() {
        return "none".into();
    }
    if string_value(draft.get("contentType"))
        .to_ascii_lowercase()
        .contains("json")
    {
        "json".into()
    } else {
        "raw".into()
    }
}

fn sanitize_headers<'a>(
    values: impl Iterator<Item = &'a Map<String, Value>>,
) -> Result<HeaderMap, ExecutionError> {
    let mut headers = HeaderMap::new();
    for entry in values {
        if !entry_enabled(entry) {
            continue;
        }
        let name = string_value(entry.get("key"));
        if name.trim().is_empty() {
            continue;
        }
        let normalized = name.to_ascii_lowercase();
        if matches!(
            normalized.as_str(),
            "connection"
                | "keep-alive"
                | "proxy-authenticate"
                | "proxy-authorization"
                | "te"
                | "trailer"
                | "transfer-encoding"
                | "upgrade"
                | "host"
                | "content-length"
                | "set-cookie"
                | "origin"
                | "referer"
        ) || normalized.starts_with("proxy-")
            || normalized.starts_with("sec-")
        {
            continue;
        }
        let header_name = HeaderName::from_str(name.trim()).map_err(|_| {
            ExecutionError::bad_request(format!("Invalid host execution request header: {name}"))
        })?;
        let value_text = string_value(entry.get("value"));
        let value = HeaderValue::from_str(&value_text).map_err(|_| {
            ExecutionError::bad_request(format!("Invalid host execution request header: {name}"))
        })?;
        headers.append(header_name, value);
    }
    Ok(headers)
}

fn apply_header_auth(raw: Option<&Value>, headers: &mut HeaderMap) -> Result<(), ExecutionError> {
    let Some(auth) = raw.and_then(Value::as_object) else {
        return Ok(());
    };
    match string_value(auth.get("type")).as_str() {
        "" | "none" | "inherit" => Ok(()),
        "bearer" => {
            let token = string_value(auth.get("token"));
            if !token.is_empty() {
                insert_header(headers, "authorization", &format!("Bearer {token}"))?;
            }
            Ok(())
        }
        "oauth2" => {
            let token = string_value(auth.get("accessToken"));
            if !token.is_empty() {
                insert_header(headers, "authorization", &format!("Bearer {token}"))?;
            }
            Ok(())
        }
        "basic" => {
            let credential = format!(
                "{}:{}",
                string_value(auth.get("username")),
                string_value(auth.get("password"))
            );
            insert_header(
                headers,
                "authorization",
                &format!("Basic {}", BASE64.encode(credential)),
            )
        }
        "apiKey" => {
            let key = string_value(auth.get("key"));
            if key.trim().is_empty() {
                return Err(ExecutionError::bad_request(
                    "API key authentication requires a key name.",
                ));
            }
            match string_value_default(auth.get("in"), "header").as_str() {
                "header" => insert_header(headers, &key, &string_value(auth.get("value"))),
                "query" => Ok(()),
                "cookie" => Err(ExecutionError::bad_request(
                    "Cookie authentication is not implemented by the Rust host executor.",
                )),
                other => Err(ExecutionError::bad_request(format!(
                    "Unsupported API key location: {other}"
                ))),
            }
        }
        other => Err(ExecutionError::bad_request(format!(
            "Authentication type {other} is not implemented by the Rust host executor."
        ))),
    }
}

fn insert_header(headers: &mut HeaderMap, name: &str, value: &str) -> Result<(), ExecutionError> {
    let name = HeaderName::from_str(name).map_err(|_| {
        ExecutionError::bad_request(format!("Invalid host execution request header: {name}"))
    })?;
    let value = HeaderValue::from_str(value).map_err(|_| {
        ExecutionError::bad_request(format!("Invalid host execution request header: {name}"))
    })?;
    headers.insert(name, value);
    Ok(())
}

fn apply_query_auth(raw: Option<&Value>, target: &mut Url) -> Result<(), ExecutionError> {
    let Some(auth) = raw.and_then(Value::as_object) else {
        return Ok(());
    };
    if string_value(auth.get("type")) != "apiKey" || string_value(auth.get("in")) != "query" {
        return Ok(());
    }
    let key = string_value(auth.get("key"));
    if key.trim().is_empty() {
        return Err(ExecutionError::bad_request(
            "API key authentication requires a key name.",
        ));
    }
    target
        .query_pairs_mut()
        .append_pair(&key, &string_value(auth.get("value")));
    Ok(())
}

fn append_query<'a>(target: &mut Url, values: impl Iterator<Item = &'a Map<String, Value>>) {
    for entry in values {
        if !entry_enabled(entry) {
            continue;
        }
        let key = string_value(entry.get("key"));
        if key.trim().is_empty() {
            continue;
        }
        target
            .query_pairs_mut()
            .append_pair(&key, &string_value(entry.get("value")));
    }
}

fn parse_http_url(raw: &str) -> Result<Url, url::ParseError> {
    let url = Url::parse(raw)?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err(url::ParseError::RelativeUrlWithoutBase);
    }
    Ok(url)
}

fn origin_of(url: &Url) -> String {
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let default_port = if url.scheme() == "https" { 443 } else { 80 };
    match url.port() {
        Some(port) if port != default_port => format!(
            "{}://{}:{}",
            url.scheme().to_ascii_lowercase(),
            display_host(&host),
            port
        ),
        _ => format!(
            "{}://{}",
            url.scheme().to_ascii_lowercase(),
            display_host(&host)
        ),
    }
}

fn display_host(host: &str) -> String {
    if host.contains(':') && !host.starts_with('[') {
        format!("[{host}]")
    } else {
        host.to_string()
    }
}

fn is_metadata_host(host: &str) -> bool {
    let host = host.trim_matches(&['[', ']'][..]).to_ascii_lowercase();
    matches!(
        host.as_str(),
        "169.254.169.254" | "metadata.google.internal" | "metadata.google" | "fe80::a9fe:a9fe"
    ) || host.starts_with("fe80:")
        || host.parse::<IpAddr>().is_ok_and(is_metadata_address)
}

fn is_metadata_address(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ip.is_link_local(),
        IpAddr::V6(ip) => ip.is_unicast_link_local(),
    }
}

fn entries(raw: Option<&Value>) -> impl Iterator<Item = &Map<String, Value>> {
    raw.and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_object)
}

fn entry_enabled(entry: &Map<String, Value>) -> bool {
    entry.get("enabled").and_then(Value::as_bool) != Some(false)
}
fn string_value(raw: Option<&Value>) -> String {
    match raw {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(value)) => value.clone(),
        Some(Value::Bool(value)) => value.to_string(),
        Some(Value::Number(value)) => value.to_string(),
        Some(value) => value.to_string(),
    }
}
fn string_value_default(raw: Option<&Value>, fallback: &str) -> String {
    let value = string_value(raw);
    if value.is_empty() {
        fallback.into()
    } else {
        value
    }
}
fn non_empty(value: String) -> Option<String> {
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}
fn quote_multipart(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace(['\r', '\n'], "")
}
