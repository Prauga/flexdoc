# frozen_string_literal: true

module Prauga
  module FlexDoc
    # HTTP response produced by {Host}.
    Response = Data.define(:status, :content_type, :body, :cache_control) do
      # @return [Hash{String => String}] Rack-compatible response headers.
      def headers
        result = {
          "content-type" => content_type,
          "content-length" => body.bytesize.to_s
        }
        result["cache-control"] = cache_control if cache_control
        result
      end

      # @return [Array(Integer, Hash{String => String}, Array<String>)] Rack triplet.
      def rack
        [status, headers, [body]]
      end
    end
  end
end
