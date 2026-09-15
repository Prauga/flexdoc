use prauga_flexdoc_actix::HostExecution;
use serde_json::json;
use std::collections::HashMap;

#[tokio::test]
async fn security_contract_is_fail_closed() {
    let executor = HostExecution::new(["https://api.example.test"]).unwrap();

    assert!(executor.capabilities().is_empty());

    let missing_marker = executor
        .handle(
            None,
            json!({"request":{"url":"https://api.example.test/pets"}}),
            HashMap::new(),
        )
        .await;
    assert_eq!(missing_marker.status, 403);
    assert_eq!(missing_marker.body["error"], "Missing X-FlexDoc-Execute header.");

    let blocked_origin = executor
        .handle(
            Some("1"),
            json!({"request":{"url":"https://blocked.example/private"}}),
            HashMap::new(),
        )
        .await;
    assert_eq!(blocked_origin.status, 403);
    assert!(blocked_origin.body["error"].as_str().unwrap().contains("not allowed"));

    let embedded_credentials = executor
        .handle(
            Some("1"),
            json!({"request":{"url":"https://user:secret@api.example.test/private"}}),
            HashMap::new(),
        )
        .await;
    assert_eq!(embedded_credentials.status, 403);
    assert!(embedded_credentials.body["error"]
        .as_str()
        .unwrap()
        .contains("embedded credentials"));

    let crlf_header = executor
        .handle(
            Some("1"),
            json!({"request":{
                "url":"https://api.example.test/pets",
                "headers":[{"key":"X-Test","value":"safe\r\nX-Injected: 1"}]
            }}),
            HashMap::new(),
        )
        .await;
    assert_eq!(crlf_header.status, 400);
    assert!(crlf_header.body["error"].as_str().unwrap().contains("header"));

    let unsupported_auth = executor
        .handle(
            Some("1"),
            json!({"request":{
                "url":"https://api.example.test/pets",
                "auth":{"type":"digest","username":"alice","password":"secret"}
            }}),
            HashMap::new(),
        )
        .await;
    assert_eq!(unsupported_auth.status, 400);
    assert!(unsupported_auth.body["error"].as_str().unwrap().contains("not implemented"));
}

#[tokio::test]
async fn metadata_policy_overrides_explicit_allowlisting() {
    let executor = HostExecution::new(["http://169.254.169.254"]).unwrap();
    let result = executor
        .handle(
            Some("1"),
            json!({"request":{"url":"http://169.254.169.254/latest/meta-data"}}),
            HashMap::new(),
        )
        .await;

    assert_eq!(result.status, 403);
    assert!(result.body["error"].as_str().unwrap().contains("metadata"));
}
