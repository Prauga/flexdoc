# frozen_string_literal: true

require "base64"
require "ipaddr"
require "json"
require "net/http"
require "securerandom"
require "socket"
require "timeout"
require "uri"

require_relative "host_execution_observability"

module Prauga
  module FlexDoc
    HostExecutionFile = Data.define(:filename, :content_type, :data)
    HostExecutionResult = Data.define(:status, :body)

    # Framework-neutral implementation of FlexDoc's existing API-host execution envelope.
    class HostExecution
      MAX_EXECUTION_REQUEST_BYTES = 32 * 1024 * 1024
      MAX_EXECUTION_RESPONSE_BYTES = 10 * 1024 * 1024
      DEFAULT_TIMEOUT_MS = 30_000
      MIN_TIMEOUT_MS = 100
      MAX_TIMEOUT_MS = 120_000
      MAX_REDIRECTS = 5
      UNSAFE_HEADERS = %w[
        connection keep-alive proxy-authenticate proxy-authorization te trailer
        transfer-encoding upgrade host content-length set-cookie origin referer
      ].freeze
      METADATA_HOSTS = %w[169.254.169.254 metadata.google.internal metadata.google].freeze
      LINK_LOCAL_V4 = IPAddr.new("169.254.0.0/16")
      LINK_LOCAL_V6 = IPAddr.new("fe80::/10")
      SUPPORTED_METHODS = %w[GET HEAD POST PUT PATCH DELETE OPTIONS].freeze

      attr_reader :allowed_origins

      def initialize(allowed_origins:, metric_sink: nil)
        @metric_sink = metric_sink
        normalized = Array(allowed_origins).filter_map do |raw|
          value = raw.to_s.strip
          next if value.empty?

          uri = parse_http_uri(value)
          unless uri.userinfo.nil? && [nil, "", "/"].include?(uri.path) && uri.query.nil? && uri.fragment.nil?
            raise ArgumentError,
                  "host execution allowed origins cannot contain credentials, paths, queries, or fragments: #{value}"
          end
          origin_of(uri)
        rescue URI::InvalidURIError
          raise ArgumentError, "host execution allowed origin #{value.inspect} must be an absolute HTTP(S) origin"
        end
        raise ArgumentError, "FlexDoc host execution requires at least one exact allowed origin" if normalized.empty?

        @allowed_origins = normalized.uniq.freeze
      end

      attr_reader :metric_sink

      def capabilities
        []
      end

      # Validate the marker and map executor failures to canonical JSON errors.
      #
      # This is the single choke point every transport reaches, so it is also where
      # execution evidence is emitted: one started/completed pair per validated
      # envelope, and an unmarked counter for requests that never became executions.
      def handle(marker:, envelope:, files: {})
        unless marker == "1"
          # Counted outside the lifecycle: an unmarked request never became an
          # execution, and folding it into rejections would double-count attempts.
          metric("flexdoc_execute_unmarked_total", "counter", 1, { "reason" => "marker-missing" })
          return HostExecutionResult.new(status: 403, body: { "error" => "Missing X-FlexDoc-Execute header." })
        end

        metric("flexdoc_execute_requests_total", "counter", 1)
        metric("flexdoc_execute_in_flight", "gauge", 1)
        started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        begin
          body = execute(envelope, files)
        rescue ExecutionError => error
          complete(error.status >= 500 ? "error" : "rejected", started, error.reason, error.status)
          return HostExecutionResult.new(status: error.status, body: { "error" => error.message })
        rescue StandardError
          complete("error", started, "upstream-error", 502)
          raise
        end
        complete("success", started)
        HostExecutionResult.new(status: 200, body:)
      end

      private

      class ExecutionError < StandardError
        attr_reader :status, :reason

        # Messages interpolate origins, field names and methods, so they are
        # unbounded and cannot be aggregated. The reason can, and it matches the
        # Node, Python, Go and Rust vocabulary exactly.
        def initialize(status, message, reason)
          @status = status
          @reason = reason
          super(message)
        end
      end

      def bad_request(message, reason = "request-invalid") = raise(ExecutionError.new(400, message, reason))
      def unsupported(message, reason = "auth-unsupported") = raise(ExecutionError.new(400, message, reason))
      def forbidden(message, reason = "destination-forbidden") = raise(ExecutionError.new(403, message, reason))
      def upstream(message, reason = "upstream-error") = raise(ExecutionError.new(502, message, reason))

      def complete(outcome, started, reason = nil, status = nil)
        metric("flexdoc_execute_in_flight", "gauge", -1)
        metric("flexdoc_execute_completions_total", "counter", 1, { "outcome" => outcome })
        elapsed = [Process.clock_gettime(Process::CLOCK_MONOTONIC) - started, 0.0].max
        metric("flexdoc_execute_duration_seconds", "histogram", elapsed, { "outcome" => outcome })
        return if reason.nil?

        if outcome == "rejected"
          metric("flexdoc_execute_rejections_total", "counter", 1,
                 { "source" => "route", "statusCode" => (status || 400).to_s, "reason" => reason })
        else
          metric("flexdoc_execute_errors_total", "counter", 1, { "reason" => reason })
        end
      end

      def metric(name, kind, value, labels = {})
        return if @metric_sink.nil?

        @metric_sink.call(HostExecutionMetric.new(name:, kind:, value:, labels:))
      rescue StandardError
        # Observability must never decide whether an execution succeeds.
        nil
      end

      def execute(envelope, files)
        root = envelope.is_a?(Hash) ? envelope : bad_request("Host execution body must be a JSON object.", "body-malformed")
        unsupported("Session cookie jars are not implemented by the Ruby host executor.") if root["cookieJar"] == "session"
        certificate_id = root["certificateId"].to_s
        unsupported("Client certificates are not implemented by the Ruby host executor.") unless certificate_id.strip.empty?

        draft = root["request"]
        bad_request("Host execution body requires a canonical request draft.") unless draft.is_a?(Hash)

        raw_url = string_value(draft["url"])
        bad_request("Host execution requires an absolute request URL.") if raw_url.strip.empty?
        target = parse_http_uri(raw_url)
        forbidden("Host execution URLs cannot contain embedded credentials.") unless target.userinfo.nil?
        append_query!(target, entries(draft["query"]))

        method = string_value(draft["method"]).strip.upcase
        method = "GET" if method.empty?
        bad_request("Unsupported host execution HTTP method: #{method}") unless SUPPORTED_METHODS.include?(method)

        headers = sanitize_headers(entries(draft["headers"]))
        apply_header_auth!(draft["auth"], headers)
        mode = infer_body_mode(draft)
        body, content_type = prepare_body(draft, root, files, mode)
        headers.delete("content-type") if mode == "formdata"
        headers["content-type"] ||= [content_type] if content_type

        timeout_ms = integer_value(root["timeoutMs"], DEFAULT_TIMEOUT_MS).clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
        execute_with_redirects(method, target, headers, body, timeout_ms, draft["auth"])
      rescue URI::InvalidURIError
        bad_request("Host execution requires an absolute HTTP(S) request URL.")
      end

      def execute_with_redirects(method, current, headers, body, timeout_ms, auth)
        Timeout.timeout(timeout_ms / 1000.0) do
          (0..MAX_REDIRECTS).each do |redirect_count|
            request_uri = current.dup
            apply_query_auth!(auth, request_uri)
            validated_ip = assert_allowed!(request_uri)

            started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
            response = perform_request(method, request_uri, headers, body, timeout_ms, validated_ip)
            status = response[:status]

            if status.between?(300, 399) && response[:location]
              forbidden("Host execution exceeded the redirect safety limit.", "redirect-forbidden") if redirect_count == MAX_REDIRECTS
              next_uri = request_uri.merge(response[:location])
              forbidden("Host execution does not follow cross-origin redirects.", "redirect-forbidden") unless origin_of(next_uri) == origin_of(request_uri)
              assert_allowed!(next_uri)
              if status == 303
                method = "GET"
                body = "".b
                headers = headers.reject { |name, _| name == "content-type" }
              end
              current = next_uri
              next
            end

            elapsed = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round
            return {
              "status" => status,
              "statusText" => response[:message],
              "headers" => response[:headers],
              "body" => response[:body].dup.force_encoding(Encoding::UTF_8).scrub,
              "responseTime" => elapsed
            }
          end
        end
        forbidden("Host execution exceeded the redirect safety limit.", "redirect-forbidden")
      rescue Timeout::Error
        upstream("Host execution request timed out after #{timeout_ms} ms.", "upstream-timeout")
      rescue ExecutionError
        raise
      rescue StandardError => error
        upstream("Host execution request failed: #{error.message}", "upstream-unreachable")
      end

      def perform_request(method, uri, headers, body, timeout_ms, validated_ip)
        request = Net::HTTPGenericRequest.new(method, true, method != "HEAD", uri.request_uri, {})
        headers.each do |name, values|
          Array(values).each { |value| request.add_field(name, value) }
        end
        request.body = body unless body.empty? && %w[GET HEAD].include?(method)

        response_body = "".b
        response_headers = nil
        status = nil
        message = nil
        location = nil
        seconds = timeout_ms / 1000.0

        # Disable environment proxies and pin the connection to the address validated above.
        # Net::HTTP keeps +uri.host+ as the HTTP/TLS identity while +ipaddr+ controls the
        # actual TCP destination, closing the DNS-preflight/connection-time lookup gap.
        http = Net::HTTP.new(uri.host, uri.port, nil)
        http.ipaddr = validated_ip
        http.use_ssl = uri.scheme == "https"
        http.open_timeout = seconds
        http.read_timeout = seconds
        http.write_timeout = seconds if http.respond_to?(:write_timeout=)
        http.start do |session|
          session.request(request) do |response|
            status = response.code.to_i
            message = response.message.to_s
            location = response["location"]
            response_headers = response.to_hash.flat_map do |name, values|
              Array(values).map { |value| [name, value] }
            end
            response.read_body do |chunk|
              if response_body.bytesize + chunk.bytesize > MAX_EXECUTION_RESPONSE_BYTES
                upstream("Host execution response exceeded the 10 MiB safety limit.", "body-too-large")
              end
              response_body << chunk.b
            end
          end
        end

        { status:, message:, headers: response_headers || [], body: response_body, location: }
      end

      def assert_allowed!(uri)
        forbidden("Host execution only allows HTTP(S) URLs.") unless uri.is_a?(URI::HTTP) && uri.host
        forbidden("Host execution URLs cannot contain embedded credentials.") unless uri.userinfo.nil?
        origin = origin_of(uri)
        forbidden("Origin #{origin} is not allowed for host execution.") unless allowed_origins.include?(origin)

        host = uri.host.to_s.downcase.delete_prefix("[").delete_suffix("]")
        forbidden("Host execution blocks link-local and cloud metadata endpoints.") if METADATA_HOSTS.include?(host)
        if ip_literal?(host)
          forbidden("Host execution blocks link-local and cloud metadata endpoints.") if metadata_ip?(host)
          return host
        end

        addresses = Addrinfo.getaddrinfo(host, uri.port, nil, :STREAM)
        upstream("Host execution could not resolve target hostname.", "upstream-unreachable") if addresses.empty?
        if addresses.any? { |address| metadata_ip?(address.ip_address) }
          forbidden("Host execution blocks DNS resolutions to link-local and cloud metadata endpoints.")
        end

        addresses.first.ip_address
      rescue SocketError
        upstream("Host execution could not resolve target hostname.", "upstream-unreachable")
      end

      def parse_http_uri(raw)
        uri = URI.parse(raw)
        raise URI::InvalidURIError unless uri.is_a?(URI::HTTP) && uri.host

        uri
      end

      def origin_of(uri)
        default_port = uri.scheme == "https" ? 443 : 80
        host = uri.host.to_s
        host = "[#{host}]" if host.include?(":") && !host.start_with?("[")
        port = uri.port == default_port ? "" : ":#{uri.port}"
        "#{uri.scheme.downcase}://#{host.downcase}#{port}"
      end

      def append_query!(uri, values)
        encoded = values.filter_map do |entry|
          next unless entry_enabled?(entry)
          key = string_value(entry["key"])
          next if key.strip.empty?

          URI.encode_www_form([[key, string_value(entry["value"])]])
        end
        return if encoded.empty?

        uri.query = [uri.query, *encoded].compact.reject(&:empty?).join("&")
      end

      def sanitize_headers(values)
        values.each_with_object({}) do |entry, result|
          next unless entry_enabled?(entry)
          name = string_value(entry["key"]).strip
          next if name.empty?
          normalized = name.downcase
          next if UNSAFE_HEADERS.include?(normalized) || normalized.start_with?("proxy-", "sec-")
          bad_request("Invalid host execution request header: #{name}") unless name.match?(/\A[!#$%&'*+\-.^_`|~0-9A-Za-z]+\z/)
          value = string_value(entry["value"])
          bad_request("Invalid host execution request header: #{name}") if value.include?("\r") || value.include?("\n")
          (result[normalized] ||= []) << value
        end
      end

      def set_header!(headers, raw_name, raw_value)
        name = raw_name.to_s.strip
        bad_request("Invalid host execution request header: #{raw_name}") if name.empty? || !name.match?(/\A[!#$%&'*+\-.^_`|~0-9A-Za-z]+\z/)
        normalized = name.downcase
        if UNSAFE_HEADERS.include?(normalized) || normalized.start_with?("proxy-", "sec-")
          bad_request("Unsafe host execution request header: #{name}")
        end
        value = raw_value.to_s
        bad_request("Invalid host execution request header: #{name}") if value.include?("\r") || value.include?("\n")
        headers[normalized] = [value]
      end

      def apply_header_auth!(raw, headers)
        auth = raw.is_a?(Hash) ? raw : {}
        case string_value(auth["type"])
        when "", "none", "inherit"
          nil
        when "bearer"
          token = string_value(auth["token"])
          set_header!(headers, "authorization", "Bearer #{token}") unless token.empty?
        when "oauth2"
          token = string_value(auth["accessToken"])
          set_header!(headers, "authorization", "Bearer #{token}") unless token.empty?
        when "basic"
          credential = "#{string_value(auth["username"])}:#{string_value(auth["password"])}"
          set_header!(headers, "authorization", "Basic #{Base64.strict_encode64(credential)}")
        when "apiKey"
          key = string_value(auth["key"]).strip
          bad_request("API key authentication requires a key name.") if key.empty?
          location = string_value(auth["in"])
          location = "header" if location.empty?
          case location
          when "header"
            set_header!(headers, key, string_value(auth["value"]))
          when "query"
            nil
          when "cookie"
            unsupported("Cookie authentication is not implemented by the Ruby host executor.")
          else
            bad_request("Unsupported API key location: #{location}")
          end
        else
          unsupported("Authentication type #{string_value(auth["type"])} is not implemented by the Ruby host executor.")
        end
      end

      def apply_query_auth!(raw, uri)
        auth = raw.is_a?(Hash) ? raw : {}
        return unless string_value(auth["type"]) == "apiKey" && string_value(auth["in"]) == "query"

        key = string_value(auth["key"])
        bad_request("API key authentication requires a key name.") if key.strip.empty?
        encoded = URI.encode_www_form([[key, string_value(auth["value"])]])
        uri.query = [uri.query, encoded].compact.reject(&:empty?).join("&")
      end

      def prepare_body(draft, envelope, files, mode)
        explicit_type = string_value(draft["contentType"])
        case mode
        when "none"
          ["".b, nil]
        when "raw"
          [string_value(draft["body"]).b, non_empty(explicit_type)]
        when "json"
          [string_value(draft["body"]).b, explicit_type.empty? ? "application/json" : explicit_type]
        when "binary"
          encoded = string_value(envelope["bodyBase64"])
          bad_request("Binary host execution requires bodyBase64.") if encoded.empty?
          data = Base64.strict_decode64(encoded)
          nested = draft["binary"].is_a?(Hash) ? string_value(draft["binary"]["contentType"]) : ""
          content_type = explicit_type.empty? ? (nested.empty? ? "application/octet-stream" : nested) : explicit_type
          [data.b, content_type]
        when "urlencoded"
          pairs = entries(draft["urlencoded"]).filter_map do |entry|
            next unless entry_enabled?(entry)
            key = string_value(entry["key"])
            next if key.strip.empty?
            [key, string_value(entry["value"])]
          end
          [URI.encode_www_form(pairs).b, explicit_type.empty? ? "application/x-www-form-urlencoded" : explicit_type]
        when "graphql"
          graph = draft["graphql"]
          bad_request("GraphQL body must be an object.") unless graph.is_a?(Hash)
          variables_text = string_value(graph["variables"])
          variables = variables_text.strip.empty? ? {} : JSON.parse(variables_text)
          [JSON.generate({ "query" => string_value(graph["query"]), "variables" => variables }).b,
           explicit_type.empty? ? "application/json" : explicit_type]
        when "formdata"
          build_multipart(draft, files)
        else
          unsupported("Body mode #{mode} is not implemented by the Ruby host executor.")
        end
      rescue ArgumentError
        bad_request("Binary host execution bodyBase64 is invalid.") if mode == "binary"
        raise
      rescue JSON::ParserError
        bad_request("GraphQL variables must be valid JSON.")
      end

      def build_multipart(draft, files)
        boundary = "----flexdoc-ruby-#{SecureRandom.hex(12)}"
        output = "".b
        entries(draft["formData"]).each_with_index do |entry, index|
          next unless entry_enabled?(entry)
          key = string_value(entry["key"])
          next if key.strip.empty?

          if string_value(entry["type"]) == "file"
            file = files[index]
            bad_request("Host execution multipart file formData[#{index}] is missing.") unless file
            filename = non_empty(file.filename.to_s) || non_empty(string_value(entry["fileName"])) || "upload.bin"
            content_type = non_empty(file.content_type.to_s) || non_empty(string_value(entry["contentType"])) || "application/octet-stream"
            bad_request("Host execution multipart Content-Type is invalid.", "unsupported-media-type") if content_type.include?("\r") || content_type.include?("\n")
            output << "--#{boundary}\r\n"
            output << "Content-Disposition: form-data; name=\"#{quote_multipart(key)}\"; filename=\"#{quote_multipart(filename)}\"\r\n"
            output << "Content-Type: #{content_type}\r\n\r\n"
            output << file.data.b << "\r\n"
          else
            output << "--#{boundary}\r\n"
            output << "Content-Disposition: form-data; name=\"#{quote_multipart(key)}\"\r\n\r\n"
            output << string_value(entry["value"]).b << "\r\n"
          end
        end
        output << "--#{boundary}--\r\n"
        [output, "multipart/form-data; boundary=#{boundary}"]
      end

      def infer_body_mode(draft)
        explicit = string_value(draft["bodyMode"])
        return explicit unless explicit.strip.empty?
        binary = draft["binary"]
        return "binary" if binary.is_a?(Hash) && !string_value(binary["fileName"]).empty?
        return "formdata" unless entries(draft["formData"]).empty?
        return "urlencoded" unless entries(draft["urlencoded"]).empty?
        graph = draft["graphql"]
        if graph.is_a?(Hash) && (!string_value(graph["query"]).empty? || !string_value(graph["variables"]).empty?)
          return "graphql"
        end
        body = string_value(draft["body"])
        return "none" if body.empty?

        string_value(draft["contentType"]).downcase.include?("json") ? "json" : "raw"
      end

      def entries(raw)
        raw.is_a?(Array) ? raw.select { |entry| entry.is_a?(Hash) } : []
      end

      def entry_enabled?(entry)
        entry["enabled"] != false
      end

      def string_value(raw)
        case raw
        when nil then ""
        when String then raw
        when true, false, Numeric then raw.to_s
        else JSON.generate(raw)
        end
      end

      def integer_value(raw, fallback)
        Integer(raw || fallback)
      rescue ArgumentError, TypeError, RangeError
        fallback
      end

      def non_empty(value)
        value.nil? || value.empty? ? nil : value
      end

      def quote_multipart(value)
        value.to_s.delete("\r\n").gsub("\\") { "\\\\" }.gsub('"') { '\\"' }
      end

      def ip_literal?(host)
        IPAddr.new(host)
        true
      rescue IPAddr::InvalidAddressError
        false
      end

      def metadata_ip?(value)
        ip = IPAddr.new(value)
        return true if LINK_LOCAL_V4.include?(ip) || LINK_LOCAL_V6.include?(ip)
        if ip.ipv6? && (ip.to_i >> 32) == 0xFFFF
          mapped = IPAddr.new(ip.to_i & 0xFFFF_FFFF, Socket::AF_INET)
          return true if LINK_LOCAL_V4.include?(mapped)
        end
        false
      rescue IPAddr::InvalidAddressError
        false
      end
    end
  end
end
