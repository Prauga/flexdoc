# frozen_string_literal: true

require "json"

module Prauga
  module FlexDoc
    # Rack application that serves FlexDoc routes from a {Host}.
    class RackApp
      # @param host [Host] host backing the Rack application
      def initialize(host = Host.new)
        @host = host
      end

      # Rack entrypoint.
      #
      # @param env [Hash] Rack environment
      # @return [Array]
      def call(env)
        path = "#{env.fetch("SCRIPT_NAME", "")}#{env.fetch("PATH_INFO", "")}"
        if path == @host.execute_path
          return not_found unless env.fetch("REQUEST_METHOD", "GET") == "POST" && @host.execution_available?

          return execute(env)
        end

        @host.response_for_path(path).rack
      end

      private

      def execute(env)
        marker = env["HTTP_X_FLEXDOC_EXECUTE"]
        return execution_error(403, "Missing X-FlexDoc-Execute header.") unless marker == "1"

        raw = read_bounded(env)
        content_type = env.fetch("CONTENT_TYPE", "")
        envelope, files = if content_type.split(";", 2).first.to_s.strip.casecmp("application/json").zero?
                            [parse_json_object(raw, "Host execution body must be valid UTF-8 JSON object."), {}]
                          elsif content_type.split(";", 2).first.to_s.strip.casecmp("multipart/form-data").zero?
                            parse_multipart(content_type, raw)
                          else
                            return execution_error(400, "Host execution requires application/json or multipart/form-data.")
                          end
        result = @host.host_execution.handle(
          marker: marker,
          envelope:,
          files:
        )
        execution_json(result.status, result.body)
      rescue EnvelopeError => error
        execution_error(400, error.message)
      end

      def read_bounded(env)
        declared = env["CONTENT_LENGTH"].to_i
        if declared > HostExecution::MAX_EXECUTION_REQUEST_BYTES
          raise EnvelopeError, "Host execution request exceeded the 32 MiB safety limit."
        end
        input = env.fetch("rack.input")
        raw = input.read(HostExecution::MAX_EXECUTION_REQUEST_BYTES + 1).to_s.b
        if raw.bytesize > HostExecution::MAX_EXECUTION_REQUEST_BYTES
          raise EnvelopeError, "Host execution request exceeded the 32 MiB safety limit."
        end
        raw
      end

      def parse_json_object(raw, message)
        text = raw.dup.force_encoding(Encoding::UTF_8)
        raise EnvelopeError, message unless text.valid_encoding?

        value = JSON.parse(text)
        raise EnvelopeError, message unless value.is_a?(Hash)

        value
      rescue JSON::ParserError
        raise EnvelopeError, message
      end

      def parse_multipart(content_type, raw)
        boundary = content_type[/boundary=(?:"([^"]+)"|([^;]+))/, 1] || content_type[/boundary=(?:"([^"]+)"|([^;]+))/, 2]
        raise EnvelopeError, "Host execution multipart body is invalid." if boundary.to_s.strip.empty?

        descriptor = nil
        files = {}
        delimiter = "--#{boundary}".b
        raw.split(delimiter).each do |segment|
          next if segment.empty?
          segment = segment.sub(/\A\r\n/n, "")
          break if segment.start_with?("--")
          segment = segment.sub(/\r\n\z/n, "")
          header_blob, data = segment.split("\r\n\r\n".b, 2)
          raise EnvelopeError, "Host execution multipart body is invalid." unless data
          data = data.sub(/\r\n\z/n, "")

          headers = header_blob.split("\r\n".b).each_with_object({}) do |line, result|
            name, value = line.split(":", 2)
            next unless value
            result[name.to_s.downcase] = value.to_s.strip
          end
          disposition = headers.fetch("content-disposition", "")
          name = disposition[/\bname="([^"]*)"/, 1].to_s
          filename = disposition[/\bfilename="([^"]*)"/, 1].to_s

          if name == "descriptor"
            raise EnvelopeError, "Host execution multipart request contains multiple descriptors." if descriptor
            descriptor = data
            next
          end

          match = name.match(/\AformData\[(\d+)\]\z/)
          next unless match
          index = match[1].to_i
          if files.key?(index)
            raise EnvelopeError, "Host execution multipart request contains duplicate formData[#{index}] parts."
          end
          files[index] = HostExecutionFile.new(
            filename:,
            content_type: headers.fetch("content-type", ""),
            data: data.b
          )
        end

        raise EnvelopeError, "Host execution multipart request requires a descriptor." unless descriptor
        [parse_json_object(descriptor, "Host execution multipart descriptor must be valid UTF-8 JSON object."), files]
      rescue ArgumentError
        raise EnvelopeError, "Host execution multipart body is invalid."
      end

      def execution_error(status, message)
        execution_json(status, { "error" => message })
      end

      def execution_json(status, payload)
        body = JSON.generate(payload)
        [
          status,
          {
            "content-type" => "application/json; charset=utf-8",
            "content-length" => body.bytesize.to_s,
            "cache-control" => "no-store"
          },
          [body]
        ]
      end

      def not_found
        Response.new(status: 404, content_type: "text/plain; charset=utf-8", body: "Not Found", cache_control: nil).rack
      end

      class EnvelopeError < StandardError; end
    end
  end
end
