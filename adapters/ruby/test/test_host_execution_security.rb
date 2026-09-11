# frozen_string_literal: true

require "json"
require "minitest/autorun"
require "rack/mock"
require "socket"
require_relative "../lib/prauga/flexdoc"

class FlexDocHostExecutionSecurityTest < Minitest::Test
  def host_for(origin)
    executor = Prauga::FlexDoc::HostExecution.new(allowed_origins: [origin])
    Prauga::FlexDoc::Host.new(
      Prauga::FlexDoc::Config.new(try_it_host_execution: true),
      host_execution: executor
    )
  end

  def post_json(host, request)
    Rack::MockRequest.new(Prauga::FlexDoc::RackApp.new(host)).post(
      "/docs/__flexdoc/execute",
      "CONTENT_TYPE" => "application/json",
      "HTTP_X_FLEXDOC_EXECUTE" => "1",
      input: JSON.generate("request" => request)
    )
  end

  def test_missing_marker_is_rejected_before_malformed_body_is_parsed
    app = Prauga::FlexDoc::RackApp.new(host_for("https://api.example.test"))
    response = Rack::MockRequest.new(app).post(
      "/docs/__flexdoc/execute",
      "CONTENT_TYPE" => "application/json",
      input: "not-json"
    )

    assert_equal 403, response.status
    assert_equal "no-store", response["cache-control"]
    assert_equal "Missing X-FlexDoc-Execute header.", JSON.parse(response.body).fetch("error")
  end

  def test_rejects_non_allowlisted_origin_before_network_access
    response = post_json(
      host_for("https://api.example.test"),
      { "url" => "https://other.example.test/private", "method" => "GET" }
    )

    assert_equal 403, response.status
    assert_includes JSON.parse(response.body).fetch("error"), "not allowed"
  end

  def test_auth_api_key_cannot_restore_unsafe_transport_header
    response = post_json(
      host_for("https://api.example.test"),
      {
        "url" => "https://api.example.test/private",
        "method" => "GET",
        "auth" => { "type" => "apiKey", "in" => "header", "key" => " Host ", "value" => "evil.example" }
      }
    )

    assert_equal 400, response.status
    assert_includes JSON.parse(response.body).fetch("error"), "Unsafe host execution request header"
  end

  def test_blocks_ipv4_mapped_link_local_metadata_address
    origin = "http://[::ffff:169.254.169.254]"
    response = post_json(
      host_for(origin),
      { "url" => "#{origin}/latest/meta-data", "method" => "GET" }
    )

    assert_equal 403, response.status
    assert_includes JSON.parse(response.body).fetch("error"), "metadata"
  end

  def test_dns_validation_pins_connection_and_ignores_environment_proxy
    server = TCPServer.new("127.0.0.1", 0)
    port = server.addr[1]
    captured_host = Queue.new
    thread = Thread.new do
      socket = server.accept
      request_line = socket.gets("\r\n")
      headers = {}
      while (line = socket.gets("\r\n")) && line != "\r\n"
        name, value = line.split(":", 2)
        headers[name.downcase] = value.to_s.strip if value
      end
      captured_host << headers["host"]
      body = JSON.generate("requestLine" => request_line.to_s.strip)
      socket.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: #{body.bytesize}\r\nConnection: close\r\n\r\n#{body}")
    ensure
      socket&.close
    end

    origin = "http://pin.flexdoc.test:#{port}"
    app = Prauga::FlexDoc::RackApp.new(host_for(origin))
    address = Addrinfo.tcp("127.0.0.1", port)
    previous_proxy = ENV["http_proxy"]
    ENV["http_proxy"] = "http://127.0.0.1:1"

    response = Addrinfo.stub(:getaddrinfo, [address]) do
      Rack::MockRequest.new(app).post(
        "/docs/__flexdoc/execute",
        "CONTENT_TYPE" => "application/json",
        "HTTP_X_FLEXDOC_EXECUTE" => "1",
        input: JSON.generate(
          "request" => {
            "url" => "#{origin}/echo",
            "method" => "GET"
          }
        )
      )
    end

    assert_equal 200, response.status, response.body
    assert_equal "pin.flexdoc.test:#{port}", captured_host.pop
  ensure
    ENV["http_proxy"] = previous_proxy
    server&.close
    thread&.join(1)
  end
end
