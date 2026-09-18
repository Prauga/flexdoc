# frozen_string_literal: true

require "json"
require "minitest/autorun"
require "rack/mock"
require "socket"
require_relative "../lib/prauga/flexdoc"

class FlexDocHostExecutionHttpSecurityTest < Minitest::Test
  def app_for(origin)
    executor = Prauga::FlexDoc::HostExecution.new(allowed_origins: [origin])
    host = Prauga::FlexDoc::Host.new(
      Prauga::FlexDoc::Config.new(try_it_host_execution: true),
      host_execution: executor
    )
    Prauga::FlexDoc::RackApp.new(host, host_execution_protected: true)
  end

  def test_rejects_cross_origin_redirect_before_metadata_second_hop
    server = TCPServer.new("127.0.0.1", 0)
    port = server.addr[1]
    thread = Thread.new do
      socket = server.accept
      socket.gets("\r\n")
      while (line = socket.gets("\r\n")) && line != "\r\n"; end
      socket.write(
        "HTTP/1.1 302 Found\r\n" \
        "Location: http://169.254.169.254/latest/meta-data/\r\n" \
        "Content-Length: 0\r\n" \
        "Connection: close\r\n\r\n"
      )
    ensure
      socket&.close
    end

    origin = "http://127.0.0.1:#{port}"
    response = Rack::MockRequest.new(app_for(origin)).post(
      "/docs/__flexdoc/execute",
      "CONTENT_TYPE" => "application/json",
      "HTTP_X_FLEXDOC_EXECUTE" => "1",
      input: JSON.generate("request" => { "method" => "GET", "url" => "#{origin}/redirect" })
    )

    assert_equal 403, response.status
    assert_includes JSON.parse(response.body).fetch("error"), "cross-origin"
  ensure
    server&.close
    thread&.join(1)
  end

  def test_execute_route_method_and_media_type_are_fail_closed
    request = Rack::MockRequest.new(app_for("https://api.example.test"))

    method_response = request.get("/docs/__flexdoc/execute")
    assert_equal 404, method_response.status

    media_response = request.post(
      "/docs/__flexdoc/execute",
      "CONTENT_TYPE" => "text/plain",
      "HTTP_X_FLEXDOC_EXECUTE" => "1",
      input: "{}"
    )
    assert_equal 400, media_response.status
    assert_includes JSON.parse(media_response.body).fetch("error"), "application/json or multipart/form-data"
  end
end
