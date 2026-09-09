# frozen_string_literal: true

require "json"
require "minitest/autorun"
require "rack/mock"
require "socket"
require_relative "../lib/prauga/flexdoc"

class FlexDocHostExecutionTest < Minitest::Test
  class LoopbackTarget
    attr_reader :base

    def initialize
      @server = TCPServer.new("127.0.0.1", 0)
      @base = "http://127.0.0.1:#{@server.addr[1]}"
      @thread = Thread.new { serve }
    end

    def close
      @server.close
      @thread.join(1)
    rescue IOError
      nil
    end

    private

    def serve
      loop do
        socket = @server.accept
        handle(socket)
      rescue IOError, Errno::EBADF
        break
      rescue StandardError
        socket&.close
      end
    end

    def handle(socket)
      request_line = socket.gets("\r\n")
      return unless request_line
      method, target = request_line.split(" ", 3)
      headers = {}
      while (line = socket.gets("\r\n")) && line != "\r\n"
        name, value = line.split(":", 2)
        headers[name.downcase] = value.to_s.strip if value
      end
      body = socket.read(headers.fetch("content-length", "0").to_i).to_s

      case target
      when %r{\A/redirect}
        respond(socket, 307, "Temporary Redirect", "", "location" => "/echo?redirected=1")
      when %r{\A/cross-origin}
        respond(socket, 302, "Found", "", "location" => "https://example.com/elsewhere")
      when %r{\A/slow}
        socket.write("HTTP/1.1 200 OK\r\nContent-Length: 4\r\nConnection: close\r\n\r\n")
        socket.flush
        sleep 0.25
        socket.write("late")
      when %r{\A/large}
        size = Prauga::FlexDoc::HostExecution::MAX_EXECUTION_RESPONSE_BYTES + 1
        socket.write("HTTP/1.1 200 OK\r\nContent-Length: #{size}\r\nConnection: close\r\n\r\n")
        chunk = "x" * 65_536
        remaining = size
        while remaining.positive?
          data = chunk.byteslice(0, [remaining, chunk.bytesize].min)
          socket.write(data)
          remaining -= data.bytesize
        end
      else
        payload = JSON.generate(
          "method" => method,
          "uri" => target,
          "headers" => headers,
          "body" => body
        )
        respond(socket, 200, "OK", payload, "content-type" => "application/json")
      end
    ensure
      socket.close
    end

    def respond(socket, status, message, body, headers = {})
      values = {
        "content-length" => body.bytesize.to_s,
        "connection" => "close"
      }.merge(headers)
      socket.write("HTTP/1.1 #{status} #{message}\r\n")
      values.each { |name, value| socket.write("#{name}: #{value}\r\n") }
      socket.write("\r\n#{body}")
    end
  end

  def with_target
    target = LoopbackTarget.new
    yield target
  ensure
    target&.close
  end

  def app_for(origin)
    executor = Prauga::FlexDoc::HostExecution.new(allowed_origins: [origin])
    host = Prauga::FlexDoc::Host.new(
      Prauga::FlexDoc::Config.new(try_it_host_execution: true),
      host_execution: executor
    )
    Prauga::FlexDoc::RackApp.new(host)
  end

  def post_json(app, envelope, marker: true)
    options = {
      "CONTENT_TYPE" => "application/json",
      input: JSON.generate(envelope)
    }
    options["HTTP_X_FLEXDOC_EXECUTE"] = "1" if marker
    Rack::MockRequest.new(app).post("/docs/__flexdoc/execute", options)
  end

  def inner_response(response)
    JSON.parse(JSON.parse(response.body).fetch("body"))
  end

  def test_route_requires_marker_and_returns_no_store_json
    with_target do |target|
      response = post_json(
        app_for(target.base),
        { "request" => { "url" => "#{target.base}/echo", "method" => "GET" } },
        marker: false
      )
      assert_equal 403, response.status
      assert_equal "no-store", response["cache-control"]
      assert_equal "Missing X-FlexDoc-Execute header.", JSON.parse(response.body)["error"]
    end
  end

  def test_preserves_encoded_query_and_strips_unsafe_headers
    with_target do |target|
      response = post_json(app_for(target.base), {
        "request" => {
          "url" => "#{target.base}/echo?encoded=%2F",
          "method" => "POST",
          "query" => [{ "key" => "added", "value" => "hello world" }],
          "headers" => [
            { "key" => "X-Flex-Test", "value" => "yes" },
            { "key" => "Origin", "value" => "https://evil.example" },
            { "key" => "Host", "value" => "evil.example" }
          ],
          "bodyMode" => "raw",
          "body" => "payload",
          "contentType" => "text/plain"
        }
      })
      assert_equal 200, response.status, response.body
      echoed = inner_response(response)
      assert_includes echoed["uri"], "encoded=%2F"
      assert_match(/added=hello(?:\+|%20)world/, echoed["uri"])
      assert_equal "yes", echoed["headers"]["x-flex-test"]
      refute_equal "https://evil.example", echoed["headers"]["origin"]
      refute_equal "evil.example", echoed["headers"]["host"]
      assert_equal "payload", echoed["body"]
    end
  end

  def test_reapplies_query_api_key_after_same_origin_redirect
    with_target do |target|
      response = post_json(app_for(target.base), {
        "request" => {
          "url" => "#{target.base}/redirect",
          "method" => "GET",
          "auth" => { "type" => "apiKey", "in" => "query", "key" => "token", "value" => "secret" }
        }
      })
      assert_equal 200, response.status, response.body
      uri = inner_response(response)["uri"]
      assert_includes uri, "redirected=1"
      assert_includes uri, "token=secret"
    end
  end

  def test_rejects_cross_origin_redirects
    with_target do |target|
      response = post_json(app_for(target.base), {
        "request" => { "url" => "#{target.base}/cross-origin", "method" => "GET" }
      })
      assert_equal 403, response.status
      assert_includes JSON.parse(response.body)["error"], "cross-origin redirects"
    end
  end

  def test_forwards_canonical_multipart_file_envelope
    with_target do |target|
      descriptor = JSON.generate(
        "request" => {
          "url" => "#{target.base}/echo",
          "method" => "POST",
          "bodyMode" => "formdata",
          "formData" => [
            { "key" => "upload", "type" => "file", "enabled" => true, "fileName" => "fallback.txt", "contentType" => "text/plain" },
            { "key" => "note", "value" => "hello", "enabled" => true }
          ]
        }
      )
      boundary = "----flexdoc-ruby-test"
      body = +"--#{boundary}\r\nContent-Disposition: form-data; name=\"descriptor\"\r\nContent-Type: application/json\r\n\r\n#{descriptor}\r\n"
      body << "--#{boundary}\r\nContent-Disposition: form-data; name=\"formData[0]\"; filename=\"actual.txt\"\r\nContent-Type: text/plain\r\n\r\nfile-bytes\r\n--#{boundary}--\r\n"
      response = Rack::MockRequest.new(app_for(target.base)).post(
        "/docs/__flexdoc/execute",
        "CONTENT_TYPE" => "multipart/form-data; boundary=#{boundary}",
        "HTTP_X_FLEXDOC_EXECUTE" => "1",
        input: body
      )
      assert_equal 200, response.status, response.body
      forwarded = inner_response(response)["body"]
      assert_includes forwarded, 'name="upload"'
      assert_includes forwarded, 'filename="actual.txt"'
      assert_includes forwarded, "file-bytes"
      assert_includes forwarded, 'name="note"'
      assert_includes forwarded, "hello"
    end
  end

  def test_blocks_metadata_targets_before_connection
    app = app_for("http://169.254.169.254")
    response = post_json(app, {
      "request" => { "url" => "http://169.254.169.254/latest/meta-data", "method" => "GET" }
    })
    assert_equal 403, response.status
    assert_includes JSON.parse(response.body)["error"], "metadata"
  end

  def test_enforces_full_response_deadline
    with_target do |target|
      response = post_json(app_for(target.base), {
        "timeoutMs" => 100,
        "request" => { "url" => "#{target.base}/slow", "method" => "GET" }
      })
      assert_equal 502, response.status
      assert_includes JSON.parse(response.body)["error"], "timed out"
    end
  end

  def test_rejects_responses_larger_than_ten_mib
    with_target do |target|
      response = post_json(app_for(target.base), {
        "request" => { "url" => "#{target.base}/large", "method" => "GET" }
      })
      assert_equal 502, response.status
      assert_includes JSON.parse(response.body)["error"], "10 MiB"
    end
  end

  def test_host_advertisement_is_truthful
    unavailable = Prauga::FlexDoc::Host.new(Prauga::FlexDoc::Config.new(try_it_host_execution: true))
    unavailable_options = JSON.parse(
      unavailable.documentation.body.match(/window\.__FLEXDOC_OPTIONS__=(.*?);<\/script>/)[1]
    )
    assert_equal false, unavailable_options.dig("tryIt", "hostExecution", "available")

    executor = Prauga::FlexDoc::HostExecution.new(allowed_origins: ["https://api.example.test"])
    available = Prauga::FlexDoc::Host.new(
      Prauga::FlexDoc::Config.new(try_it_host_execution: true),
      host_execution: executor
    )
    available_options = JSON.parse(
      available.documentation.body.match(/window\.__FLEXDOC_OPTIONS__=(.*?);<\/script>/)[1]
    )
    assert_equal true, available_options.dig("tryIt", "hostExecution", "available")
    assert_equal [], available_options.dig("tryIt", "hostExecution", "capabilities")
  end
end
